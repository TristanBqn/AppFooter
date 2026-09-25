// CA10 (ADR 004) : point d'entrée unique `notify`, heures silencieuses, `flushDueNotifications`.
import { SignInResponseSchema } from "@app/contracts";
import { schema } from "@app/db";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetRateLimits } from "../../middleware/rate-limit";
import { createTestApp, type TestApp } from "../../test-support";
import { ConsoleTransport } from "./console-transport";
import { flushDueNotifications, notify } from "./service";

const APNS_TOKEN = "0123456789abcdef".repeat(4); // 64 caractères hex

async function signInDev(testApp: TestApp, devUserKey: string) {
  const res = await testApp.app.request("/auth/dev", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ devUserKey }),
  });
  return SignInResponseSchema.parse(await res.json());
}

function authHeader(token: string) {
  return { authorization: `Bearer ${token}`, "content-type": "application/json" };
}

async function seedUser(testApp: TestApp, devUserKey: string, username: string) {
  const signIn = await signInDev(testApp, devUserKey);
  const res = await testApp.app.request("/me/username", {
    method: "PUT",
    headers: authHeader(signIn.session.token),
    body: JSON.stringify({ username }),
  });
  expect(res.status).toBe(200);
  return signIn;
}

async function registerDevice(testApp: TestApp, token: string) {
  const res = await testApp.app.request("/me/devices", {
    method: "PUT",
    headers: authHeader(token),
    body: JSON.stringify({ apnsToken: APNS_TOKEN, environment: "sandbox" }),
  });
  expect(res.status).toBe(204);
}

const PAYLOAD = { type: "friend_request_received" as const, fromUserId: "00000000-0000-4000-8000-000000000000", fromUsername: "bob" };

describe("PUT /me/devices", () => {
  let testApp: TestApp;
  beforeEach(() => resetRateLimits());
  afterEach(async () => {
    await testApp?.close();
  });

  it("enregistre l'appareil ; sans jeton ⇒ 401", async () => {
    testApp = await createTestApp();
    const alice = await signInDev(testApp, "alice");
    await registerDevice(testApp, alice.session.token);
    const rows = await testApp.db.select().from(schema.pushDevices).where(eq(schema.pushDevices.userId, alice.userId));
    expect(rows).toHaveLength(1);

    const res = await testApp.app.request("/me/devices");
    expect(res.status).toBe(401);
  });
});

describe("notify() (ADR 004)", () => {
  let testApp: TestApp;
  let transport: ConsoleTransport;

  beforeEach(() => {
    resetRateLimits();
    transport = new ConsoleTransport();
  });
  afterEach(async () => {
    await testApp?.close();
  });

  it("préférence désactivée : ni envoi ni mise en attente", async () => {
    const NOW = new Date("2026-09-20T10:00:00Z"); // journée, hors heures silencieuses
    testApp = await createTestApp({ now: () => NOW, pushTransport: transport });
    const alice = await seedUser(testApp, "alice", "alice");
    await registerDevice(testApp, alice.session.token);
    await testApp.db.update(schema.userSettings).set({ notifyFriendRequests: false }).where(eq(schema.userSettings.userId, alice.userId));

    await notify(testApp.db, transport, alice.userId, "friend_request_received", PAYLOAD, undefined, NOW);

    expect(transport.outbox).toHaveLength(0);
    const pending = await testApp.db.select().from(schema.pendingNotifications).where(eq(schema.pendingNotifications.recipientId, alice.userId));
    expect(pending).toHaveLength(0);
  });

  it("acteur bloqué (dans un sens ou l'autre) : rien n'est envoyé", async () => {
    const NOW = new Date("2026-09-20T10:00:00Z");
    testApp = await createTestApp({ now: () => NOW, pushTransport: transport });
    const alice = await seedUser(testApp, "alice", "alice");
    const bob = await seedUser(testApp, "bob", "bob");
    await registerDevice(testApp, alice.session.token);
    await testApp.db.insert(schema.blocks).values({ blockerId: alice.userId, blockedId: bob.userId });

    await notify(testApp.db, transport, alice.userId, "friend_request_received", PAYLOAD, bob.userId, NOW);

    expect(transport.outbox).toHaveLength(0);
  });

  it("hors heures silencieuses : envoi immédiat à tous les appareils du destinataire", async () => {
    const NOW = new Date("2026-09-20T10:00:00Z"); // 12h à Paris
    testApp = await createTestApp({ now: () => NOW, pushTransport: transport });
    const alice = await seedUser(testApp, "alice", "alice");
    await registerDevice(testApp, alice.session.token);

    await notify(testApp.db, transport, alice.userId, "friend_request_received", PAYLOAD, undefined, NOW);

    expect(transport.outbox).toHaveLength(1);
    expect(transport.outbox[0]!.notification).toEqual({ recipientId: alice.userId, type: "friend_request_received", payload: PAYLOAD });
    const pending = await testApp.db.select().from(schema.pendingNotifications).where(eq(schema.pendingNotifications.recipientId, alice.userId));
    expect(pending).toHaveLength(0);
  });

  it("pendant les heures silencieuses : mise en attente, rien émis immédiatement (CA10)", async () => {
    const NOW = new Date("2026-09-20T20:30:00Z"); // 22h30 à Paris (fuseau par défaut)
    testApp = await createTestApp({ now: () => NOW, pushTransport: transport });
    const alice = await seedUser(testApp, "alice", "alice");
    await registerDevice(testApp, alice.session.token);

    await notify(testApp.db, transport, alice.userId, "friend_request_received", PAYLOAD, undefined, NOW);

    expect(transport.outbox).toHaveLength(0);
    const [pending] = await testApp.db.select().from(schema.pendingNotifications).where(eq(schema.pendingNotifications.recipientId, alice.userId));
    expect(pending).toBeDefined();
    expect(pending!.deliverAfter.toISOString()).toBe(new Date("2026-09-21T06:00:00Z").toISOString()); // 8h le lendemain à Paris
    expect(pending!.expiresAt.getTime()).toBe(NOW.getTime() + 24 * 60 * 60_000);
  });
});

