// Vérification du jeton d'identité Apple (ADR 001) : JWKS Apple via `jose`, `iss`/`aud`/`exp`
// contrôlés par `jwtVerify`, nonce comparé manuellement (SHA-256 hex du nonce brut envoyé à Apple).
import { createHash } from "node:crypto";
import { type JWTVerifyGetKey, createRemoteJWKSet, jwtVerify } from "jose";
import { AppError } from "../../../errors";

export const APPLE_ISSUER = "https://appleid.apple.com";
export const APPLE_JWKS_URL = "https://appleid.apple.com/auth/keys";

export interface AppleIdentity {
  /** Identifiant stable de l'utilisateur Apple : seule donnée d'identité conservée (ADR 001, 006). */
  sub: string;
}

export interface AppleIdentityVerifier {
  verify(identityToken: string, rawNonce: string): Promise<AppleIdentity>;
}

export interface AppleIdentityVerifierOptions {
  bundleId: string;
  /** Remplacé dans les tests par un JWKS local (`jose.createLocalJWKSet`). */
  getKey?: JWTVerifyGetKey;
  /** Remplacé dans les tests. Par défaut `https://appleid.apple.com`. */
  issuer?: string;
}

export function createAppleIdentityVerifier(options: AppleIdentityVerifierOptions): AppleIdentityVerifier {
  const getKey = options.getKey ?? createRemoteJWKSet(new URL(APPLE_JWKS_URL));
  const issuer = options.issuer ?? APPLE_ISSUER;

  return {
    async verify(identityToken, rawNonce) {
      const { payload } = await jwtVerify(identityToken, getKey, {
        issuer,
        audience: options.bundleId,
      }).catch(() => {
        throw new AppError("APPLE_TOKEN_INVALID", "Jeton d'identité Apple invalide");
      });

      const expectedNonce = createHash("sha256").update(rawNonce).digest("hex");
      if (typeof payload.nonce !== "string" || payload.nonce !== expectedNonce) {
        throw new AppError("APPLE_TOKEN_INVALID", "Nonce invalide");
      }
      if (typeof payload.sub !== "string" || payload.sub.length === 0) {
        throw new AppError("APPLE_TOKEN_INVALID", "Jeton d'identité Apple invalide");
      }
      return { sub: payload.sub };
    },
  };
}
