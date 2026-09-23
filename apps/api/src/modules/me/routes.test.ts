import { MeSchema, SignInResponseSchema } from "@app/contracts";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetRateLimits } from "../../middleware/rate-limit";
import { createTestApp, type TestApp } from "../../test-support";

async function signInDev(testApp: TestApp, devUserKey: string) {
  const res = await testApp.app.request("/auth/dev", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ devUserKey }),
  });
  return SignInResponseSchema.parse(await res.json());
}

function authHeader(token: string) {
  return { authorization: `Bearer ${token}`, "content-type": "application/json" };
}

describe("GET /me, PUT /me/username (CA2)", () => {
  let testApp: TestApp;

  beforeEach(() => resetRateLimits());
  afterEach(async () => {
    await testApp?.close();
  });

  it("GET /me renvoie le profil et les paramètres par défaut", async () => {
    testApp = await createTestApp();
    const signIn = await signInDev(testApp, "alice");
    const res = await testApp.app.request("/me", { headers: authHeader(signIn.session.token) });
    expect(res.status).toBe(200);
    const me = MeSchema.parse(await res.json());
    expect(me.username).toBeNull();
    expect(me.settings.privacy.showCalories).toBe(true);
    expect(me.settings.quietHours).toEqual({ enabled: true, start: "22:00", end: "08:00" });
  });

  it("choisit un pseudonyme normalisé en minuscules", async () => {
    testApp = await createTestApp();
    const signIn = await signInDev(testApp, "alice");
    const res = await testApp.app.request("/me/username", {
      method: "PUT",
      headers: authHeader(signIn.session.token),
      body: JSON.stringify({ username: "Alice_42" }),
    });
    expect(res.status).toBe(200);
    const me = MeSchema.parse(await res.json());
    expect(me.username).toBe("alice_42");
  });

  it("format invalide ⇒ 400 VALIDATION_ERROR", async () => {
    testApp = await createTestApp();
    const signIn = await signInDev(testApp, "alice");
    const res = await testApp.app.request("/me/username", {
      method: "PUT",
      headers: authHeader(signIn.session.token),
      body: JSON.stringify({ username: "a" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("pseudonyme déjà pris (insensible à la casse) ⇒ 409 USERNAME_TAKEN", async () => {
    testApp = await createTestApp();
    const alice = await signInDev(testApp, "alice");
    await testApp.app.request("/me/username", {
      method: "PUT",
      headers: authHeader(alice.session.token),
      body: JSON.stringify({ username: "walker" }),
    });

    const bob = await signInDev(testApp, "bob");
    const res = await testApp.app.request("/me/username", {
      method: "PUT",
      headers: authHeader(bob.session.token),
      body: JSON.stringify({ username: "WALKER" }),
    });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe("USERNAME_TAKEN");
  });

  it("pseudonyme déjà défini ⇒ 409 USERNAME_ALREADY_SET", async () => {
    testApp = await createTestApp();
    const alice = await signInDev(testApp, "alice");
    await testApp.app.request("/me/username", {
      method: "PUT",
      headers: authHeader(alice.session.token),
      body: JSON.stringify({ username: "walker" }),
    });
    const res = await testApp.app.request("/me/username", {
      method: "PUT",
      headers: authHeader(alice.session.token),
      body: JSON.stringify({ username: "walker2" }),
    });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe("USERNAME_ALREADY_SET");
  });

  it("sans jeton ⇒ 401", async () => {
    testApp = await createTestApp();
    const res = await testApp.app.request("/me");
    expect(res.status).toBe(401);
  });
});
