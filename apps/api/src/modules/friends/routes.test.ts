// CA7, CA8 (ADR 005) : réponse neutre à l'ajout d'ami, demandes cachées, 404 jamais 403 sur les
// ressources d'autrui, égalité des corps pour inconnu / bloqué / refus.
import {
  CreateFriendRequestResponseSchema,
  FriendActivityResponseSchema,
  FriendRequestsResponseSchema,
  FriendsResponseSchema,
  SignInResponseSchema,
} from "@app/contracts";
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

async function setUsername(testApp: TestApp, token: string, username: string) {
  const res = await testApp.app.request("/me/username", {
    method: "PUT",
    headers: authHeader(token),
    body: JSON.stringify({ username }),
  });
  expect(res.status).toBe(200);
}

async function seedUser(testApp: TestApp, devUserKey: string, username: string) {
  const signIn = await signInDev(testApp, devUserKey);
  await setUsername(testApp, signIn.session.token, username);
  return signIn;
}

function requestFriend(testApp: TestApp, token: string, username: string) {
  return testApp.app.request("/friend-requests", {
    method: "POST",
    headers: authHeader(token),
    body: JSON.stringify({ username }),
  });
}

async function seedActivity(testApp: TestApp, userId: string, date: string, steps: number) {
  await testApp.db.insert(schema.dailyActivity).values({ userId, date, steps, activeCalories: 0, timeZone: "Europe/Paris" });
}

async function seedFriendship(testApp: TestApp, a: string, b: string) {
  await testApp.db.insert(schema.friendships).values([
    { userId: a, friendId: b },
    { userId: b, friendId: a },
  ]);
}

