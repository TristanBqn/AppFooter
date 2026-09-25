// Aides communes aux tests E2E API (reviewer). Aucune route de remise à zéro n'existe côté API
// (docs/architecture.md) : la base PGlite en mémoire est partagée par tout le run Playwright
// (un seul worker), donc chaque test doit générer des identifiants uniques (devUserKey, pseudo).
import type { APIRequestContext } from "@playwright/test";
import type { SignInResponse } from "@app/contracts";

/** Alphabet réduit à [a-z0-9], compatible à la fois avec `devUserKey` et `username`. */
function randomToken(length: number): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

/** Clé de connexion de dev unique (`^[a-z0-9_-]{1,32}$`). */
export function randomDevUserKey(prefix: string): string {
  return `${prefix}${randomToken(10)}`.slice(0, 32);
}

/** Pseudonyme unique valide (3–20, `[a-z0-9_.]`). */
export function randomUsername(prefix: string): string {
  return `${prefix}${randomToken(8)}`.slice(0, 20);
}

export async function devSignIn(request: APIRequestContext, devUserKey: string): Promise<SignInResponse> {
  const res = await request.post("/auth/dev", { data: { devUserKey } });
  if (res.status() !== 200) {
    throw new Error(`connexion de dev échouée (${res.status()}) : ${await res.text()}`);
  }
  return (await res.json()) as SignInResponse;
}

/** Connexion de dev + choix immédiat d'un pseudonyme unique. Renvoie le jeton et le pseudo. */
export async function signInWithUsername(
  request: APIRequestContext,
  devUserKey: string,
  usernamePrefix: string,
): Promise<{ token: string; username: string; userId: string }> {
  const signIn = await devSignIn(request, devUserKey);
  const username = randomUsername(usernamePrefix);
  const res = await request.put("/me/username", {
    headers: authHeader(signIn.session.token),
    data: { username },
  });
  if (res.status() !== 200) {
    throw new Error(`choix du pseudonyme échoué (${res.status()}) : ${await res.text()}`);
  }
  return { token: signIn.session.token, username, userId: signIn.userId };
}

export function authHeader(token: string): { authorization: string } {
  return { authorization: `Bearer ${token}` };
}

/** Date civile du jour en UTC (AAAA-MM-JJ), indépendante du fuseau de la machine de test. */
export function todayUtc(): string {
  const iso = new Date().toISOString();
  const datePart = iso.slice(0, 10);
  return datePart;
}
