import { HealthConsentResponseSchema, SignInResponseSchema } from "@app/contracts";
import { schema } from "@app/db";
import { eq } from "drizzle-orm";
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

describe("PUT /me/consents/health (ADR 006)", () => {
  let testApp: TestApp;

  beforeEach(() => resetRateLimits());
  afterEach(async () => {
    await testApp?.close();
  });

  it("accorder le consentement horodate healthConsentAt", async () => {
    testApp = await createTestApp();
    const signIn = await signInDev(testApp, "alice");
    const res = await testApp.app.request("/me/consents/health", {
      method: "PUT",
      headers: authHeader(signIn.session.token),
      body: JSON.stringify({ granted: true }),
    });
    expect(res.status).toBe(200);
    const body = HealthConsentResponseSchema.parse(await res.json());
    expect(body.healthConsentAt).not.toBeNull();
  });

  it("retirer le consentement efface l'activité et les seuils déjà enregistrés", async () => {
    testApp = await createTestApp();
    const signIn = await signInDev(testApp, "alice");
    await testApp.app.request("/me/consents/health", {
      method: "PUT",
      headers: authHeader(signIn.session.token),
      body: JSON.stringify({ granted: true }),
    });
    await testApp.db.insert(schema.dailyActivity).values({
      userId: signIn.userId,
      date: "2026-09-20",
      steps: 5000,
      activeCalories: 200,
      timeZone: "Europe/Paris",
    });
    await testApp.db.insert(schema.milestoneEvents).values({ userId: signIn.userId, date: "2026-09-20", threshold: 5000 });

    const res = await testApp.app.request("/me/consents/health", {
      method: "PUT",
      headers: authHeader(signIn.session.token),
      body: JSON.stringify({ granted: false }),
    });
    expect(res.status).toBe(200);
    const body = HealthConsentResponseSchema.parse(await res.json());
    expect(body.healthConsentAt).toBeNull();

    const activity = await testApp.db.select().from(schema.dailyActivity).where(eq(schema.dailyActivity.userId, signIn.userId));
    const milestones = await testApp.db.select().from(schema.milestoneEvents).where(eq(schema.milestoneEvents.userId, signIn.userId));
    expect(activity).toHaveLength(0);
    expect(milestones).toHaveLength(0);
  });

  it("sans jeton ⇒ 401", async () => {
    testApp = await createTestApp();
    const res = await testApp.app.request("/me/consents/health", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ granted: true }),
    });
    expect(res.status).toBe(401);
  });
});