describe("POST /friend-requests (CA7, ADR 005)", () => {
  let testApp: TestApp;

  beforeEach(() => resetRateLimits());
  afterEach(async () => {
    await testApp?.close();
  });

  it("sans pseudonyme ⇒ 403 USERNAME_REQUIRED", async () => {
    testApp = await createTestApp();
    const alice = await signInDev(testApp, "alice");
    const res = await requestFriend(testApp, alice.session.token, "bob");
    expect(res.status).toBe(403);
  });

  it("corps et statut identiques pour pseudo inconnu, cible qui m'a bloqué, cible qui refuse les demandes", async () => {
    testApp = await createTestApp();
    const alice = await seedUser(testApp, "alice", "alice");
    const blocker = await seedUser(testApp, "blocker", "blocker");
    const refuser = await seedUser(testApp, "refuser", "refuser");

    await testApp.db.insert(schema.blocks).values({ blockerId: blocker.userId, blockedId: alice.userId });
    await testApp.db.update(schema.userSettings).set({ acceptFriendRequests: false }).where(eq(schema.userSettings.userId, refuser.userId));

    const unknown = await requestFriend(testApp, alice.session.token, "inconnu999");
    const blocked = await requestFriend(testApp, alice.session.token, "blocker");
    const refused = await requestFriend(testApp, alice.session.token, "refuser");

    expect(unknown.status).toBe(202);
    expect(blocked.status).toBe(202);
    expect(refused.status).toBe(202);
    const [unknownBody, blockedBody, refusedBody] = await Promise.all([unknown.json(), blocked.json(), refused.json()]);
    expect(unknownBody).toEqual({ status: "requested" });
    expect(blockedBody).toEqual({ status: "requested" });
    expect(refusedBody).toEqual({ status: "requested" });

    // La demande vers le refuseur existe (cachée), mais n'apparaît jamais dans ses entrantes.
    const refuserIncoming = await testApp.app.request("/friend-requests", { headers: authHeader(refuser.session.token) });
    const refuserBody = FriendRequestsResponseSchema.parse(await refuserIncoming.json());
    expect(refuserBody.incoming).toEqual([]);

    // Côté expéditeur, la demande cachée apparaît comme une demande normale (indistinguable, ADR 005).
    const aliceOutgoing = await testApp.app.request("/friend-requests", { headers: authHeader(alice.session.token) });
    const aliceBody = FriendRequestsResponseSchema.parse(await aliceOutgoing.json());
    expect(aliceBody.outgoing.map((r) => r.to.username).sort()).toEqual(["blocker", "refuser"]);
  });

  it("cible = moi-même ⇒ 422 CANNOT_TARGET_SELF", async () => {
    testApp = await createTestApp();
    const alice = await seedUser(testApp, "alice", "alice");
    const res = await requestFriend(testApp, alice.session.token, "alice");
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe("CANNOT_TARGET_SELF");
  });

  it("je bloque la cible ⇒ 409 TARGET_BLOCKED", async () => {
    testApp = await createTestApp();
    const alice = await seedUser(testApp, "alice", "alice");
    const bob = await seedUser(testApp, "bob", "bob");
    await testApp.db.insert(schema.blocks).values({ blockerId: alice.userId, blockedId: bob.userId });

    const res = await requestFriend(testApp, alice.session.token, "bob");
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe("TARGET_BLOCKED");
  });

  it("demande réelle : visible du destinataire, listée en sortant chez l'expéditeur", async () => {
    testApp = await createTestApp();
    const alice = await seedUser(testApp, "alice", "alice");
    const bob = await seedUser(testApp, "bob", "bob");

    const res = await requestFriend(testApp, alice.session.token, "bob");
    expect(res.status).toBe(202);
    expect(CreateFriendRequestResponseSchema.parse(await res.json())).toEqual({ status: "requested" });

    const bobIncoming = FriendRequestsResponseSchema.parse(
      await (await testApp.app.request("/friend-requests", { headers: authHeader(bob.session.token) })).json(),
    );
    expect(bobIncoming.incoming).toHaveLength(1);
    expect(bobIncoming.incoming[0]!.from.username).toBe("alice");
  });

  it("demande inverse en attente et visible ⇒ acceptation automatique", async () => {
    testApp = await createTestApp();
    const alice = await seedUser(testApp, "alice", "alice");
    const bob = await seedUser(testApp, "bob", "bob");

    await requestFriend(testApp, bob.session.token, "alice"); // bob -> alice, en attente
    const res = await requestFriend(testApp, alice.session.token, "bob"); // alice -> bob : acceptation auto
    expect(res.status).toBe(202);

    const friends = FriendsResponseSchema.parse(
      await (await testApp.app.request("/friends", { headers: authHeader(alice.session.token) })).json(),
    );
    expect(friends.friends.map((f) => f.username)).toEqual(["bob"]);

    // Plus aucune demande en attente des deux côtés.
    const bobRequests = FriendRequestsResponseSchema.parse(
      await (await testApp.app.request("/friend-requests", { headers: authHeader(bob.session.token) })).json(),
    );
    expect(bobRequests.incoming).toEqual([]);
    expect(bobRequests.outgoing).toEqual([]);
  });

  it("quota journalier (ADR 007, en base) : au-delà de FRIEND_REQUESTS_PER_DAY ⇒ 429 RATE_LIMITED", async () => {
    testApp = await createTestApp();
    const alice = await seedUser(testApp, "alice", "alice");
    // Seules les demandes réellement créées comptent (pas les pseudos inconnus, ADR 007) : 21 cibles réelles.
    // `resetRateLimits` évite de heurter le débit générique de `/auth/dev` (non testé ici).
    for (let i = 0; i < 21; i++) {
      resetRateLimits();
      await seedUser(testApp, `target${i}`, `target${i}`);
    }
    for (let i = 0; i < 20; i++) {
      const res = await requestFriend(testApp, alice.session.token, `target${i}`);
      expect(res.status).toBe(202);
    }
    const limited = await requestFriend(testApp, alice.session.token, "target20");
    expect(limited.status).toBe(429);
    const body = await limited.json();
    expect(body.error.code).toBe("RATE_LIMITED");
  });

  it("les pseudos inconnus ne consomment pas le quota journalier", async () => {
    testApp = await createTestApp();
    const alice = await seedUser(testApp, "alice", "alice");
    for (let i = 0; i < 25; i++) {
      const res = await requestFriend(testApp, alice.session.token, `inconnu${i}`);
      expect(res.status).toBe(202);
    }
  });
});

