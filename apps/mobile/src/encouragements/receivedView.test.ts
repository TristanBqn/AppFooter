import { describe, expect, it } from "vitest";
import { hasEncouragementOn, sortByMostRecent, withinLastDays, type ReceivedEncouragement } from "./receivedView";

function item(overrides: Partial<ReceivedEncouragement>): ReceivedEncouragement {
  return {
    id: "00000000-0000-0000-0000-000000000000",
    from: { userId: "00000000-0000-0000-0000-000000000001", username: "lea" },
    messageId: "bravo",
    sentAt: "2026-09-24T08:00:00.000Z",
    ...overrides,
  };
}

describe("sortByMostRecent", () => {
  it("trie du plus récent au plus ancien", () => {
    const items = [item({ id: "a", sentAt: "2026-09-20T08:00:00.000Z" }), item({ id: "b", sentAt: "2026-09-24T08:00:00.000Z" })];
    expect(sortByMostRecent(items).map((i) => i.id)).toEqual(["b", "a"]);
  });
});

describe("hasEncouragementOn", () => {
  it("détecte un encouragement du jour local donné", () => {
    const items = [item({ sentAt: "2026-09-24T23:30:00.000Z" })]; // 25 sept 01:30 à Paris (UTC+2)
    expect(hasEncouragementOn(items, "2026-09-25", "Europe/Paris")).toBe(true);
    expect(hasEncouragementOn(items, "2026-09-24", "Europe/Paris")).toBe(false);
  });

  it("aucun encouragement -> false", () => {
    expect(hasEncouragementOn([], "2026-09-25", "Europe/Paris")).toBe(false);
  });
});

describe("withinLastDays", () => {
  it("ne garde que les 7 derniers jours, triés du plus récent", () => {
    const now = new Date("2026-09-25T12:00:00.000Z");
    const items = [
      item({ id: "recent", sentAt: "2026-09-24T12:00:00.000Z" }),
      item({ id: "old", sentAt: "2026-09-10T12:00:00.000Z" }),
      item({ id: "boundary", sentAt: "2026-09-18T12:00:01.000Z" }),
    ];
    expect(withinLastDays(items, 7, now).map((i) => i.id)).toEqual(["recent", "boundary"]);
  });
});
