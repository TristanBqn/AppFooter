// Calcul partagé « ami juste devant soi » dans un classement (le plus proche par pas, écart + 1,
// DESIGN.md §5) : utilisé par le bandeau du Classement (banner.ts) et la carte « prochain ami » de
// l'Accueil (screens.md §4).
import type { LeaderboardEntry } from "@app/contracts";
import { markTies, stepsToOvertake } from "@app/ui/format";

export type NextAhead =
  | { kind: "leading" }
  | { kind: "tiedLead"; username: string }
  | { kind: "overtake"; username: string; steps: number };

export function findNextAhead(entries: readonly LeaderboardEntry[], me: LeaderboardEntry): NextAhead {
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
