// POST /auth/dev (hors production), POST /auth/logout (ADR 001, ADR 007).
// Sign in with Apple : B4.
import {
  DevSignInRequestSchema,
  RATE_LIMIT_AUTH_PER_MINUTE_PER_IP,
  type SignInResponse,
  SignInResponseSchema,
} from "@app/contracts";
import type { AppDeps, AppHono } from "../../context";
import { AppError } from "../../errors";
import { getClientIp } from "../../lib/client-ip";
import { parseJsonBody } from "../../lib/validate";
import { rateLimit } from "../../middleware/rate-limit";
import { createSession, deleteSession } from "./session";
import { findOrCreateUserByAppleSub } from "./users";

const ONE_MINUTE_MS = 60_000;

export function registerAuthRoutes(app: AppHono, deps: AppDeps): void {
  app.use(
    "/auth/*",
    rateLimit({
      max: RATE_LIMIT_AUTH_PER_MINUTE_PER_IP,
      windowMs: ONE_MINUTE_MS,
      keyFn: (c) => `auth-ip:${getClientIp(c, deps.env.trustProxy)}`,
    }),
  );

  // Absente en production (404) : `loadEnv` garantit déjà `enableDevLogin === false` en prod.
  if (deps.env.enableDevLogin) {
    app.post("/auth/dev", async (c) => {
      const body = await parseJsonBody(c, DevSignInRequestSchema);
      const now = deps.now();
      const user = await findOrCreateUserByAppleSub(deps.db, `dev:${body.devUserKey}`);
      const session = await createSession(deps.db, user.id, now);
      const response: SignInResponse = {
        session: { token: session.token, expiresAt: session.expiresAt.toISOString() },
        userId: user.id,
        username: user.username,
        needsUsername: user.needsUsername,
      };
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
