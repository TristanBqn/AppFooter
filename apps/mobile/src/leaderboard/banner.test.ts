import { describe, expect, it } from "vitest";
import type { LeaderboardEntry } from "@app/contracts";
import { buildLeaderboardBanner, leaderboardBannerText } from "./banner";

function entry(overrides: Partial<LeaderboardEntry>): LeaderboardEntry {
  return {
    rank: 1,
    userId: "00000000-0000-0000-0000-000000000000",
    username: "tom",
    steps: 0,
    isMe: false,
    lastSyncAt: null,
    ...overrides,
  };
}

describe("buildLeaderboardBanner", () => {
  it("tout le monde à 0 pas, en journée", () => {
    const entries = [entry({ rank: 1, isMe: true, username: "moi" }), entry({ rank: 1, username: "lea" })];
    expect(buildLeaderboardBanner(entries, "daily")).toEqual({ kind: "allZero" });
  });

  it("ne s'applique pas en semaine (0 en début de période, pas d'annonce dédiée)", () => {
    const entries = [entry({ rank: 1, isMe: true, username: "moi" }), entry({ rank: 1, username: "lea" })];
    // Rang 1 partagé -> tiedLead, pas allZero, en dehors du contexte "daily".
    expect(buildLeaderboardBanner(entries, "weekly")).toEqual({ kind: "tiedLead", username: "lea" });
  });

  it("premier seul : leading", () => {
    const entries = [
      entry({ rank: 1, isMe: true, username: "moi", steps: 9000 }),
      entry({ rank: 2, username: "lea", steps: 8000 }),
    ];
    expect(buildLeaderboardBanner(entries, "daily")).toEqual({ kind: "leading" });
  });

  it("premier ex æquo : tiedLead avec l'autre pseudo", () => {
    const entries = [
      entry({ rank: 1, isMe: true, username: "moi", steps: 9000 }),
      entry({ rank: 1, username: "sam.b", steps: 9000 }),
      entry({ rank: 3, username: "lea", steps: 4000 }),
    ];
    expect(buildLeaderboardBanner(entries, "daily")).toEqual({ kind: "tiedLead", username: "sam.b" });
  });

  it("pas premier : overtake, écart + 1 vers le plus proche devant", () => {
    const entries = [
      entry({ rank: 1, username: "lea", steps: 9651 }),
      entry({ rank: 2, isMe: true, username: "moi", steps: 8450 }),
      entry({ rank: 3, username: "sam.b", steps: 3000 }),
    ];
    expect(buildLeaderboardBanner(entries, "daily")).toEqual({ kind: "overtake", username: "lea", steps: 1202 });
  });

  it("absent de la liste : none", () => {
    expect(buildLeaderboardBanner([entry({ rank: 1, username: "lea" })], "daily")).toEqual({ kind: "none" });
  });
});

describe("leaderboardBannerText", () => {
  it("formule le texte pour chaque cas, jamais négatif", () => {
    expect(leaderboardBannerText({ kind: "allZero" }, "daily")).toBe("La journée commence pour tout le monde.");
    expect(leaderboardBannerText({ kind: "leading" }, "daily")).toBe("Tu mènes la journée. Belle régularité !");
    expect(leaderboardBannerText({ kind: "leading" }, "weekly")).toBe("Tu mènes la semaine. Belle régularité !");
    expect(leaderboardBannerText({ kind: "tiedLead", username: "sam.b" }, "daily")).toBe(
      "Tu partages la tête avec sam.b",
    );
    expect(leaderboardBannerText({ kind: "overtake", username: "lea", steps: 1201 }, "daily")).toBe(
      "Encore 1 201 pas pour dépasser lea",
    );
    expect(leaderboardBannerText({ kind: "none" }, "daily")).toBeNull();
  });
});