describe("flushDueNotifications (ADR 004)", () => {
  let testApp: TestApp;
  let transport: ConsoleTransport;

  beforeEach(() => {
    resetRateLimits();
    transport = new ConsoleTransport();
  });
  afterEach(async () => {
    await testApp?.close();
  });

  async function seedPending(testApp: TestApp, recipientId: string, overrides: Partial<typeof schema.pendingNotifications.$inferInsert> = {}) {
    await testApp.db.insert(schema.pendingNotifications).values({
      recipientId,
      actorId: null,
      type: "friend_request_received",
      payload: PAYLOAD,
      deliverAfter: new Date("2026-09-21T06:00:00Z"),
      expiresAt: new Date("2026-09-22T06:00:00Z"),
      ...overrides,
    });
  }

  it("rien n'est émis avant deliver_after", async () => {
    testApp = await createTestApp({ pushTransport: transport });
    const alice = await seedUser(testApp, "alice", "alice");
    await registerDevice(testApp, alice.session.token);
    await seedPending(testApp, alice.userId);

    await flushDueNotifications(testApp.db, transport, new Date("2026-09-21T05:59:00Z"));
    expect(transport.outbox).toHaveLength(0);
    const remaining = await testApp.db.select().from(schema.pendingNotifications);
    expect(remaining).toHaveLength(1);
  });

  it("émission à la fin de la plage : supprimée après envoi", async () => {
    testApp = await createTestApp({ pushTransport: transport });
    const alice = await seedUser(testApp, "alice", "alice");
    await registerDevice(testApp, alice.session.token);
    await seedPending(testApp, alice.userId);

    await flushDueNotifications(testApp.db, transport, new Date("2026-09-21T06:00:00Z"));
    expect(transport.outbox).toHaveLength(1);
    const remaining = await testApp.db.select().from(schema.pendingNotifications);
    expect(remaining).toHaveLength(0);
  });

  it("expiration 24 h : abandonnée sans envoi", async () => {
    testApp = await createTestApp({ pushTransport: transport });
    const alice = await seedUser(testApp, "alice", "alice");
    await registerDevice(testApp, alice.session.token);
    await seedPending(testApp, alice.userId, { deliverAfter: new Date("2026-09-20T06:00:00Z"), expiresAt: new Date("2026-09-21T06:00:00Z") });

    await flushDueNotifications(testApp.db, transport, new Date("2026-09-21T07:00:00Z")); // 1h après expiration
    expect(transport.outbox).toHaveLength(0);
    const remaining = await testApp.db.select().from(schema.pendingNotifications);
    expect(remaining).toHaveLength(0);
  });

  it("ne garde qu'une notification par (destinataire, type, acteur)", async () => {
    testApp = await createTestApp({ pushTransport: transport });
    const alice = await seedUser(testApp, "alice", "alice");
    await registerDevice(testApp, alice.session.token);
    await seedPending(testApp, alice.userId, { deliverAfter: new Date("2026-09-21T06:00:00Z") });
    await seedPending(testApp, alice.userId, { deliverAfter: new Date("2026-09-21T06:05:00Z") });

    await flushDueNotifications(testApp.db, transport, new Date("2026-09-21T07:00:00Z"));
    expect(transport.outbox).toHaveLength(1);
    const remaining = await testApp.db.select().from(schema.pendingNotifications);
    expect(remaining).toHaveLength(0);
  });
});
