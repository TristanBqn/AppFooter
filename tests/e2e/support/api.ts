// Aides communes aux tests E2E API (reviewer). Aucune route de remise à zéro n'existe côté API
// (docs/architecture.md) : la base PGlite en mémoire est partagée par tout le run Playwright
// (un seul worker), donc chaque test doit générer des identifiants uniques (devUserKey, pseudo).
// Débit /auth/* : `start:e2e` relève RATE_LIMIT_AUTH_PER_MINUTE_PER_IP via `E2E_AUTH_RATE_LIMIT`
// (apps/api/src/server.ts, jamais actif en production) — le pool ci-dessous (CA5-CA9, CA11) reste
// utile pour limiter le nombre de comptes et garder les tests rapides et lisibles.
import { existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { APIRequestContext } from "@playwright/test";
import type { EncouragementMessageId, Settings, SignInResponse, UpdateSettingsRequest } from "@app/contracts";

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

export interface Actor {
  token: string;
  userId: string;
  username: string;
}

/** Connexion de dev + choix immédiat d'un pseudonyme unique. */
export async function signInWithUsername(
  request: APIRequestContext,
  devUserKey: string,
  usernamePrefix: string,
): Promise<Actor> {
  const signIn = await devSignIn(request, devUserKey);
  const username = randomUsername(usernamePrefix);
  const res = await request.put("/me/username", {
    headers: authHeader(signIn.session.token),
    data: { username },
  });
  if (res.status() !== 200) {
    throw new Error(`choix du pseudonyme échoué (${res.status()}) : ${await res.text()}`);
  }
  return { token: signIn.session.token, userId: signIn.userId, username };
}

// --- Pool de comptes partagés (tests/e2e/global-setup.ts) : CA5/CA6, CA7, CA8, CA9, CA11 ---
export const POOL_ROLES = [
  "alice",
  "bob",
  "carol",
  "dave",
  "erin",
  "frank",
  "grace",
  "henry",
  "iris",
  "jules",
] as const;
export type PoolRole = (typeof POOL_ROLES)[number];
export const POOL_FIXTURE_FILE = join(tmpdir(), "footer-e2e", "pool.json");

/** Lit le pool provisionné une fois par `globalSetup` (échoue tôt et clairement si absent). */
export function loadPool(): Record<PoolRole, Actor> {
  if (!existsSync(POOL_FIXTURE_FILE)) {
    throw new Error(
      `Pool de comptes E2E introuvable (${POOL_FIXTURE_FILE}) : globalSetup a-t-il tourné ? (playwright.config.ts)`,
    );
  }
  return JSON.parse(readFileSync(POOL_FIXTURE_FILE, "utf-8")) as Record<PoolRole, Actor>;
}

export function authHeader(token: string): { authorization: string } {
  return { authorization: `Bearer ${token}` };
}

/** Date civile du jour en UTC (AAAA-MM-JJ), indépendante du fuseau de la machine de test. */
export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Consentement santé puis synchro du jour courant (UTC) avec des totaux donnés. */
export async function syncToday(
  request: APIRequestContext,
  actor: Actor,
  steps: number,
  activeCalories = 100,
): Promise<void> {
  const headers = authHeader(actor.token);
  const consent = await request.put("/me/consents/health", { headers, data: { granted: true } });
  if (consent.status() !== 200) {
    throw new Error(`consentement santé échoué (${consent.status()}) : ${await consent.text()}`);
  }
  const sync = await request.put("/me/activity", {
    headers,
    data: { timeZone: "UTC", days: [{ date: todayUtc(), steps, activeCalories }] },
  });
  if (sync.status() !== 200) {
    throw new Error(`synchro échouée (${sync.status()}) : ${await sync.text()}`);
  }
}

export async function updateSettings(
  request: APIRequestContext,
  actor: Actor,
  patch: UpdateSettingsRequest,
): Promise<Settings> {
  const res = await request.patch("/me/settings", { headers: authHeader(actor.token), data: patch });
  if (res.status() !== 200) {
    throw new Error(`mise à jour des paramètres échouée (${res.status()}) : ${await res.text()}`);
  }
  return (await res.json()) as Settings;
}

/** Envoie une demande d'amitié par pseudo exact ; renvoie toujours `{ status: "requested" }` (ADR 005). */
export function sendFriendRequest(
  request: APIRequestContext,
  from: Actor,
  toUsername: string,
): ReturnType<APIRequestContext["post"]> {
  return request.post("/friend-requests", { headers: authHeader(from.token), data: { username: toUsername } });
}

/**
 * A envoie une demande à B puis B l'accepte : les deux deviennent amis. Idempotent (no-op si déjà
 * amis) : plusieurs specs partageant les comptes du pool peuvent l'appeler sans dépendre de l'ordre
 * d'exécution des fichiers.
 */
export async function becomeFriends(request: APIRequestContext, a: Actor, b: Actor): Promise<void> {
  const existing = await request.get("/friends", { headers: authHeader(a.token) });
  const { friends } = (await existing.json()) as { friends: { userId: string }[] };
  if (friends.some((f) => f.userId === b.userId)) return;

  const sent = await request.post("/friend-requests", { headers: authHeader(a.token), data: { username: b.username } });
  if (sent.status() !== 202) {
    throw new Error(`demande d'amitié échouée (${sent.status()}) : ${await sent.text()}`);
  }
  const incoming = await request.get("/friend-requests", { headers: authHeader(b.token) });
  const { incoming: requests } = (await incoming.json()) as {
    incoming: { id: string; from: { userId: string } }[];
  };
  const found = requests.find((r) => r.from.userId === a.userId);
  if (!found) throw new Error(`demande d'amitié introuvable côté ${b.username} (attendu de ${a.username})`);
  const accept = await request.post(`/friend-requests/${found.id}/accept`, { headers: authHeader(b.token) });
  if (accept.status() !== 200) {
    throw new Error(`acceptation échouée (${accept.status()}) : ${await accept.text()}`);
  }
}

export async function block(request: APIRequestContext, blocker: Actor, blockedUserId: string): Promise<void> {
  const res = await request.post("/blocks", { headers: authHeader(blocker.token), data: { userId: blockedUserId } });
  if (res.status() !== 204) {
    throw new Error(`blocage échoué (${res.status()}) : ${await res.text()}`);
  }
}

export async function sendEncouragement(
  request: APIRequestContext,
  from: Actor,
  toUserId: string,
  messageId: EncouragementMessageId,
): ReturnType<APIRequestContext["post"]> {
  return request.post("/encouragements", { headers: authHeader(from.token), data: { toUserId, messageId } });
}
