// Modèle d'affichage de la tuile « Rang du jour » de l'Accueil (M6/M7, screens.md §4.3).
// Le classement du jour (déjà chargé par ailleurs, voir LEADERBOARD_DAILY_QUERY_KEY) est la
// source de vérité pour le rang et les égalités : une erreur de GET /me/today (M6) ne doit jamais
// laisser croire à tort que l'utilisateur n'a aucun ami, et markTies() y donne le « ex æquo » (M7)
// que /me/today ne fournit pas.
import type { LeaderboardEntry } from "@app/contracts";
import { markTies } from "@app/ui/format";

export type RankTileViewModel =
  /** Aucun ami dans le classement : tuile « Amis » / « Ajoute un ami ». */
  | { kind: "noFriends" }
  /** Rang indisponible (classement et /me/today tous deux en erreur) : tuile non pressable. */
  | { kind: "unknown" }
  | { kind: "rank"; rank: number; tied: boolean; participants: number };

export type RankTileFallback = {
  /** `TodayResponse.rank` / `.participants`, utilisés tant que le classement du jour n'est pas chargé. */
  rank: number | null;
  participants: number | null;
};

export function buildRankTileViewModel(
  leaderboardEntries: readonly LeaderboardEntry[] | undefined,
  fallback: RankTileFallback,
): RankTileViewModel {
  if (leaderboardEntries && leaderboardEntries.length > 0) {
    if (leaderboardEntries.length <= 1) return { kind: "noFriends" };
    const me = markTies(leaderboardEntries).find((entry) => entry.isMe);
    if (me) return { kind: "rank", rank: me.rank, tied: me.tied, participants: leaderboardEntries.length };
  }

  if (fallback.rank !== null && fallback.participants !== null) {
    if (fallback.participants <= 1) return { kind: "noFriends" };
    return { kind: "rank", rank: fallback.rank, tied: false, participants: fallback.participants };
  }

  return { kind: "unknown" };
}
