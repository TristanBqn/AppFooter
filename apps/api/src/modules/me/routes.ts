// GET /me, PUT /me/username (CA1, CA2), GET/PATCH /me/settings, PUT /me/consents/health (F15,
// ADR 006), DELETE /me (CA12, ADR 001/006).
import {
  HealthConsentRequestSchema,
  HealthConsentResponseSchema,
  MeSchema,
  RATE_LIMIT_USERNAME_PER_MINUTE_PER_USER,
  SettingsSchema,
  SetUsernameRequestSchema,
  UpdateSettingsRequestSchema,
} from "@app/contracts";
import type { AppDeps, AppHono } from "../../context";
import { AppError } from "../../errors";
import { parseJsonBody } from "../../lib/validate";
import { rateLimit } from "../../middleware/rate-limit";
import { setUsername } from "../auth/users";
import { setHealthConsent } from "./consent-service";
import { deleteAccount } from "./delete-service";
import { loadMe } from "./service";
import { getSettings, updateSettings } from "./settings-service";

const ONE_MINUTE_MS = 60_000;

export function registerMeRoutes(app: AppHono, deps: AppDeps): void {
  app.get("/me", async (c) => {
    const auth = c.get("auth");
    if (!auth) throw new AppError("UNAUTHENTICATED", "Authentification requise");
    const me = await loadMe(deps.db, auth.userId);
    if (!me) throw new AppError("UNAUTHENTICATED", "Utilisateur introuvable");
    return c.json(MeSchema.parse(me), 200);
  });

  app.put(
    "/me/username",
    rateLimit({
      max: RATE_LIMIT_USERNAME_PER_MINUTE_PER_USER,
      windowMs: ONE_MINUTE_MS,
      keyFn: (c) => {
        const auth = c.get("auth");
        return auth ? `username:${auth.userId}` : null;
      },
    }),
    async (c) => {
      const auth = c.get("auth");
      if (!auth) throw new AppError("UNAUTHENTICATED", "Authentification requise");
      const body = await parseJsonBody(c, SetUsernameRequestSchema);
      await setUsername(deps.db, auth.userId, body.username);
      const me = await loadMe(deps.db, auth.userId);
      if (!me) throw new AppError("UNAUTHENTICATED", "Utilisateur introuvable");
      return c.json(MeSchema.parse(me), 200);
    },
  );

  app.get("/me/settings", async (c) => {
    const auth = c.get("auth");
    if (!auth) throw new AppError("UNAUTHENTICATED", "Authentification requise");
    const settings = await getSettings(deps.db, auth.userId);
    if (!settings) throw new AppError("UNAUTHENTICATED", "Utilisateur introuvable");
    return c.json(SettingsSchema.parse(settings), 200);
  });

  app.patch("/me/settings", async (c) => {
    const auth = c.get("auth");
    if (!auth) throw new AppError("UNAUTHENTICATED", "Authentification requise");
    const body = await parseJsonBody(c, UpdateSettingsRequestSchema);
    const settings = await updateSettings(deps.db, auth.userId, body);
    if (!settings) throw new AppError("UNAUTHENTICATED", "Utilisateur introuvable");
    return c.json(SettingsSchema.parse(settings), 200);
  });

  app.put("/me/consents/health", async (c) => {
    const auth = c.get("auth");
    if (!auth) throw new AppError("UNAUTHENTICATED", "Authentification requise");
    const body = await parseJsonBody(c, HealthConsentRequestSchema);
    const healthConsentAt = await setHealthConsent(deps.db, auth.userId, body.granted, deps.now());
    return c.json(
      HealthConsentResponseSchema.parse({ healthConsentAt: healthConsentAt?.toISOString() ?? null }),
      200,
    );
  });

  app.delete("/me", async (c) => {
    const auth = c.get("auth");
    if (!auth) throw new AppError("UNAUTHENTICATED", "Authentification requise");
    await deleteAccount(deps.db, deps.appleTokenClient, deps.env.appleTokenEncKey, auth.userId);
    return c.body(null, 204);
  });
}
