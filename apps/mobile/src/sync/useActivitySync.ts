// Synchro des totaux quotidiens (M5, CA3) : lecture HealthSource -> PUT /me/activity, déclenchée
// au lancement, au retour au premier plan et à la demande (tirer-pour-rafraîchir). Aucune action
// n'échoue silencieusement : l'écran Accueil combine `syncError` et `localToday` via
// `buildTodayViewModel` (src/home/todayViewModel.ts) pour rester utilisable hors ligne.
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import type { DailyTotal } from "@app/contracts";
import { api } from "../api/endpoints";
import { ApiClientError } from "../api/errors";
import { getHealthSource, toLocalDate } from "../health";
import { TODAY_QUERY_KEY } from "../home/todayQuery";
import { computeSyncRange } from "./syncRange";

export type ActivitySyncState = {
  /** Dernière lecture locale du jour courant, que l'envoi au serveur ait réussi ou non. */
  localToday: DailyTotal | null;
  syncing: boolean;
  syncError: ApiClientError | null;
  sync: () => Promise<void>;
};

export type UseActivitySyncParams = {
  /** Consentement santé donné (PUT /me/consents/health) : aucune lecture/synchro sinon (CA3). */
  enabled: boolean;
  timeZone: string;
  /** `me.lastSyncAt` : détermine la profondeur du rattrapage (voir syncRange.ts). */
  lastSyncAt: string | null;
};

function toApiClientError(error: unknown): ApiClientError {
  if (error instanceof ApiClientError) return error;
  return new ApiClientError({
    kind: "network",
    message: error instanceof Error ? error.message : "Erreur de synchro inconnue",
    userMessage: "Vérifie ta connexion puis réessaie.",
  });
}

export function useActivitySync({ enabled, timeZone, lastSyncAt }: UseActivitySyncParams): ActivitySyncState {
  const queryClient = useQueryClient();
  const [localToday, setLocalToday] = useState<DailyTotal | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<ApiClientError | null>(null);
  // Lu dans `sync` sans devenir une dépendance qui relancerait l'effet de premier plan à chaque
  // synchro réussie (lastSyncAt change alors juste après).
  const lastSyncAtRef = useRef(lastSyncAt);
  lastSyncAtRef.current = lastSyncAt;

  const sync = useCallback(async () => {
    if (!enabled) return;
    setSyncing(true);
    try {
      const source = getHealthSource();
      if (!(await source.isAvailable())) {
        setLocalToday(null);
        setSyncError(null);
        return;
      }
      const today = toLocalDate(new Date(), timeZone);
      const { from, to } = computeSyncRange({ lastSyncAt: lastSyncAtRef.current, today });
      const days = await source.getDailyTotals(from, to, timeZone);
      setLocalToday(days.find((day) => day.date === today) ?? null);

      await api.activity.sync({ timeZone, days });
      setSyncError(null);
      await queryClient.invalidateQueries({ queryKey: TODAY_QUERY_KEY });
    } catch (error) {
      setSyncError(toApiClientError(error));
    } finally {
      setSyncing(false);
    }
  }, [enabled, timeZone, queryClient]);

  useEffect(() => {
    if (!enabled) return;
    void sync();
    const subscription = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active") void sync();
    });
    return () => subscription.remove();
    // `sync` volontairement absent des dépendances : seul un changement de `enabled` doit relancer
    // l'abonnement (sync() lit toujours timeZone/lastSyncAt à jour via ses propres closures/ref).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return { localToday, syncing, syncError, sync };
}
