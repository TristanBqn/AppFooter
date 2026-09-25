import { describe, expect, it } from "vitest";
import { rankEntries } from "./rank";

describe("rankEntries (ADR 003)", () => {
  it("rang « compétition » : égalité => même rang, rang suivant sauté (1, 2, 2, 4)", () => {
    const ranked = rankEntries([
      { key: "a", value: 100 },
      { key: "b", value: 100 },
      { key: "c", value: 50 },
      { key: "d", value: 10 },
    ]);
    expect(ranked.map((r) => r.rank)).toEqual([1, 1, 3, 4]);
  });

  it("tri secondaire par clé croissante à valeur égale", () => {
    const ranked = rankEntries([
      { key: "zed", value: 100 },
      { key: "alice", value: 100 },
    ]);
    expect(ranked.map((r) => r.key)).toEqual(["alice", "zed"]);
    expect(ranked.map((r) => r.rank)).toEqual([1, 1]);
  });

  it("aucune égalité : rangs consécutifs", () => {
    const ranked = rankEntries([
      { key: "a", value: 10 },
      { key: "b", value: 30 },
      { key: "c", value: 20 },
    ]);
    expect(ranked.map((r) => ({ key: r.key, rank: r.rank }))).toEqual([
      { key: "b", rank: 1 },
      { key: "c", rank: 2 },
      { key: "a", rank: 3 },
    ]);
  });

  it("liste vide", () => {
    expect(rankEntries([])).toEqual([]);
  });

  it("ne mute pas le tableau d'entrée", () => {
    const input = [
      { key: "b", value: 1 },
      { key: "a", value: 2 },
    ];
    const copy = [...input];
    rankEntries(input);
    expect(input).toEqual(copy);
  });
});
