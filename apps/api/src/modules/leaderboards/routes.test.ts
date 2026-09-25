// CA5, CA6 : classements quotidien/hebdomadaire (amis uniquement, égalités « 1, 2, 2, 4 »,
// fuseaux propres à chaque participant, ADR 003) ; GET /me/today.
import { LeaderboardResponseSchema, SignInResponseSchema, TodayResponseSchema } from "@app/contracts";
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

async function setUsername(testApp: TestApp, token: string, username: string) {
  const res = await testApp.app.request("/me/username", {
    method: "PUT",
    headers: authHeader(token),
    body: JSON.stringify({ username }),
  });
  expect(res.status).toBe(200);
}

async function friend(testApp: TestApp, userId: string, friendId: string) {
  await testApp.db.insert(schema.friendships).values([
    { userId, friendId },
    { userId: friendId, friendId: userId },
  ]);
}

async function seedActivity(testApp: TestApp, userId: string, date: string, steps: number, activeCalories = 0) {
  await testApp.db.insert(schema.dailyActivity).values({ userId, date, steps, activeCalories, timeZone: "Europe/Paris" });
}

async function setTimeZone(testApp: TestApp, userId: string, timeZone: string) {
  await testApp.db.update(schema.users).set({ timeZone }).where(eq(schema.users.id, userId));
}

describe("GET /leaderboards/daily|weekly (CA5, CA6)", () => {
  let testApp: TestApp;

  beforeEach(() => resetRateLimits());
  afterEach(async () => {
    await testApp?.close();
  });

  it("sans pseudonyme ⇒ 403 USERNAME_REQUIRED", async () => {
    testApp = await createTestApp();
    const signIn = await signInDev(testApp, "alice");
    const res = await testApp.app.request("/leaderboards/daily", { headers: authHeader(signIn.session.token) });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe("USERNAME_REQUIRED");
  });

  it("ne contient que moi et mes amis acceptés ; les non-amis sont exclus", async () => {
    const NOW = new Date("2026-09-20T10:00:00Z"); // 2026-09-20 à Paris
    testApp = await createTestApp({ now: () => NOW });

    const alice = await signInDev(testApp, "alice");
    const bob = await signInDev(testApp, "bob");
    const charlie = await signInDev(testApp, "charlie"); // pas ami
    await setUsername(testApp, alice.session.token, "alice");
    await setUsername(testApp, bob.session.token, "bob");
    await setUsername(testApp, charlie.session.token, "charlie");
    await friend(testApp, alice.userId, bob.userId);

    await seedActivity(testApp, alice.userId, "2026-09-20", 4000);
    await seedActivity(testApp, bob.userId, "2026-09-20", 6000);
    await seedActivity(testApp, charlie.userId, "2026-09-20", 9000);

    const res = await testApp.app.request("/leaderboards/daily", { headers: authHeader(alice.session.token) });
    expect(res.status).toBe(200);
    const body = LeaderboardResponseSchema.parse(await res.json());
    expect(body.entries.map((e) => e.username)).toEqual(["bob", "alice"]);
    expect(body.entries.find((e) => e.isMe)?.username).toBe("alice");
  });

  it("égalité de pas ⇒ même rang, rang suivant sauté ; tri secondaire par pseudonyme", async () => {
    const NOW = new Date("2026-09-20T10:00:00Z");
    testApp = await createTestApp({ now: () => NOW });

    const alice = await signInDev(testApp, "alice");
    const bob = await signInDev(testApp, "bob");
    const dave = await signInDev(testApp, "dave");
    await setUsername(testApp, alice.session.token, "alice");
    await setUsername(testApp, bob.session.token, "bob");
    await setUsername(testApp, dave.session.token, "dave");
    await friend(testApp, alice.userId, bob.userId);
    await friend(testApp, alice.userId, dave.userId);

    await seedActivity(testApp, alice.userId, "2026-09-20", 5000);
    await seedActivity(testApp, bob.userId, "2026-09-20", 5000);
    await seedActivity(testApp, dave.userId, "2026-09-20", 3000);

    const res = await testApp.app.request("/leaderboards/daily", { headers: authHeader(alice.session.token) });
    const body = LeaderboardResponseSchema.parse(await res.json());
    expect(body.entries.map((e) => ({ username: e.username, steps: e.steps, rank: e.rank }))).toEqual([
      { username: "alice", steps: 5000, rank: 1 },
      { username: "bob", steps: 5000, rank: 1 },
      { username: "dave", steps: 3000, rank: 3 },
    ]);
  });

  it("chaque participant est comparé sur son propre jour civil (Paris vs New York à minuit)", async () => {
    const NOW = new Date("2026-09-20T23:30:00Z"); // Paris : 21 sept. ; New York : 20 sept.
    testApp = await createTestApp({ now: () => NOW });

    const alice = await signInDev(testApp, "alice"); // Europe/Paris par défaut
    const bob = await signInDev(testApp, "bob");
    await setUsername(testApp, alice.session.token, "alice");
    await setUsername(testApp, bob.session.token, "bob");
    await setTimeZone(testApp, bob.userId, "America/New_York");
    await friend(testApp, alice.userId, bob.userId);

    await seedActivity(testApp, alice.userId, "2026-09-21", 2000); // jour local d'Alice
    await seedActivity(testApp, bob.userId, "2026-09-20", 7000); // jour local de Bob

    const res = await testApp.app.request("/leaderboards/daily", { headers: authHeader(alice.session.token) });
    const body = LeaderboardResponseSchema.parse(await res.json());
    expect(body.start).toBe("2026-09-21"); // fuseau du demandeur (Alice)
    const bySteps = new Map(body.entries.map((e) => [e.username, e.steps]));
    expect(bySteps.get("alice")).toBe(2000);
    expect(bySteps.get("bob")).toBe(7000);
  });

  it("hebdomadaire : somme lundi → dimanche de la semaine locale, jours hors semaine ignorés", async () => {
    const NOW = new Date("2026-09-24T10:00:00Z"); // jeudi 24, semaine du 21 (lundi) au 27 (dimanche)
    testApp = await createTestApp({ now: () => NOW });

    const alice = await signInDev(testApp, "alice");
    await setUsername(testApp, alice.session.token, "alice");

    await seedActivity(testApp, alice.userId, "2026-09-20", 9999); // semaine précédente : ignoré
    await seedActivity(testApp, alice.userId, "2026-09-21", 1000); // lundi
    await seedActivity(testApp, alice.userId, "2026-09-22", 2000);
    await seedActivity(testApp, alice.userId, "2026-09-24", 3000);

    const res = await testApp.app.request("/leaderboards/weekly", { headers: authHeader(alice.session.token) });
    const body = LeaderboardResponseSchema.parse(await res.json());
    expect(body.start).toBe("2026-09-21");
    expect(body.end).toBe("2026-09-27");
    expect(body.entries).toEqual([
      { rank: 1, userId: alice.userId, username: "alice", steps: 6000, isMe: true, lastSyncAt: null },
    ]);
  });

  it("sans donnée du jour ⇒ 0 pas, présent quand même dans le classement", async () => {
    const NOW = new Date("2026-09-20T10:00:00Z");
    testApp = await createTestApp({ now: () => NOW });
    const alice = await signInDev(testApp, "alice");
    await setUsername(testApp, alice.session.token, "alice");

    const res = await testApp.app.request("/leaderboards/daily", { headers: authHeader(alice.session.token) });
    const body = LeaderboardResponseSchema.parse(await res.json());
    expect(body.entries).toEqual([{ rank: 1, userId: alice.userId, username: "alice", steps: 0, isMe: true, lastSyncAt: null }]);
  });
});

