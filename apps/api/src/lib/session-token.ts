// Jeton de session opaque (ADR 001) : 32 octets aléatoires envoyés au client, seul le SHA-256
// est stocké en base (`sessions.token_hash`).
import { createHash, randomBytes } from "node:crypto";

export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Extrait le jeton d'un en-tête `Authorization: Bearer <token>` ; null si absent ou malformé. */
export function extractBearerToken(authorizationHeader: string | undefined): string | null {
  if (!authorizationHeader) return null;
  const [scheme, token] = authorizationHeader.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}
