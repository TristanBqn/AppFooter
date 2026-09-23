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
});
