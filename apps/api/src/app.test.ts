import { ApiErrorSchema } from "@app/contracts";
import { afterEach, describe, expect, it } from "vitest";
import { AppError } from "./errors";
import { createTestApp, type TestApp } from "./test-support";

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

  it("route publique inconnue ⇒ 404 avec l'enveloppe d'erreur du contrat", async () => {
    testApp = await createTestApp();
    // GET /privacy est publique (PUBLIC_ROUTES) mais pas encore implémentée (B11) : l'authentification
    // est bien contournée, mais aucun handler n'est monté ⇒ 404, pas 401.
    const res = await testApp.app.request("/privacy");
    expect(res.status).toBe(404);
    const body = ApiErrorSchema.parse(await res.json());
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("AppError levée par une route ⇒ enveloppe et statut du contrat", async () => {
    testApp = await createTestApp();
    // /privacy est publique (PUBLIC_ROUTES) mais pas encore implémentée (B11) : on l'utilise ici
    // comme route de test pour éviter d'ajouter une dépendance à l'authentification.
    testApp.app.get("/privacy", () => {
      throw new AppError("VALIDATION_ERROR", "Champ invalide", [{ path: "username", message: "requis" }]);
    });
    const res = await testApp.app.request("/privacy");
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
    testApp.app.get("/privacy", () => {
      throw new Error("détail sensible de la pile");
    });
    const res = await testApp.app.request("/privacy");
    expect(res.status).toBe(500);
    const body = ApiErrorSchema.parse(await res.json());
    expect(body.error.code).toBe("INTERNAL_ERROR");
    expect(body.error.message).not.toMatch(/détail sensible/);
  });
});
