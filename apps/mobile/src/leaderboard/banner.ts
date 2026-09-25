// Bandeau bienveillant du Classement (M6, CA5/CA6, screens.md §5), toujours formulé vers le haut
// (DESIGN.md §5) : jamais de mention négative pour les derniers rangs.
import type { LeaderboardEntry, LeaderboardPeriod } from "@app/contracts";
import { formatSteps } from "@app/ui/format";
import { findNextAhead, type NextAhead } from "./nextAhead";

export type LeaderboardBanner =
  | NextAhead
  | { kind: "allZero" }
  /** Le demandeur n'apparaît pas dans la liste (ne devrait pas arriver, `LeaderboardResponse` le contient toujours) */
  | { kind: "none" };

export function buildLeaderboardBanner(
  entries: readonly LeaderboardEntry[],
  period: LeaderboardPeriod,
): LeaderboardBanner {
  const me = entries.find((entry) => entry.isMe);
  if (!me) return { kind: "none" };

  // « Tout le monde à 0 » ne concerne en pratique que le début de journée (screens.md §5).
  if (period === "daily" && entries.every((entry) => entry.steps === 0)) {
    return { kind: "allZero" };
  }

  return findNextAhead(entries, me);
}

export function leaderboardBannerText(banner: LeaderboardBanner, period: LeaderboardPeriod): string | null {
  switch (banner.kind) {
    case "allZero":
      return "La journée commence pour tout le monde.";
    case "leading":
      return `Tu mènes la ${period === "daily" ? "journée" : "semaine"}. Belle régularité !`;
    case "tiedLead":
      return `Tu partages la tête avec ${banner.username}.`;
    case "overtake":
      return `Encore ${formatSteps(banner.steps)} pour dépasser ${banner.username}.`;
    case "none":
      return null;
  }
}
