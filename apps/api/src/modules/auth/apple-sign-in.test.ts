// POST /auth/apple : identité vérifiée par une implémentation injectée (JWKS réel testé dans
// `apple/identity-verifier.test.ts`), échange du code best effort, refresh token chiffré au repos.
import { randomBytes } from "node:crypto";
import { SignInResponseSchema } from "@app/contracts";
import { schema } from "@app/db";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../../errors";
import { decryptSecret } from "../../lib/secret-box";
import { resetRateLimits } from "../../middleware/rate-limit";
import { createTestApp, type TestApp } from "../../test-support";
import type { AppleIdentityVerifier } from "./apple/identity-verifier";
import type { AppleTokenClient } from "./apple/token-client";

function fakeVerifier(sub: string): AppleIdentityVerifier {
  return { verify: vi.fn().mockResolvedValue({ sub }) };
}

function fakeTokenClient(refreshToken: string | null): AppleTokenClient {
  return {
    exchangeCode: vi.fn().mockResolvedValue(refreshToken),
    revoke: vi.fn().mockResolvedValue(undefined),
  };
}

async function signInApple(testApp: TestApp) {
  const res = await testApp.app.request("/auth/apple", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      identityToken: "jwt-simulé",
      authorizationCode: "code-simulé",
      nonce: randomBytes(16).toString("hex"),
    }),
  });
  return res;
}

describe("POST /auth/apple (ADR 001)", () => {
  let testApp: TestApp;

  beforeEach(() => resetRateLimits());
  afterEach(async () => {
    await testApp?.close();
  });

  it("crée l'utilisateur à partir du sub Apple, needsUsername = true", async () => {
    testApp = await createTestApp({
      appleIdentityVerifier: fakeVerifier("apple-sub-1"),
      appleTokenClient: fakeTokenClient(null),
    });
    const res = await signInApple(testApp);
    expect(res.status).toBe(200);
    const body = SignInResponseSchema.parse(await res.json());
    expect(body.needsUsername).toBe(true);
  });

  it("une identité déjà connue retrouve le même utilisateur", async () => {
    testApp = await createTestApp({
      appleIdentityVerifier: fakeVerifier("apple-sub-1"),
      appleTokenClient: fakeTokenClient(null),
    });
    const first = SignInResponseSchema.parse(await (await signInApple(testApp)).json());
    const second = SignInResponseSchema.parse(await (await signInApple(testApp)).json());
    expect(second.userId).toBe(first.userId);
  });

  it("chiffre et stocke le refresh token reçu (AES-256-GCM)", async () => {
    const encKey = randomBytes(32).toString("base64");
    testApp = await createTestApp({
      env: { appleTokenEncKey: encKey },
      appleIdentityVerifier: fakeVerifier("apple-sub-1"),
      appleTokenClient: fakeTokenClient("refresh-token-secret"),
    });
    const body = SignInResponseSchema.parse(await (await signInApple(testApp)).json());
    const [row] = await testApp.db
      .select({ enc: schema.users.appleRefreshTokenEnc })
      .from(schema.users)
      .where(eq(schema.users.id, body.userId));
    expect(row?.enc).toBeTruthy();
    expect(decryptSecret(row!.enc!, encKey)).toBe("refresh-token-secret");
  });

  it("identité invalide (jeton Apple rejeté) ⇒ 401 APPLE_TOKEN_INVALID", async () => {
    testApp = await createTestApp({
      appleIdentityVerifier: {
        verify: vi.fn().mockRejectedValue(new AppError("APPLE_TOKEN_INVALID", "Nonce invalide")),
      },
      appleTokenClient: fakeTokenClient(null),
    });
    const res = await signInApple(testApp);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("APPLE_TOKEN_INVALID");
  });
});
