// Authentification Bearer (ADR 001, CA1) : sans session valide, 401 UNAUTHENTICATED sur toute
// route hors `PUBLIC_ROUTES`. Doit être monté avant toute route métier.
import { API_ROUTES, PUBLIC_ROUTES } from "@app/contracts";
import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../context";
import { AppError } from "../errors";
import { extractBearerToken } from "../lib/session-token";
import { resolveSession } from "../modules/auth/session";

const PUBLIC_ROUTE_KEYS: ReadonlySet<string> = new Set(PUBLIC_ROUTES.map((name) => API_ROUTES[name]));

export function isPublicRoute(method: string, path: string): boolean {
  return PUBLIC_ROUTE_KEYS.has(`${method} ${path}`);
}

export const bearerAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (isPublicRoute(c.req.method, c.req.path)) {
    return next();
  }
  const token = extractBearerToken(c.req.header("authorization"));
  if (!token) {
    throw new AppError("UNAUTHENTICATED", "Authentification requise");
  }
  const deps = c.get("deps");
  const auth = await resolveSession(deps.db, token, deps.now());
  if (!auth) {
    throw new AppError("UNAUTHENTICATED", "Session invalide ou expirée");
  }
  c.set("auth", auth);
  await next();
};
