// Fournit l'état d'authentification à toute l'app (session + /me). Point d'entrée unique pour
// se connecter, se déconnecter et rafraîchir après un changement de pseudo/consentement.
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Me, Session } from "@app/contracts";
import { api } from "../api/endpoints";
import { getSession, setSession as persistSession, clearSession as clearPersistedSession } from "../api/session";
import { onUnauthorized } from "../api/authEvents";
import { computeAuthStage, type AuthStage } from "./authStage";

export const ME_QUERY_KEY = ["me"] as const;

export type AuthContextValue = {
  stage: AuthStage;
  me: Me | undefined;
  error: unknown;
  /** Persiste la session puis charge /me. À appeler juste après une connexion Apple/dev réussie. */
  signIn: (session: Session) => Promise<void>;
  /** Efface la session locale (déconnexion, suppression de compte). */
  signOut: () => Promise<void>;
  /** Recharge /me (après le choix du pseudo ou le consentement santé). */
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  // `null` tant que la lecture du trousseau (expo-secure-store) n'est pas terminée.
  const [hasToken, setHasToken] = useState<boolean | null>(null);
  const [expiredWhileRunning, setExpiredWhileRunning] = useState(false);

  useEffect(() => {
    let active = true;
    getSession()
      .then((session) => {
        if (active) setHasToken(session !== null);
      })
      .catch(() => {
        if (active) setHasToken(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(
    () =>
      onUnauthorized(() => {
        setExpiredWhileRunning(true);
        setHasToken(false);
        queryClient.removeQueries({ queryKey: ME_QUERY_KEY });
      }),
    [queryClient],
  );

  const meQuery = useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: api.me.get,
    enabled: hasToken === true,
  });

  const stage = computeAuthStage({
    hasToken,
    expiredWhileRunning,
    meQuery: { isPending: meQuery.isPending, isError: meQuery.isError, data: meQuery.data },
  });

  const value = useMemo<AuthContextValue>(
    () => ({
      stage,
      me: meQuery.data,
      error: meQuery.error,
      async signIn(session) {
        await persistSession(session);
        setExpiredWhileRunning(false);
        setHasToken(true);
        await queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
      },
      async signOut() {
        await clearPersistedSession();
        setExpiredWhileRunning(false);
        setHasToken(false);
        queryClient.removeQueries({ queryKey: ME_QUERY_KEY });
      },
      async refresh() {
        await queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
      },
    }),
    [stage, meQuery.data, meQuery.error, queryClient],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être appelé sous AuthProvider");
  return ctx;
}
