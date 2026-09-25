import { describe, expect, it } from "vitest";
import { formatLocalTime, formatQuietHour, parseLocalTime } from "./localTime";

describe("localTime", () => {
  it("parseLocalTime lit heures et minutes", () => {
    const date = parseLocalTime("22:05");
    expect(date.getHours()).toBe(22);
    expect(date.getMinutes()).toBe(5);
  });

  it("formatLocalTime remet en forme HH:MM avec zéros", () => {
    const date = new Date(2000, 0, 1, 8, 0);
    expect(formatLocalTime(date)).toBe("08:00");
  });

  it("aller-retour stable", () => {
    expect(formatLocalTime(parseLocalTime("07:30"))).toBe("07:30");
  });

  it("m4 : formatQuietHour sans zéro initial sur l'heure", () => {
    expect(formatQuietHour("08:00")).toBe("8 h 00");
    expect(formatQuietHour("22:00")).toBe("22 h 00");
    expect(formatQuietHour("08:05")).toBe("8 h 05");
  });
});
