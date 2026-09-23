import { SettingsSchema, SignInResponseSchema } from "@app/contracts";
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

describe("GET/PATCH /me/settings (F15)", () => {
  let testApp: TestApp;

  beforeEach(() => resetRateLimits());
  afterEach(async () => {
    await testApp?.close();
  });

  it("GET renvoie les valeurs par défaut", async () => {
    testApp = await createTestApp();
    const signIn = await signInDev(testApp, "alice");
    const res = await testApp.app.request("/me/settings", { headers: authHeader(signIn.session.token) });
    expect(res.status).toBe(200);
    const settings = SettingsSchema.parse(await res.json());
    expect(settings).toEqual({
      privacy: { showCalories: true, acceptFriendRequests: true, shareMilestones: true },
      notifications: { milestones: true, friendMilestones: true, encouragements: true, friendRequests: true },
      quietHours: { enabled: true, start: "22:00", end: "08:00" },
    });
  });

  it("PATCH met à jour uniquement les champs fournis", async () => {
    testApp = await createTestApp();
    const signIn = await signInDev(testApp, "alice");
    const res = await testApp.app.request("/me/settings", {
      method: "PATCH",
      headers: authHeader(signIn.session.token),
      body: JSON.stringify({ privacy: { showCalories: false } }),
    });
    expect(res.status).toBe(200);
    const settings = SettingsSchema.parse(await res.json());
    expect(settings.privacy.showCalories).toBe(false);
    expect(settings.privacy.acceptFriendRequests).toBe(true);
    expect(settings.notifications.milestones).toBe(true);
  });

  it("PATCH des heures silencieuses convertit HH:MM en minutes puis revient identique", async () => {
    testApp = await createTestApp();
    const signIn = await signInDev(testApp, "alice");
    const res = await testApp.app.request("/me/settings", {
      method: "PATCH",
      headers: authHeader(signIn.session.token),
      body: JSON.stringify({ quietHours: { enabled: false, start: "23:15", end: "07:45" } }),
    });
    const settings = SettingsSchema.parse(await res.json());
    expect(settings.quietHours).toEqual({ enabled: false, start: "23:15", end: "07:45" });
  });

  it("PATCH avec une clé inconnue ⇒ 400 VALIDATION_ERROR (objet strict)", async () => {
    testApp = await createTestApp();
    const signIn = await signInDev(testApp, "alice");
    const res = await testApp.app.request("/me/settings", {
      method: "PATCH",
      headers: authHeader(signIn.session.token),
      body: JSON.stringify({ privacy: { showCalories: false, unknownField: true } }),
    });
    expect(res.status).toBe(400);
  });

  it("sans jeton ⇒ 401", async () => {
    testApp = await createTestApp();
    expect((await testApp.app.request("/me/settings")).status).toBe(401);
  });
});
