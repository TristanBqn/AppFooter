// CA7 : l'ajout d'ami exige le pseudonyme exact ; une demande vers un utilisateur qui m'a bloqué
// ou qui n'accepte pas les demandes reçoit exactement la même réponse qu'une demande normale
// (ADR 005, demande « cachée »). Comptes du pool (tests/e2e/global-setup.ts) : henry (expéditeur),
// iris (bloque henry avant sa demande), jules (n'accepte pas les demandes, puis bloqué par henry).
import { expect, test } from "@playwright/test";
import type { ApiError, CreateFriendRequestResponse } from "@app/contracts";
import { authHeader, block, loadPool, randomUsername, sendFriendRequest, updateSettings, type Actor } from "./support/api";

test.describe("CA7 : demandes d'amitié — réponse neutre et demandes cachées", () => {
  let henry: Actor;
  let iris: Actor;
  let jules: Actor;

  test.beforeAll(() => {
    const pool = loadPool();
    henry = pool.henry;
    iris = pool.iris;
    jules = pool.jules;
  });

  test("pseudo inconnu ⇒ 202 { status: 'requested' }, rien n'est créé", async ({ request }) => {
    const res = await sendFriendRequest(request, henry, randomUsername("personne"));
    expect(res.status()).toBe(202);
    expect(await res.json()).toEqual({ status: "requested" });
  });

  test("cible qui m'a bloqué ⇒ même réponse neutre, demande cachée (invisible pour elle)", async ({ request }) => {
    await block(request, iris, henry.userId);

    const res = await sendFriendRequest(request, henry, iris.username);
    expect(res.status()).toBe(202);
    expect((await res.json()) as CreateFriendRequestResponse).toEqual({ status: "requested" });

    const irisIncoming = await request.get("/friend-requests", { headers: authHeader(iris.token) });
    const { incoming } = (await irisIncoming.json()) as { incoming: { from: { userId: string } }[] };
    expect(incoming.some((r) => r.from.userId === henry.userId)).toBe(false);

    // Visible pour l'expéditeur seul, indistinguable d'une demande simplement en attente.
    const henryOutgoing = await request.get("/friend-requests", { headers: authHeader(henry.token) });
    const { outgoing } = (await henryOutgoing.json()) as { outgoing: { to: { userId: string } }[] };
    expect(outgoing.some((r) => r.to.userId === iris.userId)).toBe(true);
  });

  test("cible qui n'accepte pas les demandes ⇒ même réponse neutre, demande cachée", async ({ request }) => {
    await updateSettings(request, jules, { privacy: { acceptFriendRequests: false } });

    const res = await sendFriendRequest(request, henry, jules.username);
    expect(res.status()).toBe(202);
    expect(await res.json()).toEqual({ status: "requested" });

    const julesIncoming = await request.get("/friend-requests", { headers: authHeader(jules.token) });
    const { incoming } = (await julesIncoming.json()) as { incoming: { from: { userId: string } }[] };
    expect(incoming.some((r) => r.from.userId === henry.userId)).toBe(false);
  });

  test("cible = moi-même ⇒ 422 CANNOT_TARGET_SELF", async ({ request }) => {
    const res = await sendFriendRequest(request, henry, henry.username);
    expect(res.status()).toBe(422);
    const body = (await res.json()) as ApiError;
    expect(body.error.code).toBe("CANNOT_TARGET_SELF");
  });

  test("si JE bloque la cible ⇒ 409 TARGET_BLOCKED (jamais de réponse neutre dans ce sens)", async ({ request }) => {
    await block(request, henry, jules.userId);
    const res = await sendFriendRequest(request, henry, jules.username);
    expect(res.status()).toBe(409);
    const body = (await res.json()) as ApiError;
    expect(body.error.code).toBe("TARGET_BLOCKED");
  });
});
