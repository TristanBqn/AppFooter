// Implémentation réelle (@kingstinct/react-native-healthkit, dev build EAS uniquement : le
// module natif est absent sur web/Expo Go, dégradation gérée par la bibliothèque elle-même).
//
// Spike M3 : `HKWasUserEntered` est filtrable nativement via un prédicat de métadonnées passé à
// `queryStatisticsCollectionForQuantity` (compte rendu envoyé au lead) — HealthKit déduplique
// aussi les sources (iPhone + Apple Watch) dans cette même requête statistique, contrairement à
// une somme manuelle d'échantillons individuels (ADR 002).
import {
  ComparisonPredicateOperator,
  isHealthDataAvailableAsync,
  queryStatisticsCollectionForQuantity,
  requestAuthorization,
} from "@kingstinct/react-native-healthkit";
import type { DailyTotal, LocalDate } from "@app/contracts";
import type { HealthSource } from "./HealthSource";
import { mergeDailyTotals, type StatisticsBucket } from "./aggregate";

const STEP_TYPE = "HKQuantityTypeIdentifierStepCount" as const;
const ACTIVE_ENERGY_TYPE = "HKQuantityTypeIdentifierActiveEnergyBurned" as const;

/**
 * Exclut les échantillons saisis manuellement (CA4).
 *
 * Risque à vérifier sur appareil réel (non testable sous Windows, checklist M11) : un prédicat
 * `!=` sur une clé de métadonnées peut, selon la sémantique exacte de NSComparisonPredicate côté
 * HealthKit, ne pas matcher les échantillons qui n'ont PAS du tout la clé `HKWasUserEntered`
 * (plutôt que de les traiter comme "différents de true"). Si c'est le cas ici, ce prédicat
 * exclurait à tort la majorité des échantillons auto-enregistrés (iPhone/Apple Watch, qui ne
 * posent en général pas cette clé), au lieu de ne filtrer que les saisies manuelles — un
 * sous-comptage massif des pas, silencieux. Repli prévu si le spike sur appareil confirme le
 * problème : ne plus filtrer côté requête statistique, mais interroger les échantillons bruts
 * (`queryQuantitySamples`) et exclure nous-mêmes ceux dont `metadata.HKWasUserEntered === true`.
 */
export const EXCLUDE_USER_ENTERED_FILTER = {
  withMetadataKey: "HKWasUserEntered",
  operatorType: ComparisonPredicateOperator.notEqualTo,
  value: true,
} as const;

function startOfLocalDay(date: LocalDate): Date {
  const [year, month, day] = date.split("-").map(Number) as [number, number, number];
  return new Date(year, month - 1, day);
}

/** Lendemain minuit local de `date` (borne de fin exclusive pour la fenêtre de requête). */
function startOfNextLocalDay(date: LocalDate): Date {
  const start = startOfLocalDay(date);
  return new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
}

export class HealthKitSource implements HealthSource {
  async isAvailable(): Promise<boolean> {
    return isHealthDataAvailableAsync();
  }

  async requestAuthorization(): Promise<boolean> {
    return requestAuthorization({ toRead: [STEP_TYPE, ACTIVE_ENERGY_TYPE] });
  }

  async getDailyTotals(from: LocalDate, to: LocalDate, timeZone: string): Promise<DailyTotal[]> {
    const anchor = startOfLocalDay(from);
    const dateFilter = { startDate: anchor, endDate: startOfNextLocalDay(to) };

    const [steps, activeCalories] = await Promise.all([
      queryStatisticsCollectionForQuantity(STEP_TYPE, ["cumulativeSum"], anchor, { day: 1 }, {
        unit: "count",
        filter: { date: dateFilter, metadata: EXCLUDE_USER_ENTERED_FILTER },
      }),
      queryStatisticsCollectionForQuantity(ACTIVE_ENERGY_TYPE, ["cumulativeSum"], anchor, { day: 1 }, {
        unit: "kcal",
        filter: { date: dateFilter, metadata: EXCLUDE_USER_ENTERED_FILTER },
      }),
    ]);

    return mergeDailyTotals({
      from,
      to,
      timeZone,
      steps: steps as readonly StatisticsBucket[],
      activeCalories: activeCalories as readonly StatisticsBucket[],
    });
  }
}
