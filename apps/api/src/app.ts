// Application Hono : en-têtes de sécurité, journal structuré, authentification Bearer (CA1),
// enveloppe d'erreur unique du contrat (400 validation, 404 JSON, 500 sans détail interne).
// Les routes métier sont ajoutées tâche par tâche (B3 et suivantes).
import type { ApiError } from "@app/contracts";
import { RATE_LIMIT_PER_MINUTE_PER_USER } from "@app/contracts";
import type { Db } from "@app/db";
import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { AppDeps, AppHono } from "./context";
import type { Env } from "./env";
import { AppError } from "./errors";
import { bearerAuth } from "./middleware/auth";
import { rateLimit } from "./middleware/rate-limit";
import { registerAuthRoutes } from "./modules/auth/routes";
import { registerMeRoutes } from "./modules/me/routes";

const ONE_MINUTE_MS = 60_000;

export type { AppDeps, AppHono } from "./context";

function logLine(level: "info" | "error", fields: Record<string, unknown>): void {
  const line = JSON.stringify({ level, ...fields });
  if (level === "error") console.error(line);
  else console.log(line);
}

export interface CreateAppOptions {
  db: Db;
  env: Env;
  /** Horloge injectable (tests). Par défaut `() => new Date()`. */
  now?: () => Date;
}

export function createApp(options: CreateAppOptions): AppHono {
  const deps: AppDeps = { db: options.db, env: options.env, now: options.now ?? (() => new Date()) };
  const app: AppHono = new Hono();

  app.use("*", secureHeaders());

  app.use("*", async (c, next) => {
    const start = Date.now();
    const requestId = crypto.randomUUID();
    c.set("requestId", requestId);
    c.set("deps", deps);
    await next();
    logLine("info", {
      route: `${c.req.method} ${c.req.path}`,
      status: c.res.status,
      durationMs: Date.now() - start,
      requestId,
    });
  });

  app.get("/health", (c) => c.json({ status: "ok" as const }, 200));

  // Authentification (CA1) : pose `c.get("auth")` sur toute route hors PUBLIC_ROUTES, sinon 401.
  app.use("*", bearerAuth);

  // Débit par utilisateur authentifié (ADR 007) ; no-op sur les routes publiques (pas d'auth).
  app.use(
    "*",
    rateLimit({
      max: RATE_LIMIT_PER_MINUTE_PER_USER,
      windowMs: ONE_MINUTE_MS,
      keyFn: (c) => {
        const auth = c.get("auth");
        return auth ? `user:${auth.userId}` : null;
      },
    }),
  );

  registerAuthRoutes(app, deps);
  registerMeRoutes(app, deps);

  app.notFound((c) => {
    const body: ApiError = { error: { code: "NOT_FOUND", message: "Route inconnue" } };
    return c.json(body, 404);
  });

  app.onError((err, c) => {
    if (err instanceof AppError) {
      const body: ApiError = {
        error: { code: err.code, message: err.message, ...(err.issues ? { issues: err.issues } : {}) },
      };
      return c.json(body, err.status as ContentfulStatusCode);
    }
    logLine("error", {
      route: `${c.req.method} ${c.req.path}`,
      requestId: c.get("requestId"),
      message: err instanceof Error ? err.message : "erreur inconnue",
    });
    const body: ApiError = { error: { code: "INTERNAL_ERROR", message: "Erreur interne" } };
    return c.json(body, 500);
  });

  return app;
}
