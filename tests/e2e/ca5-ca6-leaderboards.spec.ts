// CA5 : le classement quotidien ne contient que moi et mes amis acceptés ; totaux égaux ⇒ même
// rang, rang suivant sauté (1, 1, 3 ici avec 3 participants). CA6 : le classement hebdomadaire
// agrège lundi → dimanche (ici un seul jour synchronisé : hebdo == quotidien).
// Amitiés déjà établies par tests/e2e/global-setup.ts : alice-bob, alice-carol ; dave reste
// étranger à alice.
import { expect, test } from "@playwright/test";
import type { LeaderboardResponse } from "@app/contracts";
import { authHeader, becomeFriends, loadPool, syncToday, type Actor } from "./support/api";

test.describe("CA5/CA6 : classements", () => {
  let me: Actor;
  let friendA: Actor;
  let friendB: Actor;
  let stranger: Actor;

  test.beforeAll(async ({ request }) => {
    const pool = loadPool();
    me = pool.alice;
    friendA = pool.bob;
    friendB = pool.carol;
    stranger = pool.dave;

    await becomeFriends(request, me, friendA);
    await becomeFriends(request, me, friendB);

    // friendA et friendB à égalité (5000), me en dessous, stranger au-dessus mais non ami.
    await syncToday(request, me, 3000);
    await syncToday(request, friendA, 5000);
    await syncToday(request, friendB, 5000);
    await syncToday(request, stranger, 9000);
  });

  test("classement quotidien : seuls moi et mes amis, égalité ⇒ même rang, rang suivant sauté", async ({
    request,
  }) => {
    const res = await request.get("/leaderboards/daily", { headers: authHeader(me.token) });
    expect(res.status()).toBe(200);
    const body = (await res.json()) as LeaderboardResponse;

    expect(body.period).toBe("daily");
    expect(body.entries).toHaveLength(3);
    expect(body.entries.some((e) => e.userId === stranger.userId)).toBe(false);

    const byId = new Map(body.entries.map((e) => [e.userId, e] as const));
    const a = byId.get(friendA.userId)!;
    const b = byId.get(friendB.userId)!;
    const m = byId.get(me.userId)!;

    expect(a.steps).toBe(5000);
    expect(b.steps).toBe(5000);
    expect(m.steps).toBe(3000);
    expect(a.rank).toBe(1);
    expect(b.rank).toBe(1);
    expect(m.rank).toBe(3); // rang 2 sauté (deux ex æquo en rang 1)
    expect(m.isMe).toBe(true);
    expect(a.isMe).toBe(false);

    // Tri secondaire par pseudonyme entre égalités.
    const tied = body.entries.filter((e) => e.steps === 5000).map((e) => e.username);
    expect(tied).toEqual([...tied].sort());
  });

  test("classement hebdomadaire : mêmes participants, agrégation cohérente avec un seul jour synchronisé", async ({
    request,
  }) => {
    const res = await request.get("/leaderboards/weekly", { headers: authHeader(me.token) });
    expect(res.status()).toBe(200);
    const body = (await res.json()) as LeaderboardResponse;

    expect(body.period).toBe("weekly");
    expect(body.entries).toHaveLength(3);
    const byId = new Map(body.entries.map((e) => [e.userId, e] as const));
    // Un seul jour de données synchronisé ⇒ somme hebdo == pas du jour.
    expect(byId.get(friendA.userId)!.steps).toBe(5000);
    expect(byId.get(friendB.userId)!.steps).toBe(5000);
    expect(byId.get(me.userId)!.steps).toBe(3000);
  });
});
