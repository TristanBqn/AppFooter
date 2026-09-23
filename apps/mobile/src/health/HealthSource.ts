// Interface commune (ADR 002) : deux implémentations, HealthKitSource (dev build EAS réel) et
// SimulatedHealthSource (dev local, aperçu web, tests). Jamais de type d'API redéfini : les
// totaux quotidiens utilisent `DailyTotal` de @app/contracts.
import type { DailyTotal, LocalDate } from "@app/contracts";

export interface HealthSource {
  isAvailable(): Promise<boolean>;
  /** Demande l'autorisation de lecture des pas et calories actives. */
  requestAuthorization(): Promise<boolean>;
  /**
   * Totaux quotidiens de `from` à `to` inclus (dates locales AAAA-MM-JJ), un par jour du
   * fuseau `timeZone`. Les pas saisis manuellement (`HKWasUserEntered`) sont exclus (CA4).
   */
  getDailyTotals(from: LocalDate, to: LocalDate, timeZone: string): Promise<DailyTotal[]>;
}
