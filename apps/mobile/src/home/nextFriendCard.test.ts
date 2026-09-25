import { describe, expect, it } from "vitest";
import type { LeaderboardEntry } from "@app/contracts";
import { formatSteps } from "@app/ui/format";
import { buildNextFriendCard } from "./nextFriendCard";

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

describe("buildNextFriendCard", () => {
  it("aucun ami (moi seul dans la liste) : carte masquée", () => {
    const entries = [entry({ rank: 1, isMe: true, username: "moi", steps: 4000 })];
    expect(buildNextFriendCard(entries)).toEqual({ kind: "hidden" });
  });

  it("absent de la liste : carte masquée", () => {
    expect(buildNextFriendCard([entry({ rank: 1, username: "lea" })])).toEqual({ kind: "hidden" });
  });

  it("1er seul : « Tu mènes la journée »", () => {
    const entries = [
      entry({ rank: 1, isMe: true, username: "moi", steps: 9000 }),
      entry({ rank: 2, username: "lea", steps: 8000 }),
    ];
    expect(buildNextFriendCard(entries)).toEqual({
      kind: "leading",
      title: "Tu mènes la journée",
      subtitle: "Profite de ta balade",
    });
  });

  it("1er ex æquo : « Tu partages la tête avec sam.b »", () => {
    const entries = [
      entry({ rank: 1, isMe: true, username: "moi", steps: 9000 }),
      entry({ rank: 1, username: "sam.b", steps: 9000 }),
      entry({ rank: 3, username: "lea", steps: 4000 }),
    ];
    expect(buildNextFriendCard(entries)).toEqual({
      kind: "tiedLead",
      title: "Tu partages la tête avec sam.b",
      username: "sam.b",
    });
  });

  it("pas premier : écart + 1 vers l'ami le plus proche devant", () => {
    const entries = [
      entry({ rank: 1, username: "lea", steps: 9651 }),
      entry({ rank: 2, isMe: true, username: "moi", steps: 8450 }),
      entry({ rank: 3, username: "sam.b", steps: 3000 }),
    ];
    expect(buildNextFriendCard(entries)).toEqual({
      kind: "overtake",
      title: `Encore ${formatSteps(1202)}`,
      subtitle: "pour dépasser lea",
      username: "lea",
    });
  });
});
