// GET /me, PUT /me/username (CA1, CA2). Le reste de `/me/*` arrive en B5 (paramètres, consentement,
// synchro) et B11 (suppression du compte).
import {
  MeSchema,
  RATE_LIMIT_USERNAME_PER_MINUTE_PER_USER,
  SetUsernameRequestSchema,
} from "@app/contracts";
import type { AppDeps, AppHono } from "../../context";
import { AppError } from "../../errors";
import { parseJsonBody } from "../../lib/validate";
import { rateLimit } from "../../middleware/rate-limit";
import { setUsername } from "../auth/users";
import { loadMe } from "./service";

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
}
