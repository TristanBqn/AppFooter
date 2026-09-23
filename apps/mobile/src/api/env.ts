// Variables lues par Expo au build (préfixe EXPO_PUBLIC_ requis). Voir .env.example et
// docs/architecture.md §8. Repli sur le port 4000 par défaut (apps/api) pour le confort en dev local.
export const API_BASE_URL = (process.env.EXPO_PUBLIC_API_URL?.trim() || "http://localhost:4000").replace(
  /\/+$/,
  "",
);
