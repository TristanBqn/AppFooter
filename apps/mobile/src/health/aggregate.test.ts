import { describe, expect, it } from "vitest";
import { localDateRange, mergeDailyTotals, toLocalDate } from "./aggregate";

describe("toLocalDate", () => {
  it("formate en AAAA-MM-JJ dans le fuseau donné", () => {
    // 2026-01-01T02:00Z est encore le 31 décembre à New York (UTC-5).
    const date = new Date("2026-01-01T02:00:00.000Z");
    expect(toLocalDate(date, "Europe/Paris")).toBe("2026-01-01");
    expect(toLocalDate(date, "America/New_York")).toBe("2025-12-31");
  });
});

describe("localDateRange", () => {
  it("inclut les deux bornes, dans l'ordre chronologique", () => {
    expect(localDateRange("2026-02-27", "2026-03-02")).toEqual([
      "2026-02-27",
      "2026-02-28",
      "2026-03-01",
      "2026-03-02",
    ]);
  });

  it("renvoie un seul jour si from === to", () => {
    expect(localDateRange("2026-01-01", "2026-01-01")).toEqual(["2026-01-01"]);
  });
});

describe("mergeDailyTotals", () => {
  it("somme les compartiments par jour local et arrondit", () => {
    const result = mergeDailyTotals({
      from: "2026-01-01",
      to: "2026-01-02",
      timeZone: "Europe/Paris",
      steps: [
        { startDate: new Date("2026-01-01T00:00:00+01:00"), sumQuantity: { quantity: 4000.4 } },
        { startDate: new Date("2026-01-02T00:00:00+01:00"), sumQuantity: { quantity: 999.6 } },
      ],
      activeCalories: [{ startDate: new Date("2026-01-01T00:00:00+01:00"), sumQuantity: { quantity: 199.9 } }],
    });

    expect(result).toEqual([
      { date: "2026-01-01", steps: 4000, activeCalories: 200 },
      { date: "2026-01-02", steps: 1000, activeCalories: 0 },
    ]);
  });

  it("renvoie un jour à 0/0 (jamais omis) quand HealthKit n'a aucun compartiment ce jour-là", () => {
    const result = mergeDailyTotals({
      from: "2026-01-01",
      to: "2026-01-01",
      timeZone: "Europe/Paris",
      steps: [],
      activeCalories: [],
    });
    expect(result).toEqual([{ date: "2026-01-01", steps: 0, activeCalories: 0 }]);
  });

  it("ne renvoie jamais de valeur négative", () => {
    const result = mergeDailyTotals({
      from: "2026-01-01",
      to: "2026-01-01",
      timeZone: "Europe/Paris",
      steps: [{ startDate: new Date("2026-01-01T00:00:00+01:00"), sumQuantity: { quantity: -5 } }],
      activeCalories: [],
    });
    expect(result[0]?.steps).toBe(0);
  });
});
