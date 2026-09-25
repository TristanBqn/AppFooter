// CA1 : sans session valide, toute route hors PUBLIC_ROUTES renvoie 401 ; les routes publiques
// répondent sans jeton. Couverture exhaustive déjà en intégration (apps/api/src/auth-guard.test.ts) ;
// ce test E2E vérifie le comportement bout en bout sur la vraie pile HTTP (port 4000).
import { expect, test } from "@playwright/test";
import { authHeader, randomDevUserKey } from "./support/api";

test.describe("CA1 : garde d'authentification", () => {
  test("les routes publiques répondent sans jeton", async ({ request }) => {
    const health = await request.get("/health");
    expect(health.status()).toBe(200);
    expect(await health.json()).toEqual({ status: "ok" });

    const privacy = await request.get("/privacy");
    expect(privacy.status()).toBe(200);

    const signIn = await request.post("/auth/dev", { data: { devUserKey: randomDevUserKey("ca1") } });
    expect(signIn.status()).toBe(200);
  });

  test("une route protégée sans jeton renvoie 401 UNAUTHENTICATED", async ({ request }) => {
    const res = await request.get("/me");
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("UNAUTHENTICATED");
  });

  test("un jeton invalide est refusé (401)", async ({ request }) => {
    const res = await request.get("/me", { headers: authHeader("jeton-invalide") });
    expect(res.status()).toBe(401);
  });

  test("une autre route protégée (classement) exige aussi une session", async ({ request }) => {
    const res = await request.get("/leaderboards/daily");
    expect(res.status()).toBe(401);
  });

  test("un jeton valide donne accès à une route protégée", async ({ request }) => {
    const signIn = await request.post("/auth/dev", { data: { devUserKey: randomDevUserKey("ca1ok") } });
    const { session } = await signIn.json();
    const me = await request.get("/me", { headers: authHeader(session.token) });
    expect(me.status()).toBe(200);
  });
});
