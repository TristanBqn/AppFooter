// Client TanStack Query partagé. Nouvelles tentatives seulement pour les erreurs transitoires
// (réseau, délai, 5xx) : jamais sur une erreur applicative claire (validation, 401, 404...).
import { QueryClient } from "@tanstack/react-query";
import { ApiClientError } from "./errors";

const MAX_RETRIES = 2;

function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= MAX_RETRIES) return false;
  if (error instanceof ApiClientError) {
    if (error.kind === "network" || error.kind === "timeout") return true;
    if (error.kind === "http") return (error.status ?? 0) >= 500;
    return false;
  }
  return true;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: shouldRetry,
      staleTime: 30_000,
    },
    mutations: {
      // Effets de bord (envoi, acceptation...) : une nouvelle tentative automatique pourrait
      // dupliquer l'action. Les écrans gèrent leur propre bouton "Réessayer".
      retry: false,
    },
  },
});
