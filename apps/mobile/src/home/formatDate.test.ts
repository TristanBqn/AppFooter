import { describe, expect, it } from "vitest";
import { formatDayOfMonth, formatHeaderDate, formatShortDate } from "./formatDate";

describe("formatDate", () => {
  it("formatHeaderDate met une majuscule au jour de semaine", () => {
    expect(formatHeaderDate("2026-09-24")).toBe("Jeudi 24 septembre");
  });

  it("formatShortDate abrège le mois", () => {
    expect(formatShortDate("2026-09-24")).toBe("Jeudi 24 sept.");
  });

  it("formatDayOfMonth préfixe « le »", () => {
    expect(formatDayOfMonth("2026-09-12")).toBe("le 12 septembre");
  });

  it("ne glisse pas d'un jour en fin/début de mois", () => {
    expect(formatHeaderDate("2026-01-01")).toBe("Jeudi 1 janvier");
    expect(formatHeaderDate("2025-12-31")).toBe("Mercredi 31 décembre");
  });
});
