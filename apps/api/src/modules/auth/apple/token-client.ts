// Échange de l'authorizationCode contre un refresh token, et révocation à la suppression du
// compte (ADR 001, 006). `client_secret` = JWT ES256 signé par la clé privée Sign in with Apple
// (`.p8`), régénéré à chaque appel (courte durée de vie, pas de mise en cache de secret).
import { type CryptoKey, SignJWT, importPKCS8 } from "jose";
import { APPLE_ISSUER } from "./identity-verifier";

const APPLE_TOKEN_URL = "https://appleid.apple.com/auth/token";
const APPLE_REVOKE_URL = "https://appleid.apple.com/auth/revoke";
const REQUEST_TIMEOUT_MS = 5_000;

export interface AppleTokenClient {
  /** best effort : `null` si Apple est indisponible ou ne renvoie pas de refresh token (ADR 001). */
  exchangeCode(authorizationCode: string): Promise<string | null>;
  /** best effort, ne lève jamais (ADR 006 : suppression de compte malgré une panne Apple). */
  revoke(refreshToken: string): Promise<void>;
}

export interface AppleTokenClientOptions {
  bundleId: string;
  teamId: string;
  keyId: string;
  /** Clé privée PKCS8 PEM (`.p8`). */
  privateKeyPem: string;
  /** Remplacés dans les tests. */
  tokenUrl?: string;
  revokeUrl?: string;
}

async function buildClientSecret(options: AppleTokenClientOptions, key: CryptoKey): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: options.keyId })
    .setIssuer(options.teamId)
    .setIssuedAt()
    .setExpirationTime("5m")
    .setAudience(APPLE_ISSUER)
    .setSubject(options.bundleId)
    .sign(key);
}

export function createAppleTokenClient(options: AppleTokenClientOptions): AppleTokenClient {
  const tokenUrl = options.tokenUrl ?? APPLE_TOKEN_URL;
  const revokeUrl = options.revokeUrl ?? APPLE_REVOKE_URL;
  const keyPromise = importPKCS8(options.privateKeyPem, "ES256");

  return {
    async exchangeCode(authorizationCode) {
      try {
        const clientSecret = await buildClientSecret(options, await keyPromise);
        const res = await fetch(tokenUrl, {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: options.bundleId,
            client_secret: clientSecret,
            code: authorizationCode,
            grant_type: "authorization_code",
          }),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        if (!res.ok) return null;
        const data = (await res.json()) as { refresh_token?: string };
        return data.refresh_token ?? null;
      } catch {
        return null;
      }
    },

    async revoke(refreshToken) {
      try {
        const clientSecret = await buildClientSecret(options, await keyPromise);
        await fetch(revokeUrl, {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: options.bundleId,
            client_secret: clientSecret,
            token: refreshToken,
            token_type_hint: "refresh_token",
          }),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
      } catch {
        // Best effort : la suppression de compte (B11) continue même si Apple est indisponible.
      }
    },
  };
}
