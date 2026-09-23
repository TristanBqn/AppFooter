// Logique pure : conversion des compartiments HealthKit (un par jour) en `DailyTotal`. Aucune
// dépendance native : testable en vitest. L'exclusion des saisies manuelles (CA4) est demandée
// nativement par HealthKitSource (prédicat de métadonnées, voir le compte rendu du spike M3) ;
// ces fonctions se contentent de sommer et dater des résultats déjà filtrés.
import type { DailyTotal, LocalDate } from "@app/contracts";

/** Une entrée de `queryStatisticsCollectionForQuantity` (une par jour demandé). */
export type StatisticsBucket = {
  startDate: Date;
  sumQuantity?: { quantity: number } | null;
};

/** "AAAA-MM-JJ" dans le fuseau donné (locale en-CA : format déjà ISO). */
export function toLocalDate(date: Date, timeZone: string): LocalDate {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date) as LocalDate;
}

function addDays(date: LocalDate, amount: number): LocalDate {
  const [year, month, day] = date.split("-").map(Number) as [number, number, number];
  const next = new Date(Date.UTC(year, month - 1, day + amount));
  return next.toISOString().slice(0, 10) as LocalDate;
}

/** Dates locales de `from` à `to` inclus, dans l'ordre chronologique. */
export function localDateRange(from: LocalDate, to: LocalDate): LocalDate[] {
  const dates: LocalDate[] = [];
  for (let cursor = from; cursor <= to; cursor = addDays(cursor, 1)) {
    dates.push(cursor);
  }
  return dates;
}

function sumByLocalDate(buckets: readonly StatisticsBucket[], timeZone: string): Map<LocalDate, number> {
  const sums = new Map<LocalDate, number>();
  for (const bucket of buckets) {
    const value = bucket.sumQuantity?.quantity ?? 0;
    const date = toLocalDate(bucket.startDate, timeZone);
    sums.set(date, (sums.get(date) ?? 0) + value);
  }
  return sums;
}

/**
 * Fusionne les compartiments pas/calories en une liste de `DailyTotal`, un par jour de
 * [from, to] inclus (0 par défaut pour un jour sans donnée, plutôt qu'un jour omis : la synchro
 * envoie toujours une plage complète, cf. ADR 002).
 */
export function mergeDailyTotals(params: {
  from: LocalDate;
  to: LocalDate;
  timeZone: string;
  steps: readonly StatisticsBucket[];
  activeCalories: readonly StatisticsBucket[];
}): DailyTotal[] {
  const stepSums = sumByLocalDate(params.steps, params.timeZone);
  const calorieSums = sumByLocalDate(params.activeCalories, params.timeZone);
  return localDateRange(params.from, params.to).map((date) => ({
    date,
    steps: Math.max(0, Math.round(stepSums.get(date) ?? 0)),
    activeCalories: Math.max(0, Math.round(calorieSums.get(date) ?? 0)),
  }));
}
