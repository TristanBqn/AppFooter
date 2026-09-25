// CA3 : une synchro envoie des totaux quotidiens ; renvoyer le même jour remplace la valeur
// (idempotent), pas de doublon.
import { expect, test } from "@playwright/test";
import { authHeader, devSignIn, randomDevUserKey, todayUtc } from "./support/api";

const TIME_ZONE = "UTC";

test.describe("CA3 : synchronisation de l'activité", () => {
  test("synchro sans consentement santé ⇒ 403 HEALTH_CONSENT_REQUIRED", async ({ request }) => {
    const signIn = await devSignIn(request, randomDevUserKey("ca3noconsent"));
    const headers = authHeader(signIn.session.token);
    const res = await request.put("/me/activity", {
      headers,
      data: { timeZone: TIME_ZONE, days: [{ date: todayUtc(), steps: 1000, activeCalories: 40 }] },
    });
    expect(res.status()).toBe(403);
    expect((await res.json()).error.code).toBe("HEALTH_CONSENT_REQUIRED");
  });

  test("renvoyer le même jour remplace la valeur, sans doublon", async ({ request }) => {
    const signIn = await devSignIn(request, randomDevUserKey("ca3sync"));
    const headers = authHeader(signIn.session.token);
    const date = todayUtc();

    const consent = await request.put("/me/consents/health", { headers, data: { granted: true } });
    expect(consent.status()).toBe(200);

    const firstSync = await request.put("/me/activity", {
      headers,
      data: { timeZone: TIME_ZONE, days: [{ date, steps: 1000, activeCalories: 40 }] },
    });
    expect(firstSync.status()).toBe(200);
    expect((await firstSync.json()).upserted).toBe(1);

    const secondSync = await request.put("/me/activity", {
      headers,
      data: { timeZone: TIME_ZONE, days: [{ date, steps: 2500, activeCalories: 90 }] },
    });
    expect(secondSync.status()).toBe(200);
    expect((await secondSync.json()).upserted).toBe(1);

    const history = await request.get("/me/activity?days=5", { headers });
    expect(history.status()).toBe(200);
    const { days } = await history.json();
    const rowsForDate = days.filter((d: { date: string }) => d.date === date);
    expect(rowsForDate).toHaveLength(1);
    expect(rowsForDate[0].steps).toBe(2500);
    expect(rowsForDate[0].activeCalories).toBe(90);
  });

  test("dates en double dans un même envoi ⇒ 400 VALIDATION_ERROR", async ({ request }) => {
    const signIn = await devSignIn(request, randomDevUserKey("ca3dup"));
    const headers = authHeader(signIn.session.token);
    const date = todayUtc();
    await request.put("/me/consents/health", { headers, data: { granted: true } });

    const res = await request.put("/me/activity", {
      headers,
      data: {
        timeZone: TIME_ZONE,
        days: [
          { date, steps: 1000, activeCalories: 40 },
          { date, steps: 2000, activeCalories: 60 },
        ],
      },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).error.code).toBe("VALIDATION_ERROR");
  });
});
