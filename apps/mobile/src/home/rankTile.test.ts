import { describe, expect, it } from "vitest";
import type { LeaderboardEntry } from "@app/contracts";
import { buildRankTileViewModel } from "./rankTile";

function entry(overrides: Partial<LeaderboardEntry>): LeaderboardEntry {
  return { userId: "u1", username: "tom", rank: 1, steps: 0, isMe: false, ...overrides } as LeaderboardEntry;
}

describe("buildRankTileViewModel", () => {
  it("classement chargé, sans ami : aucun ami", () => {
    const entries = [entry({ userId: "me", isMe: true, rank: 1, steps: 100 })];
    expect(buildRankTileViewModel(entries, { rank: 1, participants: 1 })).toEqual({ kind: "noFriends" });
  });

  it("classement chargé, avec amis : rang et égalité depuis le classement", () => {
    const entries = [
      entry({ userId: "a", rank: 1, steps: 100 }),
      entry({ userId: "me", isMe: true, rank: 2, steps: 80 }),
      entry({ userId: "b", rank: 2, steps: 80 }),
    ];
    expect(buildRankTileViewModel(entries, { rank: null, participants: null })).toEqual({
      kind: "rank",
      rank: 2,
      tied: true,
      participants: 3,
    });
  });

  it("M6 : GET /me/today en erreur mais classement du jour disponible en cache : rang connu, pas 'aucun ami'", () => {
    const entries = [
      entry({ userId: "a", rank: 1, steps: 100 }),
      entry({ userId: "me", isMe: true, rank: 2, steps: 80 }),
      entry({ userId: "b", rank: 3, steps: 50 }),
    ];
    expect(buildRankTileViewModel(entries, { rank: null, participants: null })).toEqual({
      kind: "rank",
      rank: 2,
      tied: false,
      participants: 3,
    });
  });

  it("classement pas encore chargé : repli sur /me/today", () => {
    expect(buildRankTileViewModel(undefined, { rank: 2, participants: 5 })).toEqual({
      kind: "rank",
      rank: 2,
      tied: false,
      participants: 5,
    });
  });

  it("classement pas encore chargé, /me/today sans ami : aucun ami", () => {
    expect(buildRankTileViewModel(undefined, { rank: 1, participants: 1 })).toEqual({ kind: "noFriends" });
  });

  it("classement et /me/today tous deux indisponibles : rang inconnu", () => {
    expect(buildRankTileViewModel(undefined, { rank: null, participants: null })).toEqual({ kind: "unknown" });
  });
});
