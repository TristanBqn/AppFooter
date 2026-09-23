import type { HealthSource } from "./HealthSource";
import { resolveHealthSourceKind } from "./env";
import { SimulatedHealthSource } from "./SimulatedHealthSource";
import { HealthKitSource } from "./HealthKitSource";

export type { HealthSource } from "./HealthSource";
export { SimulatedHealthSource } from "./SimulatedHealthSource";
export { HealthKitSource, EXCLUDE_USER_ENTERED_FILTER } from "./HealthKitSource";
export { resolveHealthSourceKind, getEasBuildProfile, type HealthSourceKind } from "./env";
export { mergeDailyTotals, localDateRange, toLocalDate, type StatisticsBucket } from "./aggregate";

let cached: HealthSource | null = null;

/** Source active de l'app (garde de production incluse), choisie une seule fois. */
export function getHealthSource(): HealthSource {
  if (!cached) {
    cached = resolveHealthSourceKind() === "simulated" ? new SimulatedHealthSource() : new HealthKitSource();
  }
  return cached;
}

/** Pour les tests : force un nouveau choix au prochain appel de `getHealthSource`. */
export function resetHealthSourceForTests(): void {
  cached = null;
}