describe("Cycle de vie d'une demande d'amitié", () => {
  let testApp: TestApp;

  beforeEach(() => resetRateLimits());
  afterEach(async () => {
    await testApp?.close();
  });

  it("accepter crée l'amitié dans les deux sens et fait disparaître la demande", async () => {
    testApp = await createTestApp();
    const alice = await seedUser(testApp, "alice", "alice");
    const bob = await seedUser(testApp, "bob", "bob");
    await requestFriend(testApp, alice.session.token, "bob");

    const bobRequests = FriendRequestsResponseSchema.parse(
      await (await testApp.app.request("/friend-requests", { headers: authHeader(bob.session.token) })).json(),
    );
    const requestId = bobRequests.incoming[0]!.id;

    const acceptRes = await testApp.app.request(`/friend-requests/${requestId}/accept`, {
      method: "POST",
      headers: authHeader(bob.session.token),
    });
    expect(acceptRes.status).toBe(200);
    const acceptBody = await acceptRes.json();
    expect(acceptBody.friend.username).toBe("alice");

    const aliceFriends = FriendsResponseSchema.parse(
      await (await testApp.app.request("/friends", { headers: authHeader(alice.session.token) })).json(),
    );
    const bobFriends = FriendsResponseSchema.parse(
      await (await testApp.app.request("/friends", { headers: authHeader(bob.session.token) })).json(),
    );
    expect(aliceFriends.friends.map((f) => f.username)).toEqual(["bob"]);
    expect(bobFriends.friends.map((f) => f.username)).toEqual(["alice"]);
  });

  it("accepter une demande qui ne m'est pas adressée ⇒ 404", async () => {
    testApp = await createTestApp();
    const alice = await seedUser(testApp, "alice", "alice");
    const bob = await seedUser(testApp, "bob", "bob");
    const charlie = await seedUser(testApp, "charlie", "charlie");
    await requestFriend(testApp, alice.session.token, "bob");
    const bobRequests = FriendRequestsResponseSchema.parse(
      await (await testApp.app.request("/friend-requests", { headers: authHeader(bob.session.token) })).json(),
    );
    const requestId = bobRequests.incoming[0]!.id;

    const res = await testApp.app.request(`/friend-requests/${requestId}/accept`, {
      method: "POST",
      headers: authHeader(charlie.session.token),
    });
    expect(res.status).toBe(404);
  });

  it("refuser supprime la demande sans créer d'amitié", async () => {
    testApp = await createTestApp();
    const alice = await seedUser(testApp, "alice", "alice");
    const bob = await seedUser(testApp, "bob", "bob");
    await requestFriend(testApp, alice.session.token, "bob");
    const bobRequests = FriendRequestsResponseSchema.parse(
      await (await testApp.app.request("/friend-requests", { headers: authHeader(bob.session.token) })).json(),
    );
    const requestId = bobRequests.incoming[0]!.id;

    const res = await testApp.app.request(`/friend-requests/${requestId}/decline`, {
      method: "POST",
      headers: authHeader(bob.session.token),
    });
    expect(res.status).toBe(204);

    const aliceFriends = FriendsResponseSchema.parse(
      await (await testApp.app.request("/friends", { headers: authHeader(alice.session.token) })).json(),
    );
    expect(aliceFriends.friends).toEqual([]);
  });

  it("annuler ma demande sortante la supprime", async () => {
    testApp = await createTestApp();
    const alice = await seedUser(testApp, "alice", "alice");
    const bob = await seedUser(testApp, "bob", "bob");
    await requestFriend(testApp, alice.session.token, "bob");
    const aliceRequests = FriendRequestsResponseSchema.parse(
      await (await testApp.app.request("/friend-requests", { headers: authHeader(alice.session.token) })).json(),
    );
    const requestId = aliceRequests.outgoing[0]!.id;

    const res = await testApp.app.request(`/friend-requests/${requestId}`, {
      method: "DELETE",
      headers: authHeader(alice.session.token),
    });
    expect(res.status).toBe(204);

    const bobRequests = FriendRequestsResponseSchema.parse(
      await (await testApp.app.request("/friend-requests", { headers: authHeader(bob.session.token) })).json(),
    );
    expect(bobRequests.incoming).toEqual([]);
  });

  it("annuler la demande de quelqu'un d'autre ⇒ 404", async () => {
    testApp = await createTestApp();
    const alice = await seedUser(testApp, "alice", "alice");
    const bob = await seedUser(testApp, "bob", "bob");
    await requestFriend(testApp, alice.session.token, "bob");
    const aliceRequests = FriendRequestsResponseSchema.parse(
      await (await testApp.app.request("/friend-requests", { headers: authHeader(alice.session.token) })).json(),
    );
    const requestId = aliceRequests.outgoing[0]!.id;

    const res = await testApp.app.request(`/friend-requests/${requestId}`, {
      method: "DELETE",
      headers: authHeader(bob.session.token),
    });
    expect(res.status).toBe(404);
  });
});

