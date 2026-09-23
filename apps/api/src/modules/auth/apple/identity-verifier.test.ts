// Vérifie iss/aud/exp (via `jwtVerify`) et le nonce, avec une paire de clés locale (ADR 001).
import { createHash, randomBytes } from "node:crypto";
import {
  type CryptoKey,
  SignJWT,
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
} from "jose";
import { beforeAll, describe, expect, it } from "vitest";
import { AppError } from "../../../errors";
import { APPLE_ISSUER, createAppleIdentityVerifier } from "./identity-verifier";

const BUNDLE_ID = "com.footer.app";
const KEY_ID = "test-key";

describe("createAppleIdentityVerifier (clé locale)", () => {
  let privateKey: CryptoKey;
  let getKey: ReturnType<typeof createLocalJWKSet>;

  beforeAll(async () => {
    const { publicKey, privateKey: signingKey } = await generateKeyPair("ES256", { extractable: true });
    privateKey = signingKey;
    const jwk = await exportJWK(publicKey);
    getKey = createLocalJWKSet({ keys: [{ ...jwk, kid: KEY_ID, alg: "ES256", use: "sig" }] });
  });

  function rawNonce(): string {
    return randomBytes(16).toString("hex");
  }
  function hashedNonce(raw: string): string {
    return createHash("sha256").update(raw).digest("hex");
  }

  async function signToken(claims: {
    sub?: string;
    aud?: string;
    issuer?: string;
    nonce?: string;
    expSeconds?: number;
  }): Promise<string> {
    return new SignJWT({ nonce: claims.nonce })
      .setProtectedHeader({ alg: "ES256", kid: KEY_ID })
      .setIssuer(claims.issuer ?? APPLE_ISSUER)
      .setAudience(claims.aud ?? BUNDLE_ID)
      .setSubject(claims.sub ?? "apple-user-sub")
      .setIssuedAt()
      .setExpirationTime(claims.expSeconds ?? Math.floor(Date.now() / 1000) + 600)
      .sign(privateKey);
  }

  it("jeton valide avec le bon nonce ⇒ renvoie le sub Apple", async () => {
    const verifier = createAppleIdentityVerifier({ bundleId: BUNDLE_ID, getKey });
    const nonce = rawNonce();
    const token = await signToken({ sub: "apple-user-1", nonce: hashedNonce(nonce) });
    await expect(verifier.verify(token, nonce)).resolves.toEqual({ sub: "apple-user-1" });
  });

  it("mauvaise audience ⇒ 401 APPLE_TOKEN_INVALID", async () => {
    const verifier = createAppleIdentityVerifier({ bundleId: BUNDLE_ID, getKey });
    const nonce = rawNonce();
    const token = await signToken({ aud: "com.autre.app", nonce: hashedNonce(nonce) });
    await expect(verifier.verify(token, nonce)).rejects.toBeInstanceOf(AppError);
  });

  it("jeton expiré ⇒ 401 APPLE_TOKEN_INVALID", async () => {
    const verifier = createAppleIdentityVerifier({ bundleId: BUNDLE_ID, getKey });
    const nonce = rawNonce();
    const token = await signToken({
      nonce: hashedNonce(nonce),
      expSeconds: Math.floor(Date.now() / 1000) - 60,
    });
    await expect(verifier.verify(token, nonce)).rejects.toBeInstanceOf(AppError);
  });

  it("mauvais nonce ⇒ 401 APPLE_TOKEN_INVALID", async () => {
    const verifier = createAppleIdentityVerifier({ bundleId: BUNDLE_ID, getKey });
    const nonce = rawNonce();
    const token = await signToken({ nonce: hashedNonce("un-autre-nonce-brut") });
    const rejection = verifier.verify(token, nonce);
    await expect(rejection).rejects.toBeInstanceOf(AppError);
    await expect(rejection).rejects.toMatchObject({ code: "APPLE_TOKEN_INVALID" });
  });

  it("mauvais émetteur ⇒ 401 APPLE_TOKEN_INVALID", async () => {
    const verifier = createAppleIdentityVerifier({ bundleId: BUNDLE_ID, getKey });
    const nonce = rawNonce();
    const token = await signToken({ issuer: "https://malicious.example", nonce: hashedNonce(nonce) });
    await expect(verifier.verify(token, nonce)).rejects.toBeInstanceOf(AppError);
  });
});
