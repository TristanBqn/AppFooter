// Machine d'états pure de l'authentification (testable sans navigation ni réseau).
//
// Le consentement santé n'est pas une porte permanente : le brief exige un consentement avant
// toute synchro, pas avant l'usage de l'app (DESIGN.md §1 : « Plus tard » reste possible, l'accueil
// affiche alors « Santé non connectée »). L'écran de consentement est donc un interstitiel montré
// une fois, juste après le choix du pseudo (voir app/(auth)/pseudo.tsx), pas une étape de cette
// machine d'états.
import type { Me } from "@app/contracts";

export type AuthStage = "loading" | "onboarding" | "sessionExpired" | "needsUsername" | "ready" | "error";

export function deriveAuthStageFromMe(me: Me | null): "needsUsername" | "ready" {
  return !me || !me.username ? "needsUsername" : "ready";
}

export type ComputeAuthStageParams = {
  /** `null` tant que la lecture du trousseau n'est pas terminée. */
  hasToken: boolean | null;
  /** Une session existait et a expiré pendant l'utilisation (401) : on saute l'onboarding. */
  expiredWhileRunning: boolean;
  meQuery: { isPending: boolean; isError: boolean; data: Me | undefined };
};

export function computeAuthStage({ hasToken, expiredWhileRunning, meQuery }: ComputeAuthStageParams): AuthStage {
  if (hasToken === null) return "loading";
  if (hasToken === false) return expiredWhileRunning ? "sessionExpired" : "onboarding";
  if (meQuery.isPending) return "loading";
  if (meQuery.isError) return "error";
  return deriveAuthStageFromMe(meQuery.data ?? null);
}
