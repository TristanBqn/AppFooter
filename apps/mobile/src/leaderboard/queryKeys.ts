// Clés TanStack Query partagées entre le Classement et la carte « prochain ami » de l'Accueil
// (screens.md §4), pour réutiliser le même cache au lieu de dupliquer l'appel réseau.
export const LEADERBOARD_DAILY_QUERY_KEY = ["leaderboard", "daily"] as const;
export const LEADERBOARD_WEEKLY_QUERY_KEY = ["leaderboard", "weekly"] as const;
