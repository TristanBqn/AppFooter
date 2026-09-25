// Bandeau bienveillant du Classement (M6, CA5/CA6, screens.md §5), toujours formulé vers le haut
// (DESIGN.md §5) : jamais de mention négative pour les derniers rangs.
import type { LeaderboardEntry, LeaderboardPeriod } from "@app/contracts";
// Sous-module pur (aucune dépendance React Native/react-native-svg), voir @app/ui/src/index.ts.
import { formatSteps, markTies, stepsToOvertake } from "@app/ui/format";

export type LeaderboardBanner =
  | { kind: "allZero" }
  | { kind: "leading" }
  | { kind: "tiedLead"; username: string }
  | { kind: "overtake"; username: string; steps: number }
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

  if (me.rank === 1) {
    const tied = markTies(entries).find((entry) => entry.isMe)?.tied ?? false;
    if (tied) {
      const other = entries.find((entry) => !entry.isMe && entry.rank === 1);
      if (other) return { kind: "tiedLead", username: other.username };
    }
    return { kind: "leading" };
  }

  const ahead = entries.filter((entry) => entry.steps > me.steps);
  if (ahead.length === 0) return { kind: "leading" };
  const closest = ahead.reduce((min, entry) => (entry.steps < min.steps ? entry : min));
  return { kind: "overtake", username: closest.username, steps: stepsToOvertake(me.steps, closest.steps) };
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
