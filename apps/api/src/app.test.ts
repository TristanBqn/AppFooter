import { ApiErrorSchema, SignInResponseSchema } from "@app/contracts";
import { afterEach, describe, expect, it } from "vitest";
import { AppError } from "./errors";
import { createTestApp, type TestApp } from "./test-support";

// Les routes de test (`/scratch-*`) ne sont pas publiques : un jeton valide est requis pour
// passer le garde d'authentification global avant d'atteindre le handler testé ici.
async function authHeader(testApp: TestApp): Promise<Record<string, string>> {
  const res = await testApp.app.request("/auth/dev", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ devUserKey: "app-test" }),
  });
  const { session } = SignInResponseSchema.parse(await res.json());
  return { authorization: `Bearer ${session.token}` };
}

describe("app", () => {
  let testApp: TestApp;

  afterEach(async () => {
    await testApp?.close();
  });

  it("GET /health répond 200 { status: 'ok' } sans authentification", async () => {
    testApp = await createTestApp();
    const res = await testApp.app.request("/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });

  it("route inconnue non publique ⇒ 401 (authentification vérifiée avant le routage, CA1)", async () => {
    testApp = await createTestApp();
    const res = await testApp.app.request("/route-inexistante");
    expect(res.status).toBe(401);
  });

  // Les 4 PUBLIC_ROUTES (health, privacy, auth/apple, auth/dev) ont toutes un handler depuis B11 :
  // le cas « route publique reconnue mais pas encore montée ⇒ 404 » n'est plus reproductible tel
  // quel. La propriété (l'authentification est contournée puis le routage normal s'applique) reste
  // exercée par tout appel sans jeton à ces routes ailleurs dans la suite (ex. GET /privacy, /health).

  it("AppError levée par une route ⇒ enveloppe et statut du contrat", async () => {
    testApp = await createTestApp();
    testApp.app.get("/scratch-app-error", () => {
      throw new AppError("VALIDATION_ERROR", "Champ invalide", [{ path: "username", message: "requis" }]);
    });
    const res = await testApp.app.request("/scratch-app-error", { headers: await authHeader(testApp) });
    expect(res.status).toBe(400);
    const body = ApiErrorSchema.parse(await res.json());
    expect(body.error).toEqual({
      code: "VALIDATION_ERROR",
      message: "Champ invalide",
      issues: [{ path: "username", message: "requis" }],
    });
  });

  it("erreur non gérée ⇒ 500 INTERNAL_ERROR sans détail interne", async () => {
    testApp = await createTestApp();
    testApp.app.get("/scratch-internal-error", () => {
      throw new Error("détail sensible de la pile");
    });
    const res = await testApp.app.request("/scratch-internal-error", { headers: await authHeader(testApp) });
    expect(res.status).toBe(500);
    const body = ApiErrorSchema.parse(await res.json());
    expect(body.error.code).toBe("INTERNAL_ERROR");
    expect(body.error.message).not.toMatch(/détail sensible/);
  });
});
