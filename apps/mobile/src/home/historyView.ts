// Modèle pur de l'écran Historique (M5, CA3, screens.md §8). `GET /me/activity` omet les jours
// sans donnée (contrat) : on reconstruit ici les 30 jours calendaires pour afficher « Pas de
// données » plutôt qu'un vide silencieux, le plus récent en premier.
import type { ActivityDay, LocalDate } from "@app/contracts";
import { HISTORY_MAX_DAYS } from "@app/contracts";
// Import direct (pas le barrel "../health", qui charge le module natif HealthKit au chargement).
import { addDays, localDateRange } from "../health/aggregate";

export type HistoryRow = { date: LocalDate; entry: ActivityDay | null };

/** `days` : jours connus (n'importe quel ordre). `today` : date locale du jour courant. */
export function buildHistoryRows(
  days: readonly ActivityDay[],
  today: LocalDate,
  span: number = HISTORY_MAX_DAYS,
): HistoryRow[] {
  const byDate = new Map(days.map((day) => [day.date, day]));
  const dates = localDateRange(addDays(today, -(span - 1)), today);
  return dates.map((date) => ({ date, entry: byDate.get(date) ?? null })).reverse();
}

export type HistorySummary = { averageSteps: number; best: { date: LocalDate; steps: number } | null };

/** Moyenne et meilleur jour calculés uniquement sur les jours renseignés (jamais sur des « 0 pas » fictifs). */
export function summarizeHistory(days: readonly ActivityDay[]): HistorySummary {
  if (days.length === 0) return { averageSteps: 0, best: null };
  const total = days.reduce((sum, day) => sum + day.steps, 0);
  const best = days.reduce((max, day) => (day.steps > max.steps ? day : max));
  return { averageSteps: Math.round(total / days.length), best: { date: best.date, steps: best.steps } };
}
