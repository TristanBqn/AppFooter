// ApnsTransport (ADR 004, B12) : JWT ES256, hôte sandbox/production selon l'appareil, suppression
// des jetons invalides (410 / 400 BadDeviceToken). Client HTTP/2 simulé (injecté).
import { SignInResponseSchema } from "@app/contracts";
import { schema } from "@app/db";
import { eq } from "drizzle-orm";
import { decodeJwt, decodeProtectedHeader, exportPKCS8, generateKeyPair } from "jose";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { resetRateLimits } from "../../middleware/rate-limit";
import { createTestApp, type TestApp } from "../../test-support";
import type { ApnsHttp2Client, ApnsHttp2Response } from "./apns-http2-client";
import { createApnsTransport } from "./apns-transport";
import type { OutboundNotification, PushDevice } from "./transport";

interface RecordedCall {
  origin: string;
  path: string;
  headers: Record<string, string>;
  body: string;
}

function fakeHttp2Client(response: ApnsHttp2Response): { client: ApnsHttp2Client; calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  return {
    calls,
    client: {
      async post(origin, path, headers, body) {
        calls.push({ origin, path, headers, body });
        return response;
      },
    },
  };
}

async function signInDev(testApp: TestApp, devUserKey: string) {
  const res = await testApp.app.request("/auth/dev", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ devUserKey }),
  });
  return SignInResponseSchema.parse(await res.json());
}

