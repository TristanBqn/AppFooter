// Types partagés par `app.ts`, les middlewares et les routes : évite un cycle d'import entre eux.
import type { Db } from "@app/db";
import type { Hono } from "hono";
import type { Env } from "./env";
import type { AppleIdentityVerifier } from "./modules/auth/apple/identity-verifier";
import type { AppleTokenClient } from "./modules/auth/apple/token-client";
import type { PushTransport } from "./modules/notifications/transport";

export interface AppDeps {
  db: Db;
  env: Env;
  /** Horloge injectable (tests d'expiration de session, heures silencieuses…). */
  now: () => Date;
  appleIdentityVerifier: AppleIdentityVerifier;
  appleTokenClient: AppleTokenClient;
  pushTransport: PushTransport;
  /** Injectable (tests) ; `MAX_FRIENDS` (`@app/contracts`) par défaut. */
  maxFriends: number;
  /** Injectable (tests, E2E via `E2E_AUTH_RATE_LIMIT`) ; `RATE_LIMIT_AUTH_PER_MINUTE_PER_IP` par défaut. */
  authRateLimitPerMinute: number;
}

/** Posé par le middleware d'authentification (`middleware/auth.ts`) sur les routes non publiques. */
export interface AuthContext {
  sessionId: string;
  userId: string;
  username: string | null;
}

export interface AppVariables {
  requestId: string;
  deps: AppDeps;
  auth?: AuthContext;
}

export type AppEnv = { Variables: AppVariables };

export type AppHono = Hono<AppEnv>;
