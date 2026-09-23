import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { rateLimit, resetRateLimits } from "./rate-limit";
import { createTestApp, type TestApp } from "../test-support";

describe("rateLimit (fenêtre glissante, ADR 007)", () => {
  let testApp: TestApp;

  beforeEach(() => resetRateLimits());
  afterEach(async () => {
    await testApp?.close();
  });

  it("bloque au-delà du maximum puis autorise à nouveau une fois la fenêtre écoulée", async () => {
    let now = 0;
    testApp = await createTestApp({ now: () => new Date(now) });
    testApp.app.get("/privacy", rateLimit({ max: 2, windowMs: 1000, keyFn: () => "rl-test" }), (c) => c.text("ok"));

    expect((await testApp.app.request("/privacy")).status).toBe(200);
    expect((await testApp.app.request("/privacy")).status).toBe(200);
    const limited = await testApp.app.request("/privacy");
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBeTruthy();

    now += 1001;
    expect((await testApp.app.request("/privacy")).status).toBe(200);
  });

  it("keyFn renvoyant null laisse toujours passer (ex. pas encore authentifié)", async () => {
    testApp = await createTestApp();
    testApp.app.get("/privacy", rateLimit({ max: 1, windowMs: 1000, keyFn: () => null }), (c) => c.text("ok"));
    for (let i = 0; i < 5; i++) {
      expect((await testApp.app.request("/privacy")).status).toBe(200);
    }
  });

  it("des clés différentes ont des compteurs indépendants", async () => {
    testApp = await createTestApp();
    let key = "a";
    testApp.app.get("/privacy", rateLimit({ max: 1, windowMs: 1000, keyFn: () => key }), (c) => c.text("ok"));

    expect((await testApp.app.request("/privacy")).status).toBe(200);
    expect((await testApp.app.request("/privacy")).status).toBe(429);
    key = "b";
    expect((await testApp.app.request("/privacy")).status).toBe(200);
  });
});
