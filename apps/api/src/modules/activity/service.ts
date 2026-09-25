// PUT /me/activity (synchro, CA3, ADR 002), GET /me/activity (historique, F13).
import type { ActivityHistoryResponse, SyncActivityRequest, SyncActivityResponse } from "@app/contracts";
import { SYNC_MAX_DAYS } from "@app/contracts";
import type { Db } from "@app/db";
import { schema } from "@app/db";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { addDaysToLocalDate, compareLocalDates, localDate } from "../../domain/local-date";
import { AppError } from "../../errors";
import { detectAndNotifyMilestone } from "../notifications/milestones";
import type { PushTransport } from "../notifications/transport";

async function requireHealthConsent(db: Db, userId: string): Promise<void> {
  const [user] = await db
    .select({ healthConsentAt: schema.users.healthConsentAt })
    .from(schema.users)
    .where(eq(schema.users.id, userId));
  if (!user) throw new AppError("UNAUTHENTICATED", "Utilisateur introuvable");
  if (!user.healthConsentAt) {
    throw new AppError("HEALTH_CONSENT_REQUIRED", "Consentement santé requis avant toute synchronisation");
  }
}

/**
 * Upsert idempotent par (utilisateur, date) en une seule requête `INSERT … ON CONFLICT`
 * (NFR §4 : lot de 31 jours < 300 ms). Rejette les dates hors [aujourd'hui local − 31 j,
 * aujourd'hui local + 1 j] (ADR 002).
 */
export async function syncActivity(
  db: Db,
  userId: string,
  req: SyncActivityRequest,
  now: Date,
  transport: PushTransport,
): Promise<SyncActivityResponse> {
  await requireHealthConsent(db, userId);

  const today = localDate(now, req.timeZone);
  const minDate = addDaysToLocalDate(today, -SYNC_MAX_DAYS);
  const maxDate = addDaysToLocalDate(today, 1);
  for (const day of req.days) {
    if (compareLocalDates(day.date, minDate) < 0 || compareLocalDates(day.date, maxDate) > 0) {
      throw new AppError("DATE_OUT_OF_RANGE", `Date hors de la fenêtre autorisée : ${day.date}`);
    }
  }

  // Capturé avant l'upsert : seuils franchis = prev < s ≤ new (ADR 004), jour courant local
  // seulement — jamais en rattrapage historique.
  const todayInRequest = req.days.find((d) => d.date === today);
  let prevTodaySteps = 0;
  if (todayInRequest) {
    const [existing] = await db
      .select({ steps: schema.dailyActivity.steps })
      .from(schema.dailyActivity)
      .where(and(eq(schema.dailyActivity.userId, userId), eq(schema.dailyActivity.date, today)));
    prevTodaySteps = existing?.steps ?? 0;
  }

  await db.transaction(async (tx) => {
    await tx
      .insert(schema.dailyActivity)
      .values(
        req.days.map((day) => ({
          userId,
          date: day.date,
          steps: day.steps,
          activeCalories: day.activeCalories,
          timeZone: req.timeZone,
          updatedAt: now,
        })),
      )
      .onConflictDoUpdate({
        target: [schema.dailyActivity.userId, schema.dailyActivity.date],
        set: {
          steps: sql`excluded.steps`,
          activeCalories: sql`excluded.active_calories`,
          timeZone: sql`excluded.time_zone`,
          updatedAt: sql`excluded.updated_at`,
        },
      });
    await tx.update(schema.users).set({ timeZone: req.timeZone, lastSyncAt: now }).where(eq(schema.users.id, userId));
  });

  if (todayInRequest) {
    await detectAndNotifyMilestone(db, transport, userId, today, prevTodaySteps, todayInRequest.steps, now);
  }

  return { upserted: req.days.length, syncedAt: now.toISOString() };
}

/** `days` le plus récent d'abord, jours sans donnée omis (jamais de calories masquées pour soi-même). */
export async function getActivityHistory(db: Db, userId: string, days: number, now: Date): Promise<ActivityHistoryResponse> {
  const [user] = await db.select({ timeZone: schema.users.timeZone }).from(schema.users).where(eq(schema.users.id, userId));
  if (!user) throw new AppError("UNAUTHENTICATED", "Utilisateur introuvable");

  const today = localDate(now, user.timeZone);
  const minDate = addDaysToLocalDate(today, -(days - 1));

  const rows = await db
    .select({
      date: schema.dailyActivity.date,
      steps: schema.dailyActivity.steps,
      activeCalories: schema.dailyActivity.activeCalories,
    })
    .from(schema.dailyActivity)
    .where(and(eq(schema.dailyActivity.userId, userId), gte(schema.dailyActivity.date, minDate), lte(schema.dailyActivity.date, today)))
    .orderBy(desc(schema.dailyActivity.date));

  return { days: rows };
}
