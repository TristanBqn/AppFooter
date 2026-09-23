// Limitation de débit HTTP en mémoire, fenêtre glissante d'une minute (ADR 007). Exact en
// instance unique seulement ; suffisant pour le public restreint visé en V1.
import type { Context, MiddlewareHandler } from "hono";
import { AppError } from "../errors";
import type { AppEnv } from "../context";

const buckets = new Map<string, number[]>();

/** Réservé aux tests : évite les faux positifs entre cas de test successifs. */
export function resetRateLimits(): void {
  buckets.clear();
}

interface ConsumeResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

function consume(key: string, max: number, windowMs: number, now: number): ConsumeResult {
  const cutoff = now - windowMs;
  const hits = (buckets.get(key) ?? []).filter((t) => t > cutoff);
  if (hits.length >= max) {
    const oldest = hits[0] ?? now;
    buckets.set(key, hits);
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)) };
  }
  hits.push(now);
  buckets.set(key, hits);
  return { allowed: true, retryAfterSeconds: 0 };
}

export interface RateLimitOptions {
  /** Nombre maximum de requêtes acceptées par fenêtre. */
  max: number;
  /** Taille de la fenêtre glissante, en millisecondes (60 000 pour toutes les limites V1). */
  windowMs: number;
  /** Clé de compartimentage (par IP ou par utilisateur selon la route). */
  keyFn: (c: Context<AppEnv>) => string | null;
}

/** `keyFn` peut renvoyer `null` pour laisser passer (ex. pas d'utilisateur authentifié encore). */
export function rateLimit(options: RateLimitOptions): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const key = options.keyFn(c);
    if (key === null) return next();
    const now = c.get("deps").now().getTime();
    const result = consume(key, options.max, options.windowMs, now);
    if (!result.allowed) {
      c.header("Retry-After", String(result.retryAfterSeconds));
      throw new AppError("RATE_LIMITED", "Trop de requêtes, réessaie plus tard");
    }
    await next();
  };
}
