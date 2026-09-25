// GET /leaderboards/daily|weekly (CA5, CA6) et GET /me/today (F3) : participants = soi + amis
// acceptés, jour/semaine calculés dans le fuseau propre de *chaque* participant (ADR 003).
// ≤ 3 requêtes SQL indexées par appel (NFR §4) : amitiés, utilisateurs, activité bornée.
import type { LeaderboardPeriod, LeaderboardResponse, TodayResponse } from "@app/contracts";
import { STEP_MILESTONES } from "@app/contracts";
import type { Db } from "@app/db";
import { schema } from "@app/db";
import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { addDaysToLocalDate, localDate, mondayOfWeek } from "../../domain/local-date";
import { rankEntries } from "../../domain/rank";
import { AppError } from "../../errors";

interface Participant {
  userId: string;
  username: string;
  timeZone: string;
  lastSyncAt: Date | null;
}

interface DateRange {
  start: string;
  end: string;
}

interface ActivityRow {
  userId: string;
  date: string;
  steps: number;
  activeCalories: number;
}

/** Amis acceptés (deux lignes par amitié, cf. `friendships`) + soi-même. */
async function loadParticipants(db: Db, userId: string): Promise<Participant[]> {
  const friendRows = await db
    .select({ friendId: schema.friendships.friendId })
    .from(schema.friendships)
    .where(eq(schema.friendships.userId, userId));
  const participantIds = [userId, ...friendRows.map((f) => f.friendId)];

  const rows = await db
    .select({
      userId: schema.users.id,
      username: schema.users.username,
      timeZone: schema.users.timeZone,
      lastSyncAt: schema.users.lastSyncAt,
    })
    .from(schema.users)
    .where(inArray(schema.users.id, participantIds));

  // Un pseudonyme est requis pour envoyer/accepter une demande d'amitié (route sociale) : un
  // participant sans pseudonyme ne devrait jamais apparaître ici, filtre défensif seulement.
  return rows.filter((row): row is Participant => row.username !== null);
}

function rangeFor(period: LeaderboardPeriod, participant: Participant, now: Date): DateRange {
  const today = localDate(now, participant.timeZone);
  if (period === "daily") return { start: today, end: today };
  const monday = mondayOfWeek(today);
  return { start: monday, end: addDaysToLocalDate(monday, 6) };
}

/** Une seule requête bornée par la plus large fenêtre couvrant tous les participants. */
async function loadActivityRows(db: Db, participants: Participant[], ranges: Map<string, DateRange>): Promise<ActivityRow[]> {
  const allRanges = [...ranges.values()];
  const minDate = allRanges.reduce((min, r) => (r.start < min ? r.start : min), allRanges[0]!.start);
  const maxDate = allRanges.reduce((max, r) => (r.end > max ? r.end : max), allRanges[0]!.end);

  return db
    .select({
      userId: schema.dailyActivity.userId,
      date: schema.dailyActivity.date,
      steps: schema.dailyActivity.steps,
      activeCalories: schema.dailyActivity.activeCalories,
    })
    .from(schema.dailyActivity)
    .where(
      and(
        inArray(
          schema.dailyActivity.userId,
          participants.map((p) => p.userId),
        ),
        gte(schema.dailyActivity.date, minDate),
        lte(schema.dailyActivity.date, maxDate),
      ),
    );
}

function sumSteps(participants: Participant[], ranges: Map<string, DateRange>, rows: ActivityRow[]): Map<string, number> {
  const stepsByUser = new Map(participants.map((p) => [p.userId, 0]));
  for (const row of rows) {
    const range = ranges.get(row.userId);
    if (range && row.date >= range.start && row.date <= range.end) {
      stepsByUser.set(row.userId, (stepsByUser.get(row.userId) ?? 0) + row.steps);
    }
  }
  return stepsByUser;
}

interface LeaderboardData {
  participants: Participant[];
  ranges: Map<string, DateRange>;
  rows: ActivityRow[];
}

async function loadLeaderboardData(db: Db, userId: string, period: LeaderboardPeriod, now: Date): Promise<LeaderboardData> {
  const participants = await loadParticipants(db, userId);
  if (!participants.some((p) => p.userId === userId)) {
    throw new AppError("UNAUTHENTICATED", "Utilisateur introuvable");
  }
  const ranges = new Map(participants.map((p) => [p.userId, rangeFor(period, p, now)] as const));
  const rows = await loadActivityRows(db, participants, ranges);
  return { participants, ranges, rows };
}

export async function computeLeaderboard(db: Db, userId: string, period: LeaderboardPeriod, now: Date): Promise<LeaderboardResponse> {
  const { participants, ranges, rows } = await loadLeaderboardData(db, userId, period, now);
  const stepsByUser = sumSteps(participants, ranges, rows);

  const ranked = rankEntries(
    participants.map((p) => ({ key: p.username, value: stepsByUser.get(p.userId) ?? 0, participant: p })),
  );

  const requesterRange = ranges.get(userId)!;
  const entries = ranked.map((r) => ({
    rank: r.rank,
    userId: r.participant.userId,
    username: r.participant.username,
    steps: r.value,
    isMe: r.participant.userId === userId,
    lastSyncAt: r.participant.lastSyncAt?.toISOString() ?? null,
  }));

  return { period, start: requesterRange.start, end: requesterRange.end, entries };
}

function nextMilestoneFor(steps: number): { nextMilestone: number | null; stepsToNextMilestone: number | null } {
  const next = STEP_MILESTONES.find((m) => m > steps) ?? null;
  return { nextMilestone: next, stepsToNextMilestone: next === null ? null : next - steps };
}

export async function computeToday(db: Db, userId: string, now: Date): Promise<TodayResponse> {
  const { participants, ranges, rows } = await loadLeaderboardData(db, userId, "daily", now);
  const stepsByUser = sumSteps(participants, ranges, rows);

  const ranked = rankEntries(
    participants.map((p) => ({ key: p.username, value: stepsByUser.get(p.userId) ?? 0, participant: p })),
  );
  const me = ranked.find((r) => r.participant.userId === userId)!;
  const requesterRange = ranges.get(userId)!;
  const todayRow = rows.find((r) => r.userId === userId && r.date === requesterRange.start);

  return {
    date: requesterRange.start,
    timeZone: me.participant.timeZone,
    steps: me.value,
    activeCalories: todayRow?.activeCalories ?? 0,
    ...nextMilestoneFor(me.value),
    rank: me.rank,
    participants: participants.length,
    lastSyncAt: me.participant.lastSyncAt?.toISOString() ?? null,
  };
}
