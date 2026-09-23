// Application Hono : en-têtes de sécurité, journal structuré, route /health, enveloppe
// d'erreur unique du contrat (400 validation, 404 JSON, 500 sans détail interne).
// Les routes métier sont ajoutées tâche par tâche (B3 et suivantes).
import type { ApiError } from "@app/contracts";
import type { Db } from "@app/db";
import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { AppError } from "./errors";

export interface AppDeps {
  db: Db;
}

export interface AppVariables {
  requestId: string;
  deps: AppDeps;
}

export type AppHono = Hono<{ Variables: AppVariables }>;

function logLine(level: "info" | "error", fields: Record<string, unknown>): void {
  const line = JSON.stringify({ level, ...fields });
  if (level === "error") console.error(line);
  else console.log(line);
}

export function createApp(deps: AppDeps): AppHono {
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
