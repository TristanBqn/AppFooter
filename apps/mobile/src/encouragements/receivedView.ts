// Vue pure des encouragements reçus (M8, CA9, screens.md §4). `GET /encouragements/received` ne
// filtre pas par date (juste les RECEIVED_ENCOURAGEMENTS_LIMIT plus récents) : le filtrage « du
// jour » (carte Accueil) et « 7 derniers jours » (Tout voir) se fait ici, côté app.
import type { LocalDate, ReceivedEncouragementsResponse } from "@app/contracts";
import { FRIEND_HISTORY_DAYS } from "@app/contracts";
import { toLocalDate } from "../health/aggregate";

export type ReceivedEncouragement = ReceivedEncouragementsResponse["encouragements"][number];

/** Réutilise la fenêtre de 7 jours déjà définie pour l'historique d'un ami (screens.md §4/§7). */
export const RECEIVED_ENCOURAGEMENTS_WINDOW_DAYS = FRIEND_HISTORY_DAYS;

export function sortByMostRecent(items: readonly ReceivedEncouragement[]): ReceivedEncouragement[] {
  return [...items].sort((a, b) => b.sentAt.localeCompare(a.sentAt));
}

/** Vrai s'il existe au moins un encouragement reçu le `date` local donné (fuseau de l'utilisateur). */
export function hasEncouragementOn(items: readonly ReceivedEncouragement[], date: LocalDate, timeZone: string): boolean {
  return items.some((item) => toLocalDate(new Date(item.sentAt), timeZone) === date);
}

export function withinLastDays(
  items: readonly ReceivedEncouragement[],
  days: number,
  now: Date,
): ReceivedEncouragement[] {
  const cutoff = now.getTime() - days * 24 * 60 * 60 * 1000;
  return sortByMostRecent(items).filter((item) => new Date(item.sentAt).getTime() >= cutoff);
}
