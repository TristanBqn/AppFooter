// CA8 : l'activité d'un utilisateur n'est lisible que par lui et ses amis acceptés (jamais 403,
// toujours 404, ADR 005) ; calories masquées si le paramètre le demande. Comptes du pool
// (tests/e2e/global-setup.ts) : alice-bob déjà amis, dave reste étranger à alice.
import { expect, test } from "@playwright/test";
import type { ApiError, FriendActivityResponse } from "@app/contracts";
import { authHeader, becomeFriends, loadPool, syncToday, updateSettings, type Actor } from "./support/api";

test.describe("CA8 : activité d'un ami", () => {
  let alice: Actor;
  let bob: Actor;
  let dave: Actor;

  // Amitié établie ici (idempotente) plutôt que supposée acquise d'un autre fichier de spec :
  // ce fichier reste exécutable seul.
  test.beforeAll(async ({ request }) => {
    const pool = loadPool();
    alice = pool.alice;
    bob = pool.bob;
    dave = pool.dave;
    await becomeFriends(request, alice, bob);
    await syncToday(request, bob, 4000, 250);
  });

  test("un ami voit les pas et les calories par défaut", async ({ request }) => {
    const res = await request.get(`/friends/${bob.userId}/activity`, { headers: authHeader(alice.token) });
    expect(res.status()).toBe(200);
    const body = (await res.json()) as FriendActivityResponse;
    expect(body.user.userId).toBe(bob.userId);
    expect(body.today.steps).toBe(4000);
    expect(body.today.activeCalories).toBe(250);
  });

  test("calories masquées par l'ami ⇒ null pour l'observateur, pas toujours visibles", async ({ request }) => {
    await updateSettings(request, bob, { privacy: { showCalories: false } });

    const res = await request.get(`/friends/${bob.userId}/activity`, { headers: authHeader(alice.token) });
    expect(res.status()).toBe(200);
    const body = (await res.json()) as FriendActivityResponse;
    expect(body.today.steps).toBe(4000);
    expect(body.today.activeCalories).toBeNull();
  });

  test("un non-ami (étranger) reçoit 404, jamais 403", async ({ request }) => {
    const res = await request.get(`/friends/${bob.userId}/activity`, { headers: authHeader(dave.token) });
    expect(res.status()).toBe(404);
    const body = (await res.json()) as ApiError;
    expect(body.error.code).toBe("NOT_FOUND");
  });

  test("se demander soi-même via /friends/:userId ⇒ 404 (pas une ressource « ami »)", async ({ request }) => {
    const res = await request.get(`/friends/${alice.userId}/activity`, { headers: authHeader(alice.token) });
    expect(res.status()).toBe(404);
  });
});
