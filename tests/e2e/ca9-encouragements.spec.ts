// CA9 : un 2ᵉ encouragement au même ami le même jour est refusé (429) ; aucun texte libre accepté
// par l'API. Comptes du pool (tests/e2e/global-setup.ts) : alice-carol déjà amis, dave étranger.
import { expect, test } from "@playwright/test";
import type { ApiError, ReceivedEncouragementsResponse, SendEncouragementResponse } from "@app/contracts";
import { authHeader, becomeFriends, loadPool, sendEncouragement, type Actor } from "./support/api";

test.describe("CA9 : encouragements", () => {
  let alice: Actor;
  let carol: Actor;
  let dave: Actor;

  // Amitié établie ici (idempotente) plutôt que supposée acquise d'un autre fichier de spec.
  test.beforeAll(async ({ request }) => {
    const pool = loadPool();
    alice = pool.alice;
    carol = pool.carol;
    dave = pool.dave;
    await becomeFriends(request, alice, carol);
  });

  test("premier encouragement du jour accepté, second refusé (429 ENCOURAGEMENT_LIMIT)", async ({ request }) => {
    const first = await sendEncouragement(request, alice, carol.userId, "bravo");
    expect(first.status()).toBe(200);
    const firstBody = (await first.json()) as SendEncouragementResponse;
    expect(firstBody.id).toBeTruthy();

    const second = await sendEncouragement(request, alice, carol.userId, "inspiring");
    expect(second.status()).toBe(429);
    const secondBody = (await second.json()) as ApiError;
    expect(secondBody.error.code).toBe("ENCOURAGEMENT_LIMIT");

    const received = await request.get("/encouragements/received", { headers: authHeader(carol.token) });
    const { encouragements } = (await received.json()) as ReceivedEncouragementsResponse;
    expect(encouragements.filter((e) => e.from.userId === alice.userId)).toHaveLength(1);
    expect(encouragements[0]!.messageId).toBe("bravo");
  });

  test("encouragement à un non-ami ⇒ 404 NOT_FOUND", async ({ request }) => {
    const res = await sendEncouragement(request, alice, dave.userId, "bravo");
    expect(res.status()).toBe(404);
    const body = (await res.json()) as ApiError;
    expect(body.error.code).toBe("NOT_FOUND");
  });

  test("aucun texte libre accepté : clé inconnue ou messageId hors catalogue ⇒ 400 VALIDATION_ERROR", async ({
    request,
  }) => {
    const freeText = await request.post("/encouragements", {
      headers: authHeader(alice.token),
      data: { toUserId: carol.userId, text: "coucou, comment vas-tu ?" },
    });
    expect(freeText.status()).toBe(400);
    expect(((await freeText.json()) as ApiError).error.code).toBe("VALIDATION_ERROR");

    const badMessageId = await request.post("/encouragements", {
      headers: authHeader(alice.token),
      data: { toUserId: carol.userId, messageId: "texte_libre_invente" },
    });
    expect(badMessageId.status()).toBe(400);
    expect(((await badMessageId.json()) as ApiError).error.code).toBe("VALIDATION_ERROR");
  });
});
