// GET /leaderboards/daily, GET /leaderboards/weekly (CA5, CA6), GET /me/today (F3). Routes
// sociales : pseudonyme requis (403 USERNAME_REQUIRED) — un classement sans pseudonyme n'a pas
// de sens (aucun ami possible, cf. `requireUsername`).
import { LeaderboardResponseSchema, TodayResponseSchema } from "@app/contracts";
import type { AppDeps, AppHono } from "../../context";
import { AppError } from "../../errors";
import { requireUsername } from "../../middleware/require-username";
import { computeLeaderboard, computeToday } from "./service";

export function registerLeaderboardRoutes(app: AppHono, deps: AppDeps): void {
  app.get("/leaderboards/daily", requireUsername, async (c) => {
    const auth = c.get("auth");
    if (!auth) throw new AppError("UNAUTHENTICATED", "Authentification requise");
    const result = await computeLeaderboard(deps.db, auth.userId, "daily", deps.now());
    return c.json(LeaderboardResponseSchema.parse(result), 200);
  });

  app.get("/leaderboards/weekly", requireUsername, async (c) => {
    const auth = c.get("auth");
    if (!auth) throw new AppError("UNAUTHENTICATED", "Authentification requise");
    const result = await computeLeaderboard(deps.db, auth.userId, "weekly", deps.now());
    return c.json(LeaderboardResponseSchema.parse(result), 200);
  });

  app.get("/me/today", requireUsername, async (c) => {
    const auth = c.get("auth");
    if (!auth) throw new AppError("UNAUTHENTICATED", "Authentification requise");
    const result = await computeToday(deps.db, auth.userId, deps.now());
    return c.json(TodayResponseSchema.parse(result), 200);
  });
}
