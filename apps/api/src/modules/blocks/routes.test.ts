// CA11 (ADR 005) : bloquer supprime l'amitié et les demandes en cours, empêche toute nouvelle
// interaction (activité 404, demande neutre cachée).
import { BlocksResponseSchema, FriendRequestsResponseSchema, SignInResponseSchema } from "@app/contracts";
import { schema } from "@app/db";
import { and, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetRateLimits } from "../../middleware/rate-limit";
import { createTestApp, type TestApp } from "../../test-support";

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

async function becomeFriends(testApp: TestApp, a: { userId: string; session: { token: string } }, b: { userId: string; session: { token: string } }) {
  await testApp.db.insert(schema.friendships).values([
    { userId: a.userId, friendId: b.userId },
    { userId: b.userId, friendId: a.userId },
  ]);
}

function block(testApp: TestApp, token: string, userId: string) {
  return testApp.app.request("/blocks", { method: "POST", headers: authHeader(token), body: JSON.stringify({ userId }) });
}

describe("POST/GET /blocks, DELETE /blocks/:userId (CA11)", () => {
  let testApp: TestApp;

  beforeEach(() => resetRateLimits());
  afterEach(async () => {
    await testApp?.close();
  });

  it("sans pseudonyme ⇒ 403 USERNAME_REQUIRED", async () => {
    testApp = await createTestApp();
    const alice = await signInDev(testApp, "alice");
    const bob = await signInDev(testApp, "bob");
    const res = await block(testApp, alice.session.token, bob.userId);
    expect(res.status).toBe(403);
  });

  it("bloquer soi-même ⇒ 422 CANNOT_TARGET_SELF", async () => {
    testApp = await createTestApp();
    const alice = await seedUser(testApp, "alice", "alice");
    const res = await block(testApp, alice.session.token, alice.userId);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe("CANNOT_TARGET_SELF");
  });

  it("bloquer un utilisateur inexistant ⇒ 404", async () => {
    testApp = await createTestApp();
    const alice = await seedUser(testApp, "alice", "alice");
    const res = await block(testApp, alice.session.token, "00000000-0000-4000-8000-000000000000");
    expect(res.status).toBe(404);
  });

  it("idempotent : bloquer deux fois ne renvoie pas d'erreur", async () => {
    testApp = await createTestApp();
    const alice = await seedUser(testApp, "alice", "alice");
    const bob = await seedUser(testApp, "bob", "bob");
    expect((await block(testApp, alice.session.token, bob.userId)).status).toBe(204);
    expect((await block(testApp, alice.session.token, bob.userId)).status).toBe(204);
  });

  it("transaction : supprime amitié et demandes en cours dans les deux sens", async () => {
    testApp = await createTestApp();
    const alice = await seedUser(testApp, "alice", "alice");
    const bob = await seedUser(testApp, "bob", "bob");
    await becomeFriends(testApp, alice, bob);
    await testApp.db.insert(schema.friendRequests).values({ senderId: bob.userId, recipientId: alice.userId, hidden: false });

    const res = await block(testApp, alice.session.token, bob.userId);
    expect(res.status).toBe(204);

    const friendships = await testApp.db.select().from(schema.friendships).where(eq(schema.friendships.userId, alice.userId));
    expect(friendships).toHaveLength(0);
    const requests = await testApp.db
      .select()
      .from(schema.friendRequests)
      .where(and(eq(schema.friendRequests.senderId, bob.userId), eq(schema.friendRequests.recipientId, alice.userId)));
    expect(requests).toHaveLength(0);
  });

  it("transaction : supprime les notifications en attente entre les deux", async () => {
    testApp = await createTestApp();
    const alice = await seedUser(testApp, "alice", "alice");
    const bob = await seedUser(testApp, "bob", "bob");
    await testApp.db.insert(schema.pendingNotifications).values({
      recipientId: alice.userId,
      actorId: bob.userId,
      type: "friend_request_received",
      payload: {},
      deliverAfter: new Date(),
      expiresAt: new Date(Date.now() + 3600_000),
    });

    await block(testApp, alice.session.token, bob.userId);

    const pending = await testApp.db.select().from(schema.pendingNotifications).where(eq(schema.pendingNotifications.recipientId, alice.userId));
    expect(pending).toHaveLength(0);
  });

  it("après blocage, l'activité du bloqué est inaccessible (404, ex-ami)", async () => {
    testApp = await createTestApp();
    const alice = await seedUser(testApp, "alice", "alice");
    const bob = await seedUser(testApp, "bob", "bob");
    await becomeFriends(testApp, alice, bob);

    await block(testApp, alice.session.token, bob.userId);

    const res = await testApp.app.request(`/friends/${bob.userId}/activity`, { headers: authHeader(alice.session.token) });
    expect(res.status).toBe(404);
  });

  it("après blocage, une demande du bloqué vers le bloqueur reçoit une réponse neutre et reste cachée", async () => {
    testApp = await createTestApp();
    const alice = await seedUser(testApp, "alice", "alice");
    const bob = await seedUser(testApp, "bob", "bob");
    await block(testApp, alice.session.token, bob.userId);

    const res = await testApp.app.request("/friend-requests", {
      method: "POST",
      headers: authHeader(bob.session.token),
      body: JSON.stringify({ username: "alice" }),
    });
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ status: "requested" });

    const aliceIncoming = FriendRequestsResponseSchema.parse(
      await (await testApp.app.request("/friend-requests", { headers: authHeader(alice.session.token) })).json(),
    );
    expect(aliceIncoming.incoming).toEqual([]);
  });

  it("GET /blocks liste les utilisateurs bloqués ; DELETE annule le blocage", async () => {
    testApp = await createTestApp();
    const alice = await seedUser(testApp, "alice", "alice");
    const bob = await seedUser(testApp, "bob", "bob");
    await block(testApp, alice.session.token, bob.userId);

    const list = await testApp.app.request("/blocks", { headers: authHeader(alice.session.token) });
    const body = BlocksResponseSchema.parse(await list.json());
    expect(body.blocked).toHaveLength(1);
    expect(body.blocked[0]!.username).toBe("bob");

    const del = await testApp.app.request(`/blocks/${bob.userId}`, { method: "DELETE", headers: authHeader(alice.session.token) });
    expect(del.status).toBe(204);

    const listAfter = BlocksResponseSchema.parse(
      await (await testApp.app.request("/blocks", { headers: authHeader(alice.session.token) })).json(),
    );
    expect(listAfter.blocked).toEqual([]);
  });

  it("annuler un blocage inexistant ⇒ 404", async () => {
    testApp = await createTestApp();
    const alice = await seedUser(testApp, "alice", "alice");
    const bob = await seedUser(testApp, "bob", "bob");
    const res = await testApp.app.request(`/blocks/${bob.userId}`, { method: "DELETE", headers: authHeader(alice.session.token) });
    expect(res.status).toBe(404);
  });
});