describe("GET /friends, DELETE /friends/:userId", () => {
  let testApp: TestApp;

  beforeEach(() => resetRateLimits());
  afterEach(async () => {
    await testApp?.close();
  });

  it("liste triée par pseudonyme, avec pas du jour et encouragedToday", async () => {
    const NOW = new Date("2026-09-20T10:00:00Z");
    testApp = await createTestApp({ now: () => NOW });
    const alice = await seedUser(testApp, "alice", "alice");
    const zed = await seedUser(testApp, "zed", "zed");
    const bob = await seedUser(testApp, "bob", "bob");
    await requestFriend(testApp, alice.session.token, "zed");
    await testApp.app.request(
      `/friend-requests/${FriendRequestsResponseSchema.parse(await (await testApp.app.request("/friend-requests", { headers: authHeader(zed.session.token) })).json()).incoming[0]!.id}/accept`,
      { method: "POST", headers: authHeader(zed.session.token) },
    );
    await requestFriend(testApp, alice.session.token, "bob");
    await testApp.app.request(
      `/friend-requests/${FriendRequestsResponseSchema.parse(await (await testApp.app.request("/friend-requests", { headers: authHeader(bob.session.token) })).json()).incoming[0]!.id}/accept`,
      { method: "POST", headers: authHeader(bob.session.token) },
    );
    await seedActivity(testApp, zed.userId, "2026-09-20", 4000);
    await seedActivity(testApp, bob.userId, "2026-09-20", 7000);
    await testApp.db.insert(schema.encouragements).values({
      senderId: alice.userId,
      recipientId: bob.userId,
      messageId: "keep-going",
      senderLocalDate: "2026-09-20",
    });

    const res = await testApp.app.request("/friends", { headers: authHeader(alice.session.token) });
    const body = FriendsResponseSchema.parse(await res.json());
    expect(body.friends.map((f) => f.username)).toEqual(["bob", "zed"]);
    const bobEntry = body.friends.find((f) => f.username === "bob")!;
    expect(bobEntry.todaySteps).toBe(7000);
    expect(bobEntry.encouragedToday).toBe(true);
    const zedEntry = body.friends.find((f) => f.username === "zed")!;
    expect(zedEntry.todaySteps).toBe(4000);
    expect(zedEntry.encouragedToday).toBe(false);
  });

  it("supprimer une amitié la retire des deux côtés ; sans lien ⇒ 404", async () => {
    testApp = await createTestApp();
    const alice = await seedUser(testApp, "alice", "alice");
    const bob = await seedUser(testApp, "bob", "bob");
    await requestFriend(testApp, alice.session.token, "bob");
    const bobRequests = FriendRequestsResponseSchema.parse(
      await (await testApp.app.request("/friend-requests", { headers: authHeader(bob.session.token) })).json(),
    );
    await testApp.app.request(`/friend-requests/${bobRequests.incoming[0]!.id}/accept`, {
      method: "POST",
      headers: authHeader(bob.session.token),
    });

    const del = await testApp.app.request(`/friends/${alice.userId}`, { method: "DELETE", headers: authHeader(bob.session.token) });
    expect(del.status).toBe(204);

    const aliceFriends = FriendsResponseSchema.parse(
      await (await testApp.app.request("/friends", { headers: authHeader(alice.session.token) })).json(),
    );
    expect(aliceFriends.friends).toEqual([]);

    const again = await testApp.app.request(`/friends/${alice.userId}`, { method: "DELETE", headers: authHeader(bob.session.token) });
    expect(again.status).toBe(404);
  });
});

