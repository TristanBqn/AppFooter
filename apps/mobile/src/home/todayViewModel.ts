// Modèle d'affichage pur de l'Accueil (M5, CA3) : combine la lecture serveur (`GET /me/today`,
// TanStack Query) et la dernière lecture locale HealthKit du jour courant, pour couvrir les états
// du §4 de screens.md sans dupliquer cette logique dans le composant React.
import type { DailyTotal, TodayResponse } from "@app/contracts";

export type TodayViewModel =
  | { kind: "noConsent" }
  | { kind: "loading" }
  | { kind: "error" }
  | {
      kind: "data";
      steps: number;
      activeCalories: number;
      /** `null` en repli local pur (aucune lecture serveur disponible) : rang non calculable côté app. */
      rank: number | null;
      participants: number | null;
      lastSyncAt: string | null;
      /** Dernière tentative de synchro/lecture en échec : les chiffres affichés peuvent être en retard. */
      degraded: boolean;
    };

export type BuildTodayViewModelParams = {
  hasHealthConsent: boolean;
  isPending: boolean;
  isError: boolean;
  serverData: TodayResponse | undefined;
  /** Dernière lecture locale du jour courant (HealthSource), indépendante du succès de l'envoi serveur. */
  localToday: DailyTotal | null;
};

export function buildTodayViewModel({
  hasHealthConsent,
  isPending,
  isError,
  serverData,
  localToday,
}: BuildTodayViewModelParams): TodayViewModel {
  if (!hasHealthConsent) return { kind: "noConsent" };
  if (isPending) return { kind: "loading" };

  if (serverData) {
    // Erreur de synchro sur des données serveur déjà connues (rafraîchissement en échec, cache
    // conservé par TanStack Query) : préférer la lecture locale la plus fraîche pour le chiffre du
    // jour si elle existe, tout en gardant rang/participants de la dernière synchro réussie
    // (screens.md §4 « Erreur de synchro »).
    const useLocal = isError && localToday !== null;
    return {
      kind: "data",
      steps: useLocal ? localToday.steps : serverData.steps,
      activeCalories: useLocal ? localToday.activeCalories : serverData.activeCalories,
      rank: serverData.rank,
      participants: serverData.participants,
      lastSyncAt: serverData.lastSyncAt,
      degraded: isError,
    };
  }

  if (isError && localToday) {
    // Aucune lecture serveur disponible (premier chargement en échec) mais Santé locale lisible :
    // on affiche au moins les pas du jour plutôt qu'un écran d'erreur bloquant.
    return {
      kind: "data",
      steps: localToday.steps,
      activeCalories: localToday.activeCalories,
      rank: null,
      participants: null,
      lastSyncAt: null,
      degraded: true,
    };
  }

  if (isError) return { kind: "error" };
  return { kind: "loading" };
}
