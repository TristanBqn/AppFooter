// Choix de la source de santé (ADR 002) et garde de production.
import Constants from "expo-constants";

export type HealthSourceKind = "healthkit" | "simulated";

/**
 * Profil EAS ayant produit ce build (`extra.easBuildProfile`, injecté par app.config.ts depuis
 * `process.env.EAS_BUILD_PROFILE`). `null` hors d'un build EAS (expo start/export, dev build
 * lancé localement) : ce n'est alors jamais un build de production.
 */
export function getEasBuildProfile(): string | null {
  const value = Constants.expoConfig?.extra?.easBuildProfile;
  return typeof value === "string" ? value : null;
}

/**
 * `simulated` est refusé si le profil EAS est `production` (ADR 002, RGPD : jamais de données
 * fictives ni de contournement de HealthKit en production). Paramètres explicites pour un test
 * unitaire sans mock.
 */
export function resolveHealthSourceKind(
  requested: string | undefined = process.env.EXPO_PUBLIC_HEALTH_SOURCE,
  easBuildProfile: string | null = getEasBuildProfile(),
): HealthSourceKind {
  const kind: HealthSourceKind = requested === "simulated" ? "simulated" : "healthkit";
  if (kind === "simulated" && easBuildProfile === "production") {
    throw new Error(
      'EXPO_PUBLIC_HEALTH_SOURCE=simulated est interdit en build de production (profil EAS "production").',
    );
  }
  return kind;
}