describe("GET /me/today", () => {
  let testApp: TestApp;

  beforeEach(() => resetRateLimits());
  afterEach(async () => {
    await testApp?.close();
  });

  it("sans pseudonyme ⇒ 403 USERNAME_REQUIRED", async () => {
    testApp = await createTestApp();
    const signIn = await signInDev(testApp, "alice");
    const res = await testApp.app.request("/me/today", { headers: authHeader(signIn.session.token) });
    expect(res.status).toBe(403);
  });

  it("synthèse du jour : pas, calories, prochain seuil, rang parmi soi et ses amis", async () => {
    const NOW = new Date("2026-09-20T10:00:00Z");
    testApp = await createTestApp({ now: () => NOW });
    const alice = await signInDev(testApp, "alice");
    const bob = await signInDev(testApp, "bob");
    await setUsername(testApp, alice.session.token, "alice");
    await setUsername(testApp, bob.session.token, "bob");
    await friend(testApp, alice.userId, bob.userId);

    await seedActivity(testApp, alice.userId, "2026-09-20", 4200, 180);
    await seedActivity(testApp, bob.userId, "2026-09-20", 9000);
    await testApp.db.update(schema.users).set({ lastSyncAt: NOW }).where(eq(schema.users.id, alice.userId));

    const res = await testApp.app.request("/me/today", { headers: authHeader(alice.session.token) });
    expect(res.status).toBe(200);
    const body = TodayResponseSchema.parse(await res.json());
    expect(body).toEqual({
      date: "2026-09-20",
      timeZone: "Europe/Paris",
      steps: 4200,
      activeCalories: 180,
      nextMilestone: 5000,
      stepsToNextMilestone: 800,
      rank: 2,
      participants: 2,
      lastSyncAt: NOW.toISOString(),
    });
  });

  it("tous les seuils franchis ⇒ nextMilestone et stepsToNextMilestone null", async () => {
    const NOW = new Date("2026-09-20T10:00:00Z");
    testApp = await createTestApp({ now: () => NOW });
    const alice = await signInDev(testApp, "alice");
    await setUsername(testApp, alice.session.token, "alice");
    await seedActivity(testApp, alice.userId, "2026-09-20", 20000);

    const res = await testApp.app.request("/me/today", { headers: authHeader(alice.session.token) });
    const body = TodayResponseSchema.parse(await res.json());
    expect(body.nextMilestone).toBeNull();
    expect(body.stepsToNextMilestone).toBeNull();
    expect(body.rank).toBe(1);
    expect(body.participants).toBe(1);
  });
});