describe("GET /friends/:userId/activity (CA8)", () => {
  let testApp: TestApp;

  beforeEach(() => resetRateLimits());
  afterEach(async () => {
    await testApp?.close();
  });

  it("non-ami ⇒ 404, jamais 403", async () => {
    testApp = await createTestApp();
    const alice = await seedUser(testApp, "alice", "alice");
    const bob = await seedUser(testApp, "bob", "bob");
    const res = await testApp.app.request(`/friends/${bob.userId}/activity`, { headers: authHeader(alice.session.token) });
    expect(res.status).toBe(404);
  });

  it("ami : activité visible, calories masquées si show_calories = false", async () => {
    const NOW = new Date("2026-09-20T10:00:00Z");
    testApp = await createTestApp({ now: () => NOW });
    const alice = await seedUser(testApp, "alice", "alice");
    const bob = await seedUser(testApp, "bob", "bob");
    await requestFriend(testApp, alice.session.token, "bob");
    const bobRequests = FriendRequestsResponseSchema.parse(
      await (await testApp.app.request("/friend-requests", { headers: authHeader(bob.session.token) })).json(),
    );
    await testApp.app.request(`/friend-requests/${bobRequests.incoming[0]!.id}/accept`, {
      method: "POST",
      headers: authHeader(bob.session.token),
    });
    await testApp.db.update(schema.userSettings).set({ showCalories: false }).where(eq(schema.userSettings.userId, bob.userId));
    await testApp.db.insert(schema.dailyActivity).values({ userId: bob.userId, date: "2026-09-20", steps: 6000, activeCalories: 250, timeZone: "Europe/Paris" });

    const res = await testApp.app.request(`/friends/${bob.userId}/activity`, { headers: authHeader(alice.session.token) });
    expect(res.status).toBe(200);
    const body = FriendActivityResponseSchema.parse(await res.json());
    expect(body.user.username).toBe("bob");
    expect(body.today).toEqual({ date: "2026-09-20", steps: 6000, activeCalories: null });
  });
});

