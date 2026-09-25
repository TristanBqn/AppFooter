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

/**
 * Mélange final type murmur3 (`fmix32`) : sans lui, `hash * 31 + charCode` ne varie que de
 * quelques unités sur 2³² d'une date à l'autre (m7, jours quasi identiques). Diffuse les bits de
 * poids faible sur tout le nombre avant la division.
 */
function fmix32(value: number): number {
  let h = value >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Nombre déterministe dans [0, 1), dérivé de la date : mêmes données à chaque lancement. */
function pseudoRandom(seed: string): number {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return fmix32(hash) / 0xffffffff;
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
