import { describe, expect, it } from "vitest";
import {
  formatKcal,
  formatNumber,
  formatRank,
  formatRankLabel,
  formatSteps,
  markTies,
  progressToNext,
  rankAccessibilityLabel,
  stepsToOvertake,
  toPercent,
} from "./format";

const NBSP = " ";

describe("formatage", () => {
  it("groupe les milliers avec une espace insécable", () => {
    expect(formatNumber(0)).toBe("0");
    expect(formatNumber(999)).toBe("999");
    expect(formatNumber(1200)).toBe(`1${NBSP}200`);
    expect(formatNumber(1234567)).toBe(`1${NBSP}234${NBSP}567`);
    expect(formatNumber(-5)).toBe("0");
  });
  it("pas et kcal", () => {
    expect(formatSteps(8450)).toBe(`8${NBSP}450${NBSP}pas`);
    expect(formatKcal(312.4)).toBe(`312${NBSP}kcal`);
  });
  it("rangs en français", () => {
    expect(formatRank(1)).toBe("1er");
    expect(formatRank(2)).toBe("2e");
    expect(formatRankLabel(2, true)).toBe("2e ex æquo");
  });
  it("libellé VoiceOver d'une ligne", () => {
    expect(rankAccessibilityLabel({ rank: 2, tied: true, name: "lea", steps: 8450, isMe: true })).toBe(
      `2e ex æquo, lea, toi, 8${NBSP}450${NBSP}pas`,
    );
  });
});

describe("markTies", () => {
  it("marque les rangs partagés (1, 2, 2, 4)", () => {
    const out = markTies([{ rank: 1 }, { rank: 2 }, { rank: 2 }, { rank: 4 }]);
    expect(out.map((e) => e.tied)).toEqual([false, true, true, false]);
  });
  it("liste vide", () => {
    expect(markTies([])).toEqual([]);
  });
});

describe("progressToNext", () => {
  const thresholds = [10000, 5000, 15000];
  it("avant le premier seuil", () => {
    expect(progressToNext(2500, thresholds)).toEqual({ next: 5000, previous: 0, fraction: 0.5, remaining: 2500 });
  });
  it("entre deux seuils", () => {
    expect(progressToNext(7500, thresholds)).toEqual({ next: 10000, previous: 5000, fraction: 0.5, remaining: 2500 });
  });
  it("pile sur un seuil : vise le suivant", () => {
    expect(progressToNext(10000, thresholds)).toMatchObject({ next: 15000, previous: 10000, fraction: 0 });
  });
  it("tous les seuils franchis", () => {
    expect(progressToNext(20000, thresholds)).toEqual({ next: null, previous: 15000, fraction: 1, remaining: 0 });
  });
  it("pourcentage borné", () => {
    expect(toPercent(0.456)).toBe(46);
    expect(toPercent(2)).toBe(100);
  });
});

describe("stepsToOvertake", () => {
  it("un pas de plus que l'autre", () => {
    expect(stepsToOvertake(8450, 9650)).toBe(1201);
    expect(stepsToOvertake(8450, 8450)).toBe(1);
    expect(stepsToOvertake(9000, 8000)).toBe(0);
  });
});