describe("Notifications de demande d'amitié (ADR 004)", () => {
  let testApp: TestApp;
  let transport: ConsoleTransport;
  let deviceSeed = 0;

  beforeEach(() => {
    resetRateLimits();
    transport = new ConsoleTransport();
    deviceSeed = 0;
  });
  afterEach(async () => {
    await testApp?.close();
  });

  async function registerDevice(token: string) {
    deviceSeed += 1;
    const res = await testApp.app.request("/me/devices", {
      method: "PUT",
      headers: authHeader(token),
      body: JSON.stringify({ apnsToken: deviceSeed.toString(16).padStart(64, "0"), environment: "sandbox" }),
    });
    expect(res.status).toBe(204);
  }

  it("demande réelle : notifie le destinataire (friend_request_received)", async () => {
    const NOW = new Date("2026-09-20T10:00:00Z"); // midi à Paris, hors heures silencieuses
    testApp = await createTestApp({ now: () => NOW, pushTransport: transport });
    const alice = await seedUser(testApp, "alice", "alice");
    const bob = await seedUser(testApp, "bob", "bob");
    await registerDevice(bob.session.token);

    await requestFriend(testApp, alice.session.token, "bob");

    expect(transport.outbox).toHaveLength(1);
    expect(transport.outbox[0]!.notification).toMatchObject({
      recipientId: bob.userId,
      type: "friend_request_received",
      payload: { fromUserId: alice.userId, fromUsername: "alice" },
    });
  });

  it("demande cachée (cible bloquante) : jamais notifiée", async () => {
    const NOW = new Date("2026-09-20T10:00:00Z");
    testApp = await createTestApp({ now: () => NOW, pushTransport: transport });
    const alice = await seedUser(testApp, "alice", "alice");
    const bob = await seedUser(testApp, "bob", "bob");
    await registerDevice(bob.session.token);
    await testApp.db.insert(schema.blocks).values({ blockerId: bob.userId, blockedId: alice.userId });

    await requestFriend(testApp, alice.session.token, "bob");

    expect(transport.outbox).toHaveLength(0);
  });

  it("accepter notifie l'expéditeur (friend_request_accepted)", async () => {
    const NOW = new Date("2026-09-20T10:00:00Z");
    testApp = await createTestApp({ now: () => NOW, pushTransport: transport });
    const alice = await seedUser(testApp, "alice", "alice");
    const bob = await seedUser(testApp, "bob", "bob");
    await registerDevice(alice.session.token);
    await requestFriend(testApp, alice.session.token, "bob");
    transport.outbox.length = 0; // ignore la notification de demande reçue

    const bobRequests = FriendRequestsResponseSchema.parse(
      await (await testApp.app.request("/friend-requests", { headers: authHeader(bob.session.token) })).json(),
    );
    await testApp.app.request(`/friend-requests/${bobRequests.incoming[0]!.id}/accept`, {
      method: "POST",
      headers: authHeader(bob.session.token),
    });

    expect(transport.outbox).toHaveLength(1);
    expect(transport.outbox[0]!.notification).toMatchObject({
      recipientId: alice.userId,
      type: "friend_request_accepted",
      payload: { fromUserId: bob.userId, fromUsername: "bob" },
    });
  });

  it("acceptation automatique (demande inverse) : notifie l'expéditeur d'origine", async () => {
    const NOW = new Date("2026-09-20T10:00:00Z");
    testApp = await createTestApp({ now: () => NOW, pushTransport: transport });
    const alice = await seedUser(testApp, "alice", "alice");
    const bob = await seedUser(testApp, "bob", "bob");
    await registerDevice(bob.session.token);
    await requestFriend(testApp, bob.session.token, "alice"); // bob -> alice, en attente
    transport.outbox.length = 0;

    await requestFriend(testApp, alice.session.token, "bob"); // alice -> bob : acceptation auto

    expect(transport.outbox).toHaveLength(1);
    expect(transport.outbox[0]!.notification).toMatchObject({
      recipientId: bob.userId,
      type: "friend_request_accepted",
      payload: { fromUserId: alice.userId, fromUsername: "alice" },
    });
  });
});

