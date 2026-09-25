import { describe, expect, it } from "vitest";
import { SimulatedHealthSource } from "./SimulatedHealthSource";

describe("SimulatedHealthSource", () => {
  it("est toujours disponible et autorisée", async () => {
    const source = new SimulatedHealthSource();
    expect(await source.isAvailable()).toBe(true);
    expect(await source.requestAuthorization()).toBe(true);
  });

  it("renvoie un total par jour de la plage, jamais négatif", async () => {
    const source = new SimulatedHealthSource();
    const days = await source.getDailyTotals("2026-01-01", "2026-01-05", "Europe/Paris");
    expect(days).toHaveLength(5);
    for (const day of days) {
      expect(day.steps).toBeGreaterThanOrEqual(0);
      expect(day.activeCalories).toBeGreaterThanOrEqual(0);
    }
  });

  it("est déterministe : deux appels renvoient les mêmes valeurs pour la même date", async () => {
    const source = new SimulatedHealthSource();
    const [first] = await source.getDailyTotals("2026-03-15", "2026-03-15", "Europe/Paris");
    const [second] = await source.getDailyTotals("2026-03-15", "2026-03-15", "Europe/Paris");
    expect(first).toEqual(second);
  });

  it("respecte les options fournies", async () => {
    const source = new SimulatedHealthSource({ baseSteps: 10_000, variance: 0, kcalPerThousandSteps: 50 });
    const [day] = await source.getDailyTotals("2026-01-01", "2026-01-01", "Europe/Paris");
    expect(day).toEqual({ date: "2026-01-01", steps: 10_000, activeCalories: 500 });
  });

  it("m7 : des jours vraiment distincts, pas quasi constants (mélange final fmix32)", async () => {
    const source = new SimulatedHealthSource();
    const days = await source.getDailyTotals("2026-01-01", "2026-01-30", "Europe/Paris");
    const distinctValues = new Set(days.map((day) => day.steps));
    // Avant fmix32, deux jours consécutifs ne différaient que de quelques unités sur 2^32 : la
    // division par 0xffffffff les rendait quasi indiscernables une fois arrondis en pas.
    expect(distinctValues.size).toBeGreaterThan(20);
  });

  it("m7 : jours au-dessus et en dessous du seuil `SunBadge` (10 000 pas)", async () => {
    const source = new SimulatedHealthSource();
    const days = await source.getDailyTotals("2026-01-01", "2026-01-30", "Europe/Paris");
    expect(days.some((day) => day.steps >= 10_000)).toBe(true);
    expect(days.some((day) => day.steps < 10_000)).toBe(true);
  });

  it("m7 (boucle 2) : ~30-40 % des jours par défaut franchissent 10 000 pas, sans quoi SunBadge n'apparaît jamais", async () => {
    // Historique (screens.md §8) : `SunBadge` s'affiche à partir de 10 000 pas. Avec l'ancien
    // défaut (baseSteps 6000, variance 4000), l'amplitude [2000, 10000) n'atteignait jamais ce
    // seuil : SunBadge n'était donc jamais visible sur la source simulée.
    const source = new SimulatedHealthSource();
    const days = await source.getDailyTotals("2026-01-01", "2026-01-30", "Europe/Paris");
    const aboveThreshold = days.filter((day) => day.steps >= 10_000).length;
    const ratio = aboveThreshold / days.length;
    expect(ratio).toBeGreaterThanOrEqual(0.3);
    expect(ratio).toBeLessThanOrEqual(0.4);
  });
});
