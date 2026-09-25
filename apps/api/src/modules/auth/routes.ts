// POST /auth/apple (ADR 001), POST /auth/dev (hors production), POST /auth/logout (ADR 007).
import { AppleSignInRequestSchema, DevSignInRequestSchema, type SignInResponse, SignInResponseSchema } from "@app/contracts";
import { schema } from "@app/db";
import { eq } from "drizzle-orm";
import type { AppDeps, AppHono } from "../../context";
import { AppError } from "../../errors";
import { getClientIp } from "../../lib/client-ip";
import { encryptSecret } from "../../lib/secret-box";
import { parseJsonBody } from "../../lib/validate";
import { rateLimit } from "../../middleware/rate-limit";
import { createSession, deleteSession } from "./session";
import { type SignedInUser, findOrCreateUserByAppleSub } from "./users";

const ONE_MINUTE_MS = 60_000;

async function buildSignInResponse(deps: AppDeps, user: SignedInUser, now: Date): Promise<SignInResponse> {
  const session = await createSession(deps.db, user.id, now);
  return {
    session: { token: session.token, expiresAt: session.expiresAt.toISOString() },
    userId: user.id,
    username: user.username,
    needsUsername: user.needsUsername,
  };
}

export function registerAuthRoutes(app: AppHono, deps: AppDeps): void {
  app.use(
    "/auth/*",
    rateLimit({
      max: deps.authRateLimitPerMinute,
      windowMs: ONE_MINUTE_MS,
      keyFn: (c) => `auth-ip:${getClientIp(c, deps.env.trustProxy)}`,
    }),
  );

  app.post("/auth/apple", async (c) => {
    const body = await parseJsonBody(c, AppleSignInRequestSchema);
    const identity = await deps.appleIdentityVerifier.verify(body.identityToken, body.nonce);
    const now = deps.now();
    const user = await findOrCreateUserByAppleSub(deps.db, identity.sub);

    // Best effort (ADR 001) : la connexion réussit même si Apple est indisponible ou ne renvoie
    // pas de refresh token ; seule la révocation à la suppression du compte (B11) en dépend.
    const refreshToken = await deps.appleTokenClient.exchangeCode(body.authorizationCode);
    if (refreshToken && deps.env.appleTokenEncKey) {
      await deps.db
        .update(schema.users)
        .set({ appleRefreshTokenEnc: encryptSecret(refreshToken, deps.env.appleTokenEncKey) })
        .where(eq(schema.users.id, user.id));
    }

    const response = await buildSignInResponse(deps, user, now);
    return c.json(SignInResponseSchema.parse(response), 200);
  });

  // Absente en production (404) : `loadEnv` garantit déjà `enableDevLogin === false` en prod.
  if (deps.env.enableDevLogin) {
    app.post("/auth/dev", async (c) => {
      const body = await parseJsonBody(c, DevSignInRequestSchema);
      const now = deps.now();
      const user = await findOrCreateUserByAppleSub(deps.db, `dev:${body.devUserKey}`);
      const response = await buildSignInResponse(deps, user, now);
      return c.json(SignInResponseSchema.parse(response), 200);
    });
  }

  app.post("/auth/logout", async (c) => {
    const auth = c.get("auth");
    if (!auth) throw new AppError("UNAUTHENTICATED", "Authentification requise");
    await deleteSession(deps.db, auth.sessionId);
    return c.body(null, 204);
  });
}