describe("createApnsTransport (B12, ADR 004)", () => {
  let testApp: TestApp;
  let privateKeyPem: string;

  beforeAll(async () => {
    const { privateKey } = await generateKeyPair("ES256", { extractable: true });
    privateKeyPem = await exportPKCS8(privateKey);
  });

  beforeEach(() => resetRateLimits());
  afterEach(async () => {
    await testApp?.close();
  });

  function transport(http2Client: ApnsHttp2Client, now?: () => Date) {
    return createApnsTransport({
      db: testApp.db,
      http2Client,
      teamId: "TEAM123",
      keyId: "KEY123",
      privateKeyPem,
      bundleId: "fr.tristanbqn.footer",
      now,
    });
  }

  it("envoie vers l'hôte production ou sandbox selon l'appareil, avec apns-topic", async () => {
    testApp = await createTestApp();
    const { client, calls } = fakeHttp2Client({ status: 200, body: "" });
    const notification: OutboundNotification = {
      recipientId: "00000000-0000-4000-8000-000000000000",
      type: "friend_request_accepted",
      payload: { type: "friend_request_accepted", fromUserId: "00000000-0000-4000-8000-000000000001", fromUsername: "alice" },
    };

    await transport(client).send({ apnsToken: "a".repeat(64), environment: "production" }, notification);
    await transport(client).send({ apnsToken: "b".repeat(64), environment: "sandbox" }, notification);

    expect(calls[0]!.origin).toBe("https://api.push.apple.com");
    expect(calls[0]!.path).toBe(`/3/device/${"a".repeat(64)}`);
    expect(calls[0]!.headers["apns-topic"]).toBe("fr.tristanbqn.footer");
    expect(calls[1]!.origin).toBe("https://api.sandbox.push.apple.com");
  });

  it("authorization : JWT ES256 valide (iss = teamId, kid = keyId)", async () => {
    testApp = await createTestApp();
    const { client, calls } = fakeHttp2Client({ status: 200, body: "" });
    const notification: OutboundNotification = {
      recipientId: "00000000-0000-4000-8000-000000000000",
      type: "friend_request_received",
      payload: { type: "friend_request_received", fromUserId: "00000000-0000-4000-8000-000000000001", fromUsername: "bob" },
    };

    await transport(client).send({ apnsToken: "a".repeat(64), environment: "sandbox" }, notification);

    const authHeader = calls[0]!.headers.authorization!;
    expect(authHeader.startsWith("bearer ")).toBe(true);
    const jwt = authHeader.slice("bearer ".length);
    expect(decodeProtectedHeader(jwt)).toMatchObject({ alg: "ES256", kid: "KEY123" });
    expect(decodeJwt(jwt)).toMatchObject({ iss: "TEAM123" });
  });

  it.each([
    ["milestone_self", { type: "milestone_self", date: "2026-09-20", milestone: 5000 }, /5\s000 pas/],
    [
      "milestone_friend",
      { type: "milestone_friend", fromUserId: "u", fromUsername: "alice", milestone: 10000 },
      /alice.*10\s000 pas/,
    ],
    [
      "encouragement_received",
      { type: "encouragement_received", fromUserId: "u", fromUsername: "bob", messageId: "bravo" },
      /bob.*Bravo pour ta marche/,
    ],
    ["friend_request_received", { type: "friend_request_received", fromUserId: "u", fromUsername: "charlie" }, /charlie.*ami/],
    ["friend_request_accepted", { type: "friend_request_accepted", fromUserId: "u", fromUsername: "dave" }, /dave.*accepté/],
  ] as const)("texte d'alerte adapté au type %s", async (type, payload, pattern) => {
    testApp = await createTestApp();
    const { client, calls } = fakeHttp2Client({ status: 200, body: "" });
    const notification = { recipientId: "r", type, payload } as OutboundNotification;

    await transport(client).send({ apnsToken: "a".repeat(64), environment: "sandbox" }, notification);

    const body = JSON.parse(calls[0]!.body) as { aps: { alert: string }; footer: unknown };
    expect(body.aps.alert).toMatch(pattern);
    expect(body.footer).toEqual(payload);
  });

  it("jeton fournisseur mis en cache tant que non expiré, régénéré ensuite", async () => {
    testApp = await createTestApp();
    const { client, calls } = fakeHttp2Client({ status: 200, body: "" });
    let now = new Date("2026-09-20T10:00:00Z");
    const t = transport(client, () => now);
    const device: PushDevice = { apnsToken: "a".repeat(64), environment: "sandbox" };
    const notification: OutboundNotification = {
      recipientId: "r",
      type: "friend_request_accepted",
      payload: { type: "friend_request_accepted", fromUserId: "u", fromUsername: "alice" },
    };

    await t.send(device, notification);
    await t.send(device, notification); // même instant : jeton réutilisé
    expect(calls[0]!.headers.authorization).toBe(calls[1]!.headers.authorization);

    now = new Date(now.getTime() + 51 * 60_000); // au-delà du TTL (50 min)
    await t.send(device, notification);
    expect(calls[2]!.headers.authorization).not.toBe(calls[0]!.headers.authorization);
  });

  it("410 Gone : le jeton APNs est supprimé de push_devices", async () => {
    testApp = await createTestApp();
    const alice = await signInDev(testApp, "alice");
    const apnsToken = "a".repeat(64);
    await testApp.app.request("/me/devices", {
      method: "PUT",
      headers: { authorization: `Bearer ${alice.session.token}`, "content-type": "application/json" },
      body: JSON.stringify({ apnsToken, environment: "sandbox" }),
    });

    const { client } = fakeHttp2Client({ status: 410, body: '{"reason":"Unregistered"}' });
    const notification: OutboundNotification = {
      recipientId: alice.userId,
      type: "friend_request_accepted",
      payload: { type: "friend_request_accepted", fromUserId: "u", fromUsername: "alice" },
    };
    await transport(client).send({ apnsToken, environment: "sandbox" }, notification);

    const rows = await testApp.db.select().from(schema.pushDevices).where(eq(schema.pushDevices.apnsToken, apnsToken));
    expect(rows).toHaveLength(0);
  });

  it("400 BadDeviceToken : le jeton est supprimé ; une autre erreur 400 ne supprime rien", async () => {
    testApp = await createTestApp();
    const alice = await signInDev(testApp, "alice");
    const apnsToken = "a".repeat(64);
    await testApp.app.request("/me/devices", {
      method: "PUT",
      headers: { authorization: `Bearer ${alice.session.token}`, "content-type": "application/json" },
      body: JSON.stringify({ apnsToken, environment: "sandbox" }),
    });

    const { client } = fakeHttp2Client({ status: 400, body: '{"reason":"BadDeviceToken"}' });
    const notification: OutboundNotification = {
      recipientId: alice.userId,
      type: "friend_request_accepted",
      payload: { type: "friend_request_accepted", fromUserId: "u", fromUsername: "alice" },
    };
    await transport(client).send({ apnsToken, environment: "sandbox" }, notification);
    const rows = await testApp.db.select().from(schema.pushDevices).where(eq(schema.pushDevices.apnsToken, apnsToken));
    expect(rows).toHaveLength(0);
  });

  it("200 OK : le jeton est conservé", async () => {
    testApp = await createTestApp();
    const alice = await signInDev(testApp, "alice");
    const apnsToken = "a".repeat(64);
    await testApp.app.request("/me/devices", {
      method: "PUT",
      headers: { authorization: `Bearer ${alice.session.token}`, "content-type": "application/json" },
      body: JSON.stringify({ apnsToken, environment: "sandbox" }),
    });

    const { client } = fakeHttp2Client({ status: 200, body: "" });
    const notification: OutboundNotification = {
      recipientId: alice.userId,
      type: "friend_request_accepted",
      payload: { type: "friend_request_accepted", fromUserId: "u", fromUsername: "alice" },
    };
    await transport(client).send({ apnsToken, environment: "sandbox" }, notification);
    const rows = await testApp.db.select().from(schema.pushDevices).where(eq(schema.pushDevices.apnsToken, apnsToken));
    expect(rows).toHaveLength(1);
  });
});
