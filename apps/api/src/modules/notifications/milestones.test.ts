// F11 (ADR 004) : seuils franchis à la synchro du jour courant local, un seul seuil notifié,
// aucune notification en rattrapage historique.
import { SignInResponseSchema } from "@app/contracts";
import { schema } from "@app/db";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetRateLimits } from "../../middleware/rate-limit";
import { createTestApp, type TestApp } from "../../test-support";
import { ConsoleTransport } from "./console-transport";

const NOW = new Date("2026-09-20T10:00:00Z"); // midi à Paris, hors heures silencieuses

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

async function seedUser(testApp: TestApp, devUserKey: string, username: string) {
  const signIn = await signInDev(testApp, devUserKey);
  const res = await testApp.app.request("/me/username", {
    method: "PUT",
    headers: authHeader(signIn.session.token),
    body: JSON.stringify({ username }),
  });
  expect(res.status).toBe(200);
  return signIn;
}

let deviceSeed = 0;
async function registerDevice(testApp: TestApp, token: string) {
  deviceSeed += 1;
  const apnsToken = deviceSeed.toString(16).padStart(64, "0");
  const res = await testApp.app.request("/me/devices", {
    method: "PUT",
    headers: authHeader(token),
    body: JSON.stringify({ apnsToken, environment: "sandbox" }),
  });
  expect(res.status).toBe(204);
}

async function grantConsent(testApp: TestApp, token: string) {
  await testApp.app.request("/me/consents/health", {
    method: "PUT",
    headers: authHeader(token),
    body: JSON.stringify({ granted: true }),
  });
}

function sync(testApp: TestApp, token: string, days: { date: string; steps: number; activeCalories: number }[]) {
  return testApp.app.request("/me/activity", {
    method: "PUT",
    headers: authHeader(token),
    body: JSON.stringify({ timeZone: "Europe/Paris", days }),
  });
}

async function friend(testApp: TestApp, userId: string, friendId: string) {
  await testApp.db.insert(schema.friendships).values([
    { userId, friendId },
    { userId: friendId, friendId: userId },
  ]);
}

