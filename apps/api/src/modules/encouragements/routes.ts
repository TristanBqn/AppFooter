// POST /encouragements, GET /encouragements/received (F10, CA9). Route sociale : pseudonyme requis.
import { ReceivedEncouragementsResponseSchema, SendEncouragementRequestSchema, SendEncouragementResponseSchema } from "@app/contracts";
import type { AppDeps, AppHono } from "../../context";
import { AppError } from "../../errors";
import { parseJsonBody } from "../../lib/validate";
import { requireUsername } from "../../middleware/require-username";
import { listReceivedEncouragements, sendEncouragement } from "./service";

export function registerEncouragementRoutes(app: AppHono, deps: AppDeps): void {
  app.post("/encouragements", requireUsername, async (c) => {
    const auth = c.get("auth");
    if (!auth || !auth.username) throw new AppError("UNAUTHENTICATED", "Authentification requise");
    const body = await parseJsonBody(c, SendEncouragementRequestSchema);
    const result = await sendEncouragement(
      deps.db,
      deps.pushTransport,
      auth.userId,
      auth.username,
      body.toUserId,
      body.messageId,
      deps.now(),
    );
    return c.json(SendEncouragementResponseSchema.parse(result), 200);
  });

  app.get("/encouragements/received", requireUsername, async (c) => {
    const auth = c.get("auth");
    if (!auth) throw new AppError("UNAUTHENTICATED", "Authentification requise");
    const result = await listReceivedEncouragements(deps.db, auth.userId);
    return c.json(ReceivedEncouragementsResponseSchema.parse(result), 200);
  });
}
