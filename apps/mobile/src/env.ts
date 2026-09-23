// Détection du profil EAS à l'exécution (app.config.ts expose `extra.easBuildProfile` depuis
// `process.env.EAS_BUILD_PROFILE`, disponible seulement pendant `eas build`). Partagé par tout
// ce qui doit se comporter différemment en production (source de santé, connexion de dev...).
import Constants from "expo-constants";

export function getEasBuildProfile(): string | null {
  const value = Constants.expoConfig?.extra?.easBuildProfile;
  return typeof value === "string" ? value : null;
}

export function isProductionBuild(): boolean {
  return getEasBuildProfile() === "production";
}