describe("Détection des seuils à la synchro (F11, ADR 004)", () => {
  let testApp: TestApp;
  let transport: ConsoleTransport;

  beforeEach(() => {
    resetRateLimits();
    transport = new ConsoleTransport();
  });
  afterEach(async () => {
    await testApp?.close();
  });

  it("franchir un seuil aujourd'hui notifie l'auteur (milestone_self)", async () => {
    testApp = await createTestApp({ now: () => NOW, pushTransport: transport });
    const alice = await seedUser(testApp, "alice", "alice");
    await grantConsent(testApp, alice.session.token);
    await registerDevice(testApp, alice.session.token);

    const res = await sync(testApp, alice.session.token, [{ date: "2026-09-20", steps: 5200, activeCalories: 200 }]);
    expect(res.status).toBe(200);

    expect(transport.outbox).toHaveLength(1);
    expect(transport.outbox[0]!.notification).toMatchObject({
      recipientId: alice.userId,
      type: "milestone_self",
      payload: { type: "milestone_self", date: "2026-09-20", milestone: 5000 },
    });
    const events = await testApp.db.select().from(schema.milestoneEvents).where(eq(schema.milestoneEvents.userId, alice.userId));
    expect(events).toEqual([{ userId: alice.userId, date: "2026-09-20", threshold: 5000 }]);
  });

  it("plusieurs seuils franchis d'un coup : un seul notifié (le plus haut)", async () => {
    testApp = await createTestApp({ now: () => NOW, pushTransport: transport });
    const alice = await seedUser(testApp, "alice", "alice");
    await grantConsent(testApp, alice.session.token);
    await registerDevice(testApp, alice.session.token);

    await sync(testApp, alice.session.token, [{ date: "2026-09-20", steps: 20000, activeCalories: 800 }]);

    expect(transport.outbox).toHaveLength(1);
    expect(transport.outbox[0]!.notification.payload).toMatchObject({ milestone: 15000 });
    const events = await testApp.db.select().from(schema.milestoneEvents).where(eq(schema.milestoneEvents.userId, alice.userId));
    expect(events).toHaveLength(1);
    expect(events[0]!.threshold).toBe(15000);
  });

  it("resynchroniser le même jour sans nouveau seuil ne notifie pas deux fois", async () => {
    testApp = await createTestApp({ now: () => NOW, pushTransport: transport });
    const alice = await seedUser(testApp, "alice", "alice");
    await grantConsent(testApp, alice.session.token);
    await registerDevice(testApp, alice.session.token);

    await sync(testApp, alice.session.token, [{ date: "2026-09-20", steps: 5200, activeCalories: 200 }]);
    await sync(testApp, alice.session.token, [{ date: "2026-09-20", steps: 5300, activeCalories: 210 }]); // même seuil (5000)

    expect(transport.outbox).toHaveLength(1);
  });

  it("rattrapage historique (jour différent d'aujourd'hui) : aucune notification", async () => {
    testApp = await createTestApp({ now: () => NOW, pushTransport: transport });
    const alice = await seedUser(testApp, "alice", "alice");
    await grantConsent(testApp, alice.session.token);

    await sync(testApp, alice.session.token, [{ date: "2026-09-15", steps: 12000, activeCalories: 500 }]);

    expect(transport.outbox).toHaveLength(0);
    const events = await testApp.db.select().from(schema.milestoneEvents).where(eq(schema.milestoneEvents.userId, alice.userId));
    expect(events).toHaveLength(0);
  });

  it("propage aux amis (milestone_friend) si share_milestones ; respecte la préférence du destinataire", async () => {
    testApp = await createTestApp({ now: () => NOW, pushTransport: transport });
    const alice = await seedUser(testApp, "alice", "alice");
    const bob = await seedUser(testApp, "bob", "bob"); // recevra la notification
    const charlie = await seedUser(testApp, "charlie", "charlie"); // a coupé notifyFriendMilestones
    await grantConsent(testApp, alice.session.token);
    await registerDevice(testApp, bob.session.token);
    await friend(testApp, alice.userId, bob.userId);
    await friend(testApp, alice.userId, charlie.userId);
    await testApp.db.update(schema.userSettings).set({ notifyFriendMilestones: false }).where(eq(schema.userSettings.userId, charlie.userId));

    await sync(testApp, alice.session.token, [{ date: "2026-09-20", steps: 5200, activeCalories: 200 }]);

    const friendNotifs = transport.outbox.filter((s) => s.notification.type === "milestone_friend");
    expect(friendNotifs).toHaveLength(1);
    expect(friendNotifs[0]!.notification.recipientId).toBe(bob.userId);
    expect(friendNotifs[0]!.notification.payload).toMatchObject({ fromUserId: alice.userId, fromUsername: "alice", milestone: 5000 });
  });

  it("share_milestones désactivé : pas de notification aux amis, mais milestone_self conservé", async () => {
    testApp = await createTestApp({ now: () => NOW, pushTransport: transport });
    const alice = await seedUser(testApp, "alice", "alice");
    const bob = await seedUser(testApp, "bob", "bob");
    await grantConsent(testApp, alice.session.token);
    await registerDevice(testApp, alice.session.token);
    await friend(testApp, alice.userId, bob.userId);
    await testApp.db.update(schema.userSettings).set({ shareMilestones: false }).where(eq(schema.userSettings.userId, alice.userId));

    await sync(testApp, alice.session.token, [{ date: "2026-09-20", steps: 5200, activeCalories: 200 }]);

    expect(transport.outbox.filter((s) => s.notification.type === "milestone_friend")).toHaveLength(0);
    expect(transport.outbox.filter((s) => s.notification.type === "milestone_self")).toHaveLength(1);
  });
});
