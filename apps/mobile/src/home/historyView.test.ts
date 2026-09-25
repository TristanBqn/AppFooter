import { describe, expect, it } from "vitest";
import type { ActivityDay } from "@app/contracts";
import { buildHistoryRows, summarizeHistory } from "./historyView";

describe("buildHistoryRows", () => {
  it("reconstruit une petite plage complète, le plus récent en premier, avec des trous", () => {
    const days: ActivityDay[] = [{ date: "2026-09-24", steps: 8450, activeCalories: 312 }];
    expect(buildHistoryRows(days, "2026-09-25", 3)).toEqual([
      { date: "2026-09-25", entry: null },
      { date: "2026-09-24", entry: { date: "2026-09-24", steps: 8450, activeCalories: 312 } },
      { date: "2026-09-23", entry: null },
    ]);
  });

  it("30 lignes par défaut (HISTORY_MAX_DAYS)", () => {
    expect(buildHistoryRows([], "2026-09-25")).toHaveLength(30);
  });
});

describe("summarizeHistory", () => {
  it("moyenne et meilleur jour calculés seulement sur les jours connus", () => {
    const days: ActivityDay[] = [
      { date: "2026-09-23", steps: 6000, activeCalories: 200 },
      { date: "2026-09-24", steps: 14_210, activeCalories: 500 },
      { date: "2026-09-25", steps: 8000, activeCalories: 300 },
    ];
    expect(summarizeHistory(days)).toEqual({
      averageSteps: Math.round((6000 + 14_210 + 8000) / 3),
      best: { date: "2026-09-24", steps: 14_210 },
    });
  });

  it("aucun jour connu : pas de meilleur jour, moyenne à 0", () => {
    expect(summarizeHistory([])).toEqual({ averageSteps: 0, best: null });
  });
});
