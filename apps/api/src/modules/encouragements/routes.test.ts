// CA9 : encouragement prédéfini, ami requis (404 sinon), quota d'un par ami et par jour (429),
// aucun texte libre accepté. Couvre aussi le blocage (B8) : encouragement ⇒ 404 après blocage.
import { ReceivedEncouragementsResponseSchema, SendEncouragementResponseSchema, SignInResponseSchema } from "@app/contracts";
import { schema } from "@app/db";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetRateLimits } from "../../middleware/rate-limit";
import { createTestApp, type TestApp } from "../../test-support";
import { ConsoleTransport } from "../notifications/console-transport";

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

async function friend(testApp: TestApp, a: string, b: string) {
  await testApp.db.insert(schema.friendships).values([
    { userId: a, friendId: b },
    { userId: b, friendId: a },
  ]);
}

function sendEncouragement(testApp: TestApp, token: string, toUserId: string, messageId = "bravo") {
  return testApp.app.request("/encouragements", {
    method: "POST",
    headers: authHeader(token),
    body: JSON.stringify({ toUserId, messageId }),
  });
}

describe("POST /encouragements (CA9)", () => {
  let testApp: TestApp;

  beforeEach(() => resetRateLimits());
  afterEach(async () => {
    await testApp?.close();
  });

  it("sans pseudonyme ⇒ 403 USERNAME_REQUIRED", async () => {
    testApp = await createTestApp();
    const alice = await signInDev(testApp, "alice");
    const bob = await signInDev(testApp, "bob");
    const res = await sendEncouragement(testApp, alice.session.token, bob.userId);
    expect(res.status).toBe(403);
  });

  it("non-ami ⇒ 404, jamais 403", async () => {
    testApp = await createTestApp();
    const alice = await seedUser(testApp, "alice", "alice");
    const bob = await seedUser(testApp, "bob", "bob");
    const res = await sendEncouragement(testApp, alice.session.token, bob.userId);
    expect(res.status).toBe(404);
  });

  it("clé supplémentaire (texte libre) ⇒ 400 VALIDATION_ERROR", async () => {
    testApp = await createTestApp();
    const alice = await seedUser(testApp, "alice", "alice");
    const bob = await seedUser(testApp, "bob", "bob");
    await friend(testApp, alice.userId, bob.userId);

    const res = await testApp.app.request("/encouragements", {
      method: "POST",
      headers: authHeader(alice.session.token),
      body: JSON.stringify({ toUserId: bob.userId, messageId: "bravo", text: "salut !" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("messageId hors catalogue fermé ⇒ 400 VALIDATION_ERROR", async () => {
    testApp = await createTestApp();
    const alice = await seedUser(testApp, "alice", "alice");
    const bob = await seedUser(testApp, "bob", "bob");
    await friend(testApp, alice.userId, bob.userId);
    const res = await sendEncouragement(testApp, alice.session.token, bob.userId, "message-libre-inventé");
    expect(res.status).toBe(400);
  });

  it("envoi valide : 200, puis un 2ᵉ envoi au même ami le même jour ⇒ 429 ENCOURAGEMENT_LIMIT", async () => {
    const NOW = new Date("2026-09-20T10:00:00Z");
    testApp = await createTestApp({ now: () => NOW });
    const alice = await seedUser(testApp, "alice", "alice");
    const bob = await seedUser(testApp, "bob", "bob");
    await friend(testApp, alice.userId, bob.userId);

    const first = await sendEncouragement(testApp, alice.session.token, bob.userId);
    expect(first.status).toBe(200);
    const body = SendEncouragementResponseSchema.parse(await first.json());
    expect(body.sentAt).toBe(NOW.toISOString());

    const second = await sendEncouragement(testApp, alice.session.token, bob.userId);
    expect(second.status).toBe(429);
    expect((await second.json()).error.code).toBe("ENCOURAGEMENT_LIMIT");
  });

  it("le lendemain (jour local suivant), un nouvel envoi au même ami est de nouveau accepté", async () => {
    testApp = await createTestApp({ now: () => new Date("2026-09-20T10:00:00Z") });
    const alice = await seedUser(testApp, "alice", "alice");
    const bob = await seedUser(testApp, "bob", "bob");
    await friend(testApp, alice.userId, bob.userId);
    await sendEncouragement(testApp, alice.session.token, bob.userId);

    await testApp.db.update(schema.encouragements).set({ senderLocalDate: "2026-09-19" }).where(eq(schema.encouragements.senderId, alice.userId));
    const res = await sendEncouragement(testApp, alice.session.token, bob.userId);
    expect(res.status).toBe(200);
  });

  it("notifie le destinataire (encouragement_received)", async () => {
    const NOW = new Date("2026-09-20T10:00:00Z"); // hors heures silencieuses
    const transport = new ConsoleTransport();
    testApp = await createTestApp({ now: () => NOW, pushTransport: transport });
    const alice = await seedUser(testApp, "alice", "alice");
    const bob = await seedUser(testApp, "bob", "bob");
    await friend(testApp, alice.userId, bob.userId);
    await testApp.app.request("/me/devices", {
      method: "PUT",
      headers: authHeader(bob.session.token),
      body: JSON.stringify({ apnsToken: "0123456789abcdef".repeat(4), environment: "sandbox" }),
    });

    await sendEncouragement(testApp, alice.session.token, bob.userId, "inspiring");

    expect(transport.outbox).toHaveLength(1);
    expect(transport.outbox[0]!.notification).toMatchObject({
      recipientId: bob.userId,
      type: "encouragement_received",
      payload: { fromUserId: alice.userId, fromUsername: "alice", messageId: "inspiring" },
    });
  });

  it("après blocage, l'ancien ami ne peut plus envoyer d'encouragement (404)", async () => {
    testApp = await createTestApp();
    const alice = await seedUser(testApp, "alice", "alice");
    const bob = await seedUser(testApp, "bob", "bob");
    await friend(testApp, alice.userId, bob.userId);

    const block = await testApp.app.request("/blocks", {
      method: "POST",
      headers: authHeader(alice.session.token),
      body: JSON.stringify({ userId: bob.userId }),
    });
    expect(block.status).toBe(204);

    const fromBlocked = await sendEncouragement(testApp, bob.session.token, alice.userId);
    expect(fromBlocked.status).toBe(404);
    const fromBlocker = await sendEncouragement(testApp, alice.session.token, bob.userId);
    expect(fromBlocker.status).toBe(404);
  });
});

describe("GET /encouragements/received", () => {
  let testApp: TestApp;

  beforeEach(() => resetRateLimits());
  afterEach(async () => {
    await testApp?.close();
  });

  it("liste les encouragements reçus d'amis actuels, plus récent d'abord", async () => {
    let now = new Date("2026-09-20T10:00:00Z");
    testApp = await createTestApp({ now: () => now });
    const alice = await seedUser(testApp, "alice", "alice");
    const bob = await seedUser(testApp, "bob", "bob");
    const charlie = await seedUser(testApp, "charlie", "charlie");
    await friend(testApp, alice.userId, bob.userId);
    await friend(testApp, alice.userId, charlie.userId);

    await sendEncouragement(testApp, bob.session.token, alice.userId, "bravo");
    now = new Date("2026-09-20T10:05:00Z"); // horodatage distinct : ordre déterministe
    await sendEncouragement(testApp, charlie.session.token, alice.userId, "nice_day");

    const res = await testApp.app.request("/encouragements/received", { headers: authHeader(alice.session.token) });
    expect(res.status).toBe(200);
    const body = ReceivedEncouragementsResponseSchema.parse(await res.json());
    expect(body.encouragements).toHaveLength(2);
    expect(body.encouragements[0]!.from.username).toBe("charlie"); // envoyé en second, donc le plus récent
    expect(body.encouragements[1]!.from.username).toBe("bob");
  });

  it("un encouragement d'un ex-ami (retiré) disparaît de la liste", async () => {
    testApp = await createTestApp();
    const alice = await seedUser(testApp, "alice", "alice");
    const bob = await seedUser(testApp, "bob", "bob");
    await friend(testApp, alice.userId, bob.userId);
    await sendEncouragement(testApp, bob.session.token, alice.userId);

    await testApp.app.request(`/friends/${bob.userId}`, { method: "DELETE", headers: authHeader(alice.session.token) });

    const res = await testApp.app.request("/encouragements/received", { headers: authHeader(alice.session.token) });
    const body = ReceivedEncouragementsResponseSchema.parse(await res.json());
    expect(body.encouragements).toEqual([]);
  });

  it("sans jeton ⇒ 401", async () => {
    testApp = await createTestApp();
    expect((await testApp.app.request("/encouragements/received")).status).toBe(401);
  });
});
