// PUT /me/activity, GET /me/activity (CA3, F13).
import {
  ActivityHistoryQuerySchema,
  ActivityHistoryResponseSchema,
  SyncActivityRequestSchema,
  SyncActivityResponseSchema,
} from "@app/contracts";
import type { AppDeps, AppHono } from "../../context";
import { AppError } from "../../errors";
import { parseJsonBody, parseQuery } from "../../lib/validate";
import { getActivityHistory, syncActivity } from "./service";

export function registerActivityRoutes(app: AppHono, deps: AppDeps): void {
  app.put("/me/activity", async (c) => {
    const auth = c.get("auth");
    if (!auth) throw new AppError("UNAUTHENTICATED", "Authentification requise");
    const body = await parseJsonBody(c, SyncActivityRequestSchema);
    const result = await syncActivity(deps.db, auth.userId, body, deps.now());
    return c.json(SyncActivityResponseSchema.parse(result), 200);
  });

  app.get("/me/activity", async (c) => {
    const auth = c.get("auth");
    if (!auth) throw new AppError("UNAUTHENTICATED", "Authentification requise");
    const query = parseQuery(c, ActivityHistoryQuerySchema);
    const result = await getActivityHistory(deps.db, auth.userId, query.days, deps.now());
    return c.json(ActivityHistoryResponseSchema.parse(result), 200);
  });
}
