// Types partagés par `app.ts`, les middlewares et les routes : évite un cycle d'import entre eux.
import type { Db } from "@app/db";
import type { Hono } from "hono";
import type { Env } from "./env";

export interface AppDeps {
  db: Db;
  env: Env;
  /** Horloge injectable (tests d'expiration de session, heures silencieuses…). */
  now: () => Date;
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
