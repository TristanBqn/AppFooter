// CA3 : synchro idempotente, 403 sans consentement, DATE_OUT_OF_RANGE (ADR 002).
import { ActivityHistoryResponseSchema, SignInResponseSchema, SyncActivityResponseSchema } from "@app/contracts";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetRateLimits } from "../../middleware/rate-limit";
import { createTestApp, type TestApp } from "../../test-support";

const NOW = new Date("2026-09-20T10:00:00Z"); // midi à Paris (UTC+2), même jour civil

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

async function grantConsent(testApp: TestApp, token: string) {
  await testApp.app.request("/me/consents/health", {
    method: "PUT",
    headers: authHeader(token),
    body: JSON.stringify({ granted: true }),
  });
}

function sync(testApp: TestApp, token: string, days: { date: string; steps: number; activeCalories: number }[], timeZone = "Europe/Paris") {
  return testApp.app.request("/me/activity", {
    method: "PUT",
    headers: authHeader(token),
    body: JSON.stringify({ timeZone, days }),
  });
}

describe("PUT/GET /me/activity (CA3, ADR 002)", () => {
  let testApp: TestApp;

  beforeEach(() => resetRateLimits());
  afterEach(async () => {
    await testApp?.close();
  });

  it("403 HEALTH_CONSENT_REQUIRED sans consentement préalable", async () => {
    testApp = await createTestApp({ now: () => NOW });
    const signIn = await signInDev(testApp, "alice");
    const res = await sync(testApp, signIn.session.token, [{ date: "2026-09-20", steps: 1000, activeCalories: 40 }]);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe("HEALTH_CONSENT_REQUIRED");
  });

  it("renvoyer le même jour remplace la valeur (idempotent, pas de doublon)", async () => {
    testApp = await createTestApp({ now: () => NOW });
    const signIn = await signInDev(testApp, "alice");
    await grantConsent(testApp, signIn.session.token);

    const first = await sync(testApp, signIn.session.token, [{ date: "2026-09-20", steps: 4000, activeCalories: 150 }]);
    expect(first.status).toBe(200);
    expect(SyncActivityResponseSchema.parse(await first.json()).upserted).toBe(1);

    const second = await sync(testApp, signIn.session.token, [{ date: "2026-09-20", steps: 9000, activeCalories: 300 }]);
    expect(second.status).toBe(200);

    const history = await testApp.app.request("/me/activity?days=5", { headers: authHeader(signIn.session.token) });
    const body = ActivityHistoryResponseSchema.parse(await history.json());
    expect(body.days).toEqual([{ date: "2026-09-20", steps: 9000, activeCalories: 300 }]);
  });

  it("met à jour timeZone et lastSyncAt de l'utilisateur", async () => {
    testApp = await createTestApp({ now: () => NOW });
    const signIn = await signInDev(testApp, "alice");
    await grantConsent(testApp, signIn.session.token);
    await sync(testApp, signIn.session.token, [{ date: "2026-09-20", steps: 1000, activeCalories: 40 }], "America/New_York");

    const me = await (await testApp.app.request("/me", { headers: authHeader(signIn.session.token) })).json();
    expect(me.timeZone).toBe("America/New_York");
    expect(me.lastSyncAt).toBe(NOW.toISOString());
  });

  it("date antérieure à la fenêtre de 31 jours ⇒ 422 DATE_OUT_OF_RANGE", async () => {
    testApp = await createTestApp({ now: () => NOW });
    const signIn = await signInDev(testApp, "alice");
    await grantConsent(testApp, signIn.session.token);
    const res = await sync(testApp, signIn.session.token, [{ date: "2026-08-19", steps: 1000, activeCalories: 40 }]);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe("DATE_OUT_OF_RANGE");
  });

  it("la borne exacte (aujourd'hui − 31 j) est acceptée", async () => {
    testApp = await createTestApp({ now: () => NOW });
    const signIn = await signInDev(testApp, "alice");
    await grantConsent(testApp, signIn.session.token);
    const res = await sync(testApp, signIn.session.token, [{ date: "2026-08-20", steps: 1000, activeCalories: 40 }]);
    expect(res.status).toBe(200);
  });

  it("date future au-delà de aujourd'hui + 1 j ⇒ 422 DATE_OUT_OF_RANGE", async () => {
    testApp = await createTestApp({ now: () => NOW });
    const signIn = await signInDev(testApp, "alice");
    await grantConsent(testApp, signIn.session.token);
    const res = await sync(testApp, signIn.session.token, [{ date: "2026-09-22", steps: 1000, activeCalories: 40 }]);
    expect(res.status).toBe(422);
  });

  it("GET /me/activity : ordre décroissant, jours sans donnée omis", async () => {
    testApp = await createTestApp({ now: () => NOW });
    const signIn = await signInDev(testApp, "alice");
    await grantConsent(testApp, signIn.session.token);
    await sync(testApp, signIn.session.token, [
      { date: "2026-09-18", steps: 3000, activeCalories: 100 },
      { date: "2026-09-20", steps: 7000, activeCalories: 250 },
    ]);

    const res = await testApp.app.request("/me/activity?days=5", { headers: authHeader(signIn.session.token) });
    const body = ActivityHistoryResponseSchema.parse(await res.json());
    expect(body.days).toEqual([
      { date: "2026-09-20", steps: 7000, activeCalories: 250 },
      { date: "2026-09-18", steps: 3000, activeCalories: 100 },
    ]);
  });

  it("sans jeton ⇒ 401", async () => {
    testApp = await createTestApp();
    expect((await testApp.app.request("/me/activity")).status).toBe(401);
  });
});
