// Calcul pur de la plage à synchroniser (M5, CA3) : 30 jours au premier lancement (jamais
// synchronisé côté serveur), puis une fenêtre glissante courte à chaque lancement / retour au
// premier plan / tirer-pour-rafraîchir (les upserts sont idempotents, B5, donc un recouvrement
// est sans risque et rattrape les écarts d'horloge/fuseau).
import type { LocalDate } from "@app/contracts";
import { INITIAL_BACKFILL_DAYS } from "@app/contracts";
// Import direct (pas le barrel "../health") : celui-ci réexporte HealthKitSource, qui charge le
// module natif @kingstinct/react-native-healthkit au chargement (voir src/health/index.test.ts) ;
// ce module est purement logique et ne doit dépendre d'aucun mock natif pour être testé.
import { addDays } from "../health/aggregate";

/** Jours couverts par une synchro « courante » (hors tout premier lancement). */
export const ROLLING_SYNC_DAYS = 2;

export type SyncRangeParams = {
  /** `me.lastSyncAt` (ISO) : `null` si jamais synchronisé. */
  lastSyncAt: string | null;
  /** Date locale du jour, déjà résolue par l'appelant (fuseau de l'utilisateur). */
  today: LocalDate;
  rollingDays?: number;
};

/** Plage [from, to] inclus à demander à la source de santé puis envoyer à `PUT /me/activity`. */
export function computeSyncRange({ lastSyncAt, today, rollingDays = ROLLING_SYNC_DAYS }: SyncRangeParams): {
  from: LocalDate;
  to: LocalDate;
} {
  const span = lastSyncAt === null ? INITIAL_BACKFILL_DAYS - 1 : rollingDays - 1;
  return { from: addDays(today, -Math.max(0, span)), to: today };
}
