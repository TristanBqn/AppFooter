import type { ExpoConfig } from "expo/config";

// app.config.ts (plutôt que app.json statique) : nécessaire pour exposer le profil de build EAS
// à l'exécution via `extra` (garde SimulatedHealthSource en production, voir src/health/env.ts
// et ADR 002). `process.env.EAS_BUILD_PROFILE` n'existe que pendant `eas build` ; en local
// (`expo start`/`export`), `extra.easBuildProfile` vaut `null` (jamais "production").
const config: ExpoConfig = {
  name: "Footer",
  slug: "footer",
  scheme: "footer",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  backgroundColor: "#EEF7FF",
  ios: {
    bundleIdentifier: "fr.tristanbqn.footer",
    supportsTablet: false,
  },
  web: {
    favicon: "./assets/favicon.png",
    bundler: "metro",
  },
  plugins: [
    "expo-router",
    [
      "expo-build-properties",
      {
        ios: {
          deploymentTarget: "17.0",
        },
      },
    ],
    "expo-font",
    "expo-secure-store",
    [
      "@kingstinct/react-native-healthkit",
      {
        NSHealthShareUsageDescription:
          "Footer lit tes pas et tes calories actives dans Apple Santé pour afficher ton activité et te comparer à tes amis.",
        // L'app ne modifie jamais Apple Santé (lecture seule).
        NSHealthUpdateUsageDescription: false,
        // Pas de synchronisation en arrière-plan en V1 (décision produit).
        background: false,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    easBuildProfile: process.env.EAS_BUILD_PROFILE ?? null,
  },
};

export default config;
