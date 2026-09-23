// Source simulée (ADR 002) : données déterministes paramétrables, jamais active en build de
// production (voir env.ts). Utile en dev local, aperçu web et tests.
import type { DailyTotal, LocalDate } from "@app/contracts";
import type { HealthSource } from "./HealthSource";
import { localDateRange } from "./aggregate";

export type SimulatedHealthSourceOptions = {
  /** Pas d'un jour "moyen". Défaut : 6000. */
  baseSteps?: number;
  /** Amplitude de variation jour à jour (+/-). Défaut : 4000. */
  variance?: number;
  /** Calories actives pour 1000 pas. Défaut : 40. */
  kcalPerThousandSteps?: number;
};

/** Nombre déterministe dans [0, 1), dérivé de la date : mêmes données à chaque lancement. */
function pseudoRandom(seed: string): number {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return hash / 0xffffffff;
}

export class SimulatedHealthSource implements HealthSource {
  private readonly baseSteps: number;
  private readonly variance: number;
  private readonly kcalPerThousandSteps: number;

  constructor(options: SimulatedHealthSourceOptions = {}) {
    this.baseSteps = options.baseSteps ?? 6_000;
    this.variance = options.variance ?? 4_000;
    this.kcalPerThousandSteps = options.kcalPerThousandSteps ?? 40;
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async requestAuthorization(): Promise<boolean> {
    return true;
  }

  async getDailyTotals(from: LocalDate, to: LocalDate, _timeZone: string): Promise<DailyTotal[]> {
    return localDateRange(from, to).map((date) => {
      const steps = Math.max(0, Math.round(this.baseSteps + (pseudoRandom(date) - 0.5) * 2 * this.variance));
      const activeCalories = Math.round((steps / 1_000) * this.kcalPerThousandSteps);
      return { date, steps, activeCalories };
    });
  }
}
