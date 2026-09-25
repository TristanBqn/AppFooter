// CA12 : après suppression du compte, plus aucune ligne liée à l'utilisateur en base et la
// session est invalidée. Vérifié en boîte noire (HTTP) par des effets observables : l'ancien
// jeton est refusé, l'amitié disparaît côté ami restant, et l'identité (pseudo + apple_sub/dev)
// redevient totalement libre — preuve indirecte mais concrète du nettoyage en cascade (la
// vérification exhaustive « 0 ligne dans toutes les tables » est du ressort du test d'intégration
// apps/api/src/modules/me/*.test.ts, qui a accès direct à la base).
import { expect, test } from "@playwright/test";
import { authHeader, becomeFriends, devSignIn, loadPool, randomDevUserKey, signInWithUsername, syncToday } from "./support/api";

test.describe("CA12 : suppression du compte", () => {
  test("jeton invalidé, amitié supprimée côté ami restant, identité entièrement libérée", async ({ request }) => {
    const dave = loadPool().dave;
    const devUserKey = randomDevUserKey("ca12del");
    const victim = await signInWithUsername(request, devUserKey, "ca12del");

    await becomeFriends(request, victim, dave);
    await syncToday(request, victim, 1234);

    const del = await request.delete("/me", { headers: authHeader(victim.token) });
    expect(del.status()).toBe(204);

    // Session invalidée : l'ancien jeton ne donne plus accès à rien.
    const meAfter = await request.get("/me", { headers: authHeader(victim.token) });
    expect(meAfter.status()).toBe(401);
    expect(((await meAfter.json()) as { error: { code: string } }).error.code).toBe("UNAUTHENTICATED");

    // Amitié disparue côté ami restant (cascade FK, ADR : toutes les FK vers users.id sont ON DELETE CASCADE).
    const daveFriends = await request.get("/friends", { headers: authHeader(dave.token) });
    const { friends } = (await daveFriends.json()) as { friends: { userId: string }[] };
    expect(friends.some((f) => f.userId === victim.userId)).toBe(false);

    // Le pseudonyme redevient disponible : preuve que la ligne `users` (et son index unique
    // lower(username)) a bien été supprimée, pas seulement désactivée.
    const other = await devSignIn(request, randomDevUserKey("ca12reuse"));
    const reuse = await request.put("/me/username", {
      headers: authHeader(other.session.token),
      data: { username: victim.username },
    });
    expect(reuse.status()).toBe(200);

    // Même devUserKey (même apple_sub `dev:<clé>`) ⇒ nouvelle identité, needsUsername de nouveau
    // vrai : la ligne précédente n'a pas survécu à la suppression.
    const resignIn = await devSignIn(request, devUserKey);
    expect(resignIn.needsUsername).toBe(true);
    expect(resignIn.userId).not.toBe(victim.userId);
  });
});
