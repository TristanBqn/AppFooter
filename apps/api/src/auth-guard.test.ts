// CA1 : sans session valide, toute route hors PUBLIC_ROUTES renvoie 401. Couvre l'ensemble de
// `API_ROUTES`, y compris celles pas encore implémentées (le garde tourne avant le routage).
import { API_ROUTES, PUBLIC_ROUTES } from "@app/contracts";
import { afterEach, describe, expect, it } from "vitest";
import { createTestApp, type TestApp } from "./test-support";

function concretePath(pattern: string): string {
  return pattern.replace(/:[a-zA-Z]+/g, "00000000-0000-4000-8000-000000000000");
}

describe("CA1 : garde d'authentification", () => {
  let testApp: TestApp;

  afterEach(async () => {
    await testApp?.close();
  });

  const protectedRoutes = Object.entries(API_ROUTES).filter(
    ([name]) => !PUBLIC_ROUTES.includes(name as (typeof PUBLIC_ROUTES)[number]),
  );

  it.each(protectedRoutes)("%s ⇒ 401 sans jeton", async (_name, route) => {
    testApp = await createTestApp();
    const [method, pathPattern] = route.split(" ") as [string, string];
    const res = await testApp.app.request(concretePath(pathPattern), { method });
    expect(res.status).toBe(401);
  });

  it("un jeton invalide est aussi refusé (401)", async () => {
    testApp = await createTestApp();
    const res = await testApp.app.request("/me", { headers: { authorization: "Bearer inconnu" } });
    expect(res.status).toBe(401);
  });
});
