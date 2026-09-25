import { describe, expect, it } from "vitest";
import { addDaysToLocalDate, compareLocalDates, isoWeekday, localDate, mondayOfWeek } from "./local-date";

describe("localDate", () => {
  it("calcule la date civile dans le fuseau donné", () => {
    // 23h locale à Paris (UTC+2 en septembre) le 20 correspond à 21h UTC le 20.
    const instant = new Date("2026-09-20T21:30:00Z");
    expect(localDate(instant, "Europe/Paris")).toBe("2026-09-20");
  });

  it("deux fuseaux peuvent voir des jours civils différents au même instant", () => {
    const instant = new Date("2026-09-20T23:30:00Z");
    expect(localDate(instant, "Europe/Paris")).toBe("2026-09-21");
    expect(localDate(instant, "America/New_York")).toBe("2026-09-20");
  });
});

describe("addDaysToLocalDate", () => {
  it("avance et recule, y compris à cheval sur un changement de mois", () => {
    expect(addDaysToLocalDate("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDaysToLocalDate("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDaysToLocalDate("2026-09-20", -31)).toBe("2026-08-20");
  });
});

describe("compareLocalDates", () => {
  it("ordonne les dates AAAA-MM-JJ lexicographiquement", () => {
    expect(compareLocalDates("2026-09-20", "2026-09-21")).toBeLessThan(0);
    expect(compareLocalDates("2026-09-21", "2026-09-20")).toBeGreaterThan(0);
    expect(compareLocalDates("2026-09-20", "2026-09-20")).toBe(0);
  });
});

describe("isoWeekday / mondayOfWeek", () => {
  it("lundi = 1 … dimanche = 7", () => {
    expect(isoWeekday("2026-09-21")).toBe(1); // lundi
    expect(isoWeekday("2026-09-27")).toBe(7); // dimanche
  });

  it("mondayOfWeek renvoie le lundi de la semaine, y compris pour un dimanche", () => {
    expect(mondayOfWeek("2026-09-24")).toBe("2026-09-21");
    expect(mondayOfWeek("2026-09-21")).toBe("2026-09-21");
    expect(mondayOfWeek("2026-09-27")).toBe("2026-09-21");
  });

  it("semaine à cheval sur un changement de mois", () => {
    expect(mondayOfWeek("2026-03-01")).toBe("2026-02-23");
  });

  it("semaine à cheval sur un changement d'heure (DST) : calcul purement calendaire", () => {
    // Dimanche 25 octobre 2026 : passage heure d'été -> hiver en Europe/Paris. Le calcul ne
    // dépend que de la date civile, jamais d'une heure locale réelle ni d'un fuseau.
    expect(mondayOfWeek("2026-10-25")).toBe("2026-10-19");
    expect(addDaysToLocalDate("2026-10-19", 6)).toBe("2026-10-25");
  });
});
