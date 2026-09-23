// Classements quotidien et hebdomadaire (F4–F6, CA5, CA6). Calcul côté API uniquement (ADR 003).
import { z } from "zod";
import { LocalDateSchema, TimestampSchema, UserIdSchema, UsernameSchema } from "./common";

export const LeaderboardPeriodSchema = z.enum(["daily", "weekly"]);
export type LeaderboardPeriod = z.infer<typeof LeaderboardPeriodSchema>;

export const LeaderboardEntrySchema = z.object({
  /** Rang « compétition » : égalité => même rang, rang suivant sauté (1, 2, 2, 4). */
  rank: z.int().positive(),
  userId: UserIdSchema,
  username: UsernameSchema,
  /** Pas du jour local (daily) ou somme lundi→dimanche locale (weekly) du participant. */
  steps: z.int().min(0),
  isMe: z.boolean(),
  lastSyncAt: TimestampSchema.nullable(),
});
export type LeaderboardEntry = z.infer<typeof LeaderboardEntrySchema>;

/** GET /leaderboards/daily et GET /leaderboards/weekly */
export const LeaderboardResponseSchema = z.object({
  period: LeaderboardPeriodSchema,
  /** Bornes de la période dans le fuseau du demandeur (start = end pour daily). */
  start: LocalDateSchema,
  end: LocalDateSchema,
  /** Tri : steps décroissant puis username croissant. Contient toujours le demandeur. */
  entries: z.array(LeaderboardEntrySchema).min(1),
});
export type LeaderboardResponse = z.infer<typeof LeaderboardResponseSchema>;
