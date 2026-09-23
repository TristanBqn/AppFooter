import { ApiErrorSchema } from "@app/contracts";
import { createDb, type DbHandle } from "@app/db";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "./app";
import { AppError } from "./errors";

describe("app", () => {
  let handle: DbHandle;

  beforeEach(async () => {
    handle = await createDb("");
  });
  afterEach(async () => {
    await handle.close();
  });

  it("GET /health répond 200 { status: 'ok' }", async () => {
    const app = createApp({ db: handle.db });
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });

  it("route inconnue ⇒ 404 avec l'enveloppe d'erreur du contrat", async () => {
    const app = createApp({ db: handle.db });
    const res = await app.request("/route-inexistante");
    expect(res.status).toBe(404);
    const body = ApiErrorSchema.parse(await res.json());
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("AppError levée par une route ⇒ enveloppe et statut du contrat", async () => {
    const app = createApp({ db: handle.db });
    app.get("/boom", () => {
      throw new AppError("VALIDATION_ERROR", "Champ invalide", [{ path: "username", message: "requis" }]);
    });
    const res = await app.request("/boom");
    expect(res.status).toBe(400);
    const body = ApiErrorSchema.parse(await res.json());
    expect(body.error).toEqual({
      code: "VALIDATION_ERROR",
      message: "Champ invalide",
      issues: [{ path: "username", message: "requis" }],
    });
  });

  it("erreur non gérée ⇒ 500 INTERNAL_ERROR sans détail interne", async () => {
    const app = createApp({ db: handle.db });
    app.get("/crash", () => {
      throw new Error("détail sensible de la pile");
    });
    const res = await app.request("/crash");
    expect(res.status).toBe(500);
    const body = ApiErrorSchema.parse(await res.json());
    expect(body.error.code).toBe("INTERNAL_ERROR");
    expect(body.error.message).not.toMatch(/détail sensible/);
  });
});