describe("MAX_FRIENDS (limite injectable, demandée par le lead)", () => {
  let testApp: TestApp;

  beforeEach(() => resetRateLimits());
  afterEach(async () => {
    await testApp?.close();
  });

  it("accepter manuellement refusé (409 FRIEND_LIMIT_REACHED) si le destinataire est déjà à la limite", async () => {
    testApp = await createTestApp({ maxFriends: 2 });
    const alice = await seedUser(testApp, "alice", "alice");
    const bob = await seedUser(testApp, "bob", "bob");
    const charlie = await seedUser(testApp, "charlie", "charlie");
    const dave = await seedUser(testApp, "dave", "dave");
    await seedFriendship(testApp, alice.userId, bob.userId);
    await seedFriendship(testApp, alice.userId, charlie.userId); // alice déjà à la limite (2)

    await requestFriend(testApp, dave.session.token, "alice");
    const aliceRequests = FriendRequestsResponseSchema.parse(
      await (await testApp.app.request("/friend-requests", { headers: authHeader(alice.session.token) })).json(),
    );
    const res = await testApp.app.request(`/friend-requests/${aliceRequests.incoming[0]!.id}/accept`, {
      method: "POST",
      headers: authHeader(alice.session.token),
    });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe("FRIEND_LIMIT_REACHED");

    // Ni amitié créée, ni demande consommée.
    const aliceFriends = FriendsResponseSchema.parse(
      await (await testApp.app.request("/friends", { headers: authHeader(alice.session.token) })).json(),
    );
    expect(aliceFriends.friends.map((f) => f.username).sort()).toEqual(["bob", "charlie"]);
  });

  it("accepter manuellement refusé si l'expéditeur (pas le destinataire) est à la limite", async () => {
    testApp = await createTestApp({ maxFriends: 2 });
    const alice = await seedUser(testApp, "alice", "alice");
    const bob = await seedUser(testApp, "bob", "bob");
    const charlie = await seedUser(testApp, "charlie", "charlie");
    const dave = await seedUser(testApp, "dave", "dave");
    await seedFriendship(testApp, dave.userId, bob.userId);
    await seedFriendship(testApp, dave.userId, charlie.userId); // dave (expéditeur) déjà à la limite

    await requestFriend(testApp, dave.session.token, "alice");
    const aliceRequests = FriendRequestsResponseSchema.parse(
      await (await testApp.app.request("/friend-requests", { headers: authHeader(alice.session.token) })).json(),
    );
    const res = await testApp.app.request(`/friend-requests/${aliceRequests.incoming[0]!.id}/accept`, {
      method: "POST",
      headers: authHeader(alice.session.token),
    });
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("FRIEND_LIMIT_REACHED");
  });

  it("acceptation croisée (demande inverse) refusée en silence à la limite : reste en attente, pas d'amitié créée", async () => {
    testApp = await createTestApp({ maxFriends: 2 });
    const alice = await seedUser(testApp, "alice", "alice");
    const bob = await seedUser(testApp, "bob", "bob");
    const charlie = await seedUser(testApp, "charlie", "charlie");
    const dave = await seedUser(testApp, "dave", "dave");
    await seedFriendship(testApp, alice.userId, bob.userId);
    await seedFriendship(testApp, alice.userId, charlie.userId); // alice déjà à la limite (2)

    await requestFriend(testApp, dave.session.token, "alice"); // dave -> alice, en attente
    const res = await requestFriend(testApp, alice.session.token, "dave"); // alice -> dave : tenterait l'acceptation auto
    expect(res.status).toBe(202); // réponse neutre inchangée (ADR 005), même refusée en interne
    expect(await res.json()).toEqual({ status: "requested" });

    const aliceFriends = FriendsResponseSchema.parse(
      await (await testApp.app.request("/friends", { headers: authHeader(alice.session.token) })).json(),
    );
    expect(aliceFriends.friends.map((f) => f.username).sort()).toEqual(["bob", "charlie"]); // dave absent

    // La demande de dave reste en attente (ni acceptée, ni supprimée).
    const daveRequests = FriendRequestsResponseSchema.parse(
      await (await testApp.app.request("/friend-requests", { headers: authHeader(dave.session.token) })).json(),
    );
    expect(daveRequests.outgoing.map((r) => r.to.username)).toEqual(["alice"]);
  });

  it("avec la limite par défaut (200), l'acceptation fonctionne normalement", async () => {
    testApp = await createTestApp();
    const alice = await seedUser(testApp, "alice", "alice");
    const bob = await seedUser(testApp, "bob", "bob");
    await requestFriend(testApp, alice.session.token, "bob");
    const bobRequests = FriendRequestsResponseSchema.parse(
      await (await testApp.app.request("/friend-requests", { headers: authHeader(bob.session.token) })).json(),
    );
    const res = await testApp.app.request(`/friend-requests/${bobRequests.incoming[0]!.id}/accept`, {
      method: "POST",
      headers: authHeader(bob.session.token),
    });
    expect(res.status).toBe(200);
  });
});
