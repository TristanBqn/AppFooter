// CA11 : bloquer supprime l'amitié et les demandes en cours, et empêche toute nouvelle
// interaction. Comptes du pool (tests/e2e/global-setup.ts) :
// - dave/erin : deviennent amis ici, puis dave bloque erin (amitié détruite par le blocage) ;
// - frank/grace : demande en attente (non acceptée) supprimée par le blocage.
import { expect, test } from "@playwright/test";
import type { ApiError, BlocksResponse, FriendsResponse } from "@app/contracts";
import {
  authHeader,
  becomeFriends,
  block,
  loadPool,
  sendEncouragement,
  sendFriendRequest,
  type Actor,
} from "./support/api";

test.describe("CA11 : blocage détruit l'amitié et les demandes en cours", () => {
  let dave: Actor;
  let erin: Actor;
  let frank: Actor;
  let grace: Actor;

  test.beforeAll(async ({ request }) => {
    const pool = loadPool();
    dave = pool.dave;
    erin = pool.erin;
    frank = pool.frank;
    grace = pool.grace;
    await becomeFriends(request, dave, erin);
  });

  test("bloquer un ami supprime l'amitié dans les deux sens", async ({ request }) => {
    const res = await request.post("/blocks", { headers: authHeader(dave.token), data: { userId: erin.userId } });
    expect(res.status()).toBe(204);

    const daveFriends = (await (await request.get("/friends", { headers: authHeader(dave.token) })).json()) as FriendsResponse;
    expect(daveFriends.friends.some((f) => f.userId === erin.userId)).toBe(false);

    const erinFriends = (await (await request.get("/friends", { headers: authHeader(erin.token) })).json()) as FriendsResponse;
    expect(erinFriends.friends.some((f) => f.userId === dave.userId)).toBe(false);
  });

  test("après blocage : plus d'activité, plus d'encouragement possible pour le bloqué", async ({ request }) => {
    const activity = await request.get(`/friends/${dave.userId}/activity`, { headers: authHeader(erin.token) });
    expect(activity.status()).toBe(404);

    const encouragement = await sendEncouragement(request, erin, dave.userId, "bravo");
    expect(encouragement.status()).toBe(404);
  });

  test("le bloqué peut renvoyer une demande (réponse neutre) mais elle reste cachée", async ({ request }) => {
    const res = await sendFriendRequest(request, erin, dave.username);
    expect(res.status()).toBe(202);
    expect(await res.json()).toEqual({ status: "requested" });

    const daveIncoming = await request.get("/friend-requests", { headers: authHeader(dave.token) });
    const { incoming } = (await daveIncoming.json()) as { incoming: { from: { userId: string } }[] };
    expect(incoming.some((r) => r.from.userId === erin.userId)).toBe(false);
  });

  test("le bloqueur ne peut plus redemander l'ami : 409 TARGET_BLOCKED", async ({ request }) => {
    const res = await sendFriendRequest(request, dave, erin.username);
    expect(res.status()).toBe(409);
    expect(((await res.json()) as ApiError).error.code).toBe("TARGET_BLOCKED");
  });

  test("blocage idempotent, auto-blocage refusé, déblocage puis 404 si répété", async ({ request }) => {
    const again = await request.post("/blocks", { headers: authHeader(dave.token), data: { userId: erin.userId } });
    expect(again.status()).toBe(204);

    const self = await request.post("/blocks", { headers: authHeader(dave.token), data: { userId: dave.userId } });
    expect(self.status()).toBe(422);
    expect(((await self.json()) as ApiError).error.code).toBe("CANNOT_TARGET_SELF");

    const unblock = await request.delete(`/blocks/${erin.userId}`, { headers: authHeader(dave.token) });
    expect(unblock.status()).toBe(204);

    const list = (await (await request.get("/blocks", { headers: authHeader(dave.token) })).json()) as BlocksResponse;
    expect(list.blocked.some((b) => b.userId === erin.userId)).toBe(false);

    const unblockAgain = await request.delete(`/blocks/${erin.userId}`, { headers: authHeader(dave.token) });
    expect(unblockAgain.status()).toBe(404);
  });

  test("bloquer supprime une demande d'amitié encore en attente (non acceptée), dans les deux sens", async ({
    request,
  }) => {
    const sent = await sendFriendRequest(request, frank, grace.username);
    expect(sent.status()).toBe(202);

    const beforeBlock = await request.get("/friend-requests", { headers: authHeader(grace.token) });
    const { incoming: incomingBefore } = (await beforeBlock.json()) as { incoming: { from: { userId: string } }[] };
    expect(incomingBefore.some((r) => r.from.userId === frank.userId)).toBe(true);

    const blockRes = await request.post("/blocks", { headers: authHeader(grace.token), data: { userId: frank.userId } });
    expect(blockRes.status()).toBe(204);

    const afterBlock = await request.get("/friend-requests", { headers: authHeader(grace.token) });
    const { incoming: incomingAfter } = (await afterBlock.json()) as { incoming: { from: { userId: string } }[] };
    expect(incomingAfter.some((r) => r.from.userId === frank.userId)).toBe(false);

    const frankOutgoing = await request.get("/friend-requests", { headers: authHeader(frank.token) });
    const { outgoing } = (await frankOutgoing.json()) as { outgoing: { to: { userId: string } }[] };
    expect(outgoing.some((r) => r.to.userId === grace.userId)).toBe(false);
  });
});
