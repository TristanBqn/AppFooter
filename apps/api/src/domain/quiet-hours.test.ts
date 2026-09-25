import { describe, expect, it } from "vitest";
import { endOfQuietWindow, isQuietTime, localMinutesOfDay, zonedDateTimeToInstant } from "./quiet-hours";

const DEFAULT = { enabled: true, start: "22:00", end: "08:00" };

describe("zonedDateTimeToInstant", () => {
  it("convertit une heure locale en instant UTC (Europe/Paris, UTC+2 en septembre)", () => {
    expect(zonedDateTimeToInstant("2026-09-20", "08:00", "Europe/Paris")).toEqual(new Date("2026-09-20T06:00:00.000Z"));
  });

  it("gère le passage à l'heure d'hiver (Europe/Paris, UTC+1 en novembre)", () => {
    expect(zonedDateTimeToInstant("2026-11-20", "08:00", "Europe/Paris")).toEqual(new Date("2026-11-20T07:00:00.000Z"));
  });

  it("America/New_York (UTC-4 en septembre)", () => {
    expect(zonedDateTimeToInstant("2026-09-20", "08:00", "America/New_York")).toEqual(new Date("2026-09-20T12:00:00.000Z"));
  });
});

describe("isQuietTime (ADR 004, plage 22:00–08:00 à cheval sur minuit)", () => {
  it("rien n'est silencieux en pleine journée", () => {
    const now = new Date("2026-09-20T12:00:00Z"); // 14h à Paris
    expect(isQuietTime(now, "Europe/Paris", DEFAULT)).toBe(false);
  });

  it("silencieux juste après le début de la plage (22h locale)", () => {
    const now = new Date("2026-09-20T20:30:00Z"); // 22h30 à Paris
    expect(isQuietTime(now, "Europe/Paris", DEFAULT)).toBe(true);
  });

  it("silencieux juste avant la fin de la plage (7h59 locale)", () => {
    const now = new Date("2026-09-20T05:59:00Z"); // 7h59 à Paris
    expect(isQuietTime(now, "Europe/Paris", DEFAULT)).toBe(true);
  });

  it("n'est plus silencieux à la fin exacte de la plage (8h00 locale)", () => {
    const now = new Date("2026-09-20T06:00:00Z"); // 8h00 pile à Paris
    expect(isQuietTime(now, "Europe/Paris", DEFAULT)).toBe(false);
  });

  it("deux fuseaux différents peuvent être silencieux ou non au même instant", () => {
    const now = new Date("2026-09-20T23:00:00Z"); // 1h à Paris (silencieux), 19h à New York (pas silencieux)
    expect(isQuietTime(now, "Europe/Paris", DEFAULT)).toBe(true);
    expect(isQuietTime(now, "America/New_York", DEFAULT)).toBe(false);
  });

  it("désactivé ⇒ jamais silencieux", () => {
    const now = new Date("2026-09-20T20:30:00Z");
    expect(isQuietTime(now, "Europe/Paris", { ...DEFAULT, enabled: false })).toBe(false);
  });

  it("plage ne chevauchant pas minuit (ex. 13:00–14:00)", () => {
    const inside = new Date("2026-09-20T11:30:00Z"); // 13h30 à Paris
    const outside = new Date("2026-09-20T10:00:00Z"); // 12h à Paris
    expect(isQuietTime(inside, "Europe/Paris", { enabled: true, start: "13:00", end: "14:00" })).toBe(true);
    expect(isQuietTime(outside, "Europe/Paris", { enabled: true, start: "13:00", end: "14:00" })).toBe(false);
  });
});

describe("endOfQuietWindow", () => {
  it("en début de soirée : fin le lendemain matin", () => {
    const now = new Date("2026-09-20T20:30:00Z"); // 22h30 à Paris, le 20
    expect(endOfQuietWindow(now, "Europe/Paris", DEFAULT)).toEqual(zonedDateTimeToInstant("2026-09-21", "08:00", "Europe/Paris"));
  });

  it("après minuit : fin le matin même", () => {
    const now = new Date("2026-09-20T05:00:00Z"); // 7h à Paris, le 20 (déjà après minuit)
    expect(endOfQuietWindow(now, "Europe/Paris", DEFAULT)).toEqual(zonedDateTimeToInstant("2026-09-20", "08:00", "Europe/Paris"));
  });
});

describe("localMinutesOfDay", () => {
  it("minuit local = 0", () => {
    expect(localMinutesOfDay(zonedDateTimeToInstant("2026-09-20", "00:00", "Europe/Paris"), "Europe/Paris")).toBe(0);
  });
});
