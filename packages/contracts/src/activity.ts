// Synchronisation des totaux quotidiens (F2, CA3), accueil (F3), historique (F13).
import { z } from "zod";
import {
  ActiveCaloriesSchema,
  LocalDateSchema,
  StepsSchema,
  TimeZoneSchema,
  TimestampSchema,
} from "./common";
import { HISTORY_MAX_DAYS, SYNC_MAX_DAYS } from "./constants";

export const DailyTotalSchema = z.strictObject({
  date: LocalDateSchema,
  /** Pas hors saisie manuelle (HKWasUserEntered exclu côté app, CA4). */
  steps: StepsSchema,
  /** Calories actives, kcal arrondies. */
  activeCalories: ActiveCaloriesSchema,
});
export type DailyTotal = z.infer<typeof DailyTotalSchema>;

/** PUT /me/activity — upsert idempotent par (utilisateur, date) ; 403 HEALTH_CONSENT_REQUIRED sans consentement. */
export const SyncActivityRequestSchema = z
  .strictObject({
    timeZone: TimeZoneSchema,
    days: z.array(DailyTotalSchema).min(1).max(SYNC_MAX_DAYS),
  })
  .refine((r) => new Set(r.days.map((d) => d.date)).size === r.days.length, {
    message: "Dates en double",
    path: ["days"],
  });
export type SyncActivityRequest = z.infer<typeof SyncActivityRequestSchema>;

export const SyncActivityResponseSchema = z.object({
  upserted: z.int().min(0),
  syncedAt: TimestampSchema,
});
export type SyncActivityResponse = z.infer<typeof SyncActivityResponseSchema>;

/** GET /me/activity?days=N */
export const ActivityHistoryQuerySchema = z.strictObject({
  days: z.coerce.number().int().min(1).max(HISTORY_MAX_DAYS).default(HISTORY_MAX_DAYS),
});
export type ActivityHistoryQuery = z.infer<typeof ActivityHistoryQuerySchema>;

export const ActivityDaySchema = z.object({
  date: LocalDateSchema,
  steps: StepsSchema,
  /** null si masqué par son propriétaire (CA8) ; jamais null pour soi-même. */
  activeCalories: ActiveCaloriesSchema.nullable(),
});
export type ActivityDay = z.infer<typeof ActivityDaySchema>;

/** Jours sans donnée omis ; ordre de date décroissant. */
export const ActivityHistoryResponseSchema = z.object({ days: z.array(ActivityDaySchema) });
export type ActivityHistoryResponse = z.infer<typeof ActivityHistoryResponseSchema>;

/** GET /me/today — écran d'accueil. */
export const TodayResponseSchema = z.object({
  date: LocalDateSchema,
  timeZone: TimeZoneSchema,
  steps: StepsSchema,
  activeCalories: ActiveCaloriesSchema,
  /** Prochain seuil non atteint, null si tous franchis. */
  nextMilestone: z.int().positive().nullable(),
  stepsToNextMilestone: z.int().min(0).nullable(),
  /** Rang du jour parmi moi + amis acceptés (même règle que le classement quotidien). */
  rank: z.int().positive(),
  participants: z.int().positive(),
  lastSyncAt: TimestampSchema.nullable(),
});
export type TodayResponse = z.infer<typeof TodayResponseSchema>;
