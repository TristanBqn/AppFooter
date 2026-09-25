import { describe, expect, it } from "vitest";
import { computeSyncRange } from "./syncRange";

describe("computeSyncRange", () => {
  it("remonte à 30 jours (INITIAL_BACKFILL_DAYS) au tout premier lancement", () => {
    expect(computeSyncRange({ lastSyncAt: null, today: "2026-09-25" })).toEqual({
      from: "2026-08-27",
      to: "2026-09-25",
    });
  });

  it("se limite à une fenêtre glissante courte une fois déjà synchronisé", () => {
    expect(computeSyncRange({ lastSyncAt: "2026-09-24T08:00:00.000Z", today: "2026-09-25" })).toEqual({
      from: "2026-09-24",
      to: "2026-09-25",
    });
  });

  it("accepte une fenêtre glissante personnalisée", () => {
    expect(
      computeSyncRange({ lastSyncAt: "2026-09-20T08:00:00.000Z", today: "2026-09-25", rollingDays: 5 }),
    ).toEqual({ from: "2026-09-21", to: "2026-09-25" });
  });

  it("traverse correctement un changement de mois", () => {
    expect(computeSyncRange({ lastSyncAt: null, today: "2026-01-05" })).toEqual({
      from: "2025-12-07",
      to: "2026-01-05",
    });
  });
});
