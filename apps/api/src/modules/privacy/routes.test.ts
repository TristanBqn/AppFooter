// GET /privacy (ADR 006) : accessible sans session (PUBLIC_ROUTES), HTML statique.
import { afterEach, describe, expect, it } from "vitest";
import { createTestApp, type TestApp } from "../../test-support";

describe("GET /privacy", () => {
  let testApp: TestApp;
  afterEach(async () => {
    await testApp?.close();
  });

  it("accessible sans jeton, renvoie du HTML contenant le texte de la politique", async () => {
    testApp = await createTestApp();
    const res = await testApp.app.request("/privacy");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/text\/html/);
    const html = await res.text();
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("Politique de confidentialité de Footer");
    expect(html).toContain("Se connecter avec Apple");
    expect(html).toContain("<table>"); // tableau des finalités / bases légales
  });

  it("le contenu est mis en cache : identique sur deux appels", async () => {
    testApp = await createTestApp();
    const first = await (await testApp.app.request("/privacy")).text();
    const second = await (await testApp.app.request("/privacy")).text();
    expect(first).toBe(second);
  });
});
