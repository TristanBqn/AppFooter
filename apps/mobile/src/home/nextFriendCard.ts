// Carte « prochain ami » de l'Accueil (screens.md §4) : ami juste devant soi dans le classement du
// jour et écart de pas (« dépasser » = écart + 1, DESIGN.md §5). Masquée sans ami. Réutilise le
// calcul partagé avec le bandeau du Classement (voir ../leaderboard/nextAhead.ts).
import type { LeaderboardEntry } from "@app/contracts";
import { formatSteps } from "@app/ui/format";
import { findNextAhead } from "../leaderboard/nextAhead";

export type NextFriendCard =
  /** Aucun ami dans le classement du jour : carte absente de l'écran. */
  | { kind: "hidden" }
  | { kind: "leading"; title: string; subtitle: string }
  | { kind: "tiedLead"; title: string; username: string }
  | { kind: "overtake"; title: string; subtitle: string; username: string };

export function buildNextFriendCard(entries: readonly LeaderboardEntry[]): NextFriendCard {
  const me = entries.find((entry) => entry.isMe);
  // Le classement contient toujours le demandeur (`LeaderboardResponseSchema`) ; sans lui ou sans
  // aucun ami (moi seul dans la liste), rien à afficher.
  if (!me || entries.length <= 1) return { kind: "hidden" };

  const ahead = findNextAhead(entries, me);
  switch (ahead.kind) {
    case "leading":
      return { kind: "leading", title: "Tu mènes la journée", subtitle: "Profite de ta balade" };
    case "tiedLead":
      return { kind: "tiedLead", title: `Tu partages la tête avec ${ahead.username}`, username: ahead.username };
    case "overtake":
      return {
        kind: "overtake",
        title: `Encore ${formatSteps(ahead.steps)}`,
        subtitle: `pour dépasser ${ahead.username}`,
        username: ahead.username,
      };
  }
}
