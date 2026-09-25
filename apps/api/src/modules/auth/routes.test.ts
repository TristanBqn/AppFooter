import { RATE_LIMIT_AUTH_PER_MINUTE_PER_IP, SignInResponseSchema } from "@app/contracts";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetRateLimits } from "../../middleware/rate-limit";
import { createTestApp, type TestApp } from "../../test-support";

async function signInDev(testApp: TestApp, devUserKey: string) {
  const res = await testApp.app.request("/auth/dev", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ devUserKey }),
  });
  return res;
}

describe("POST /auth/dev, POST /auth/logout (ADR 001)", () => {
  let testApp: TestApp;

  beforeEach(() => resetRateLimits());
  afterEach(async () => {
    await testApp?.close();
  });

  it("crée un utilisateur de dev, needsUsername = true", async () => {
    testApp = await createTestApp();
    const res = await signInDev(testApp, "alice");
    expect(res.status).toBe(200);
    const body = SignInResponseSchema.parse(await res.json());
    expect(body.needsUsername).toBe(true);
    expect(body.username).toBeNull();
    expect(body.session.token.length).toBeGreaterThanOrEqual(32);
  });

  it("la même clé de dev retrouve le même utilisateur", async () => {
    testApp = await createTestApp();
    const first = SignInResponseSchema.parse(await (await signInDev(testApp, "alice")).json());
    const second = SignInResponseSchema.parse(await (await signInDev(testApp, "alice")).json());
    expect(second.userId).toBe(first.userId);
  });

  it("le jeton émis authentifie GET /me", async () => {
    testApp = await createTestApp();
    const signIn = SignInResponseSchema.parse(await (await signInDev(testApp, "alice")).json());
    const res = await testApp.app.request("/me", {
      headers: { authorization: `Bearer ${signIn.session.token}` },
    });
    expect(res.status).toBe(200);
    const me = await res.json();
    expect(me.userId).toBe(signIn.userId);
    expect(me.username).toBeNull();
  });

  it("logout invalide la session : le jeton ne fonctionne plus ensuite", async () => {
    testApp = await createTestApp();
    const signIn = SignInResponseSchema.parse(await (await signInDev(testApp, "alice")).json());
    const auth = { authorization: `Bearer ${signIn.session.token}` };

    const logout = await testApp.app.request("/auth/logout", { method: "POST", headers: auth });
    expect(logout.status).toBe(204);

    const after = await testApp.app.request("/me", { headers: auth });
    expect(after.status).toBe(401);
  });

  it("absente en production (ENABLE_DEV_LOGIN=false) : 404", async () => {
    testApp = await createTestApp({ env: { enableDevLogin: false } });
    const res = await signInDev(testApp, "alice");
    expect(res.status).toBe(404);
  });

  it("limite de débit par IP sur /auth/* (429 + Retry-After)", async () => {
    testApp = await createTestApp();
    for (let i = 0; i < RATE_LIMIT_AUTH_PER_MINUTE_PER_IP; i++) {
      const res = await signInDev(testApp, "alice");
      expect(res.status).toBe(200);
    }
    const limited = await signInDev(testApp, "alice");
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBeTruthy();
  });

  it("limite de débit /auth/* injectable (E2E_AUTH_RATE_LIMIT via CreateAppOptions.authRateLimitPerMinute)", async () => {
    testApp = await createTestApp({ authRateLimitPerMinute: 2 });
    expect((await signInDev(testApp, "alice")).status).toBe(200);
    expect((await signInDev(testApp, "alice")).status).toBe(200);
    expect((await signInDev(testApp, "alice")).status).toBe(429);
  });
});
