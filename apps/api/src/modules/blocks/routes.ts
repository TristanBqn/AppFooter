// GET/POST /blocks, DELETE /blocks/:userId (CA11).
import { BlockUserRequestSchema, BlocksResponseSchema, UserIdParamSchema } from "@app/contracts";
import type { AppDeps, AppHono } from "../../context";
import { AppError } from "../../errors";
import { parseJsonBody, parseParam } from "../../lib/validate";
import { requireUsername } from "../../middleware/require-username";
import { blockUser, listBlocks, unblockUser } from "./service";

export function registerBlockRoutes(app: AppHono, deps: AppDeps): void {
  app.get("/blocks", requireUsername, async (c) => {
    const auth = c.get("auth");
    if (!auth) throw new AppError("UNAUTHENTICATED", "Authentification requise");
    const result = await listBlocks(deps.db, auth.userId);
    return c.json(BlocksResponseSchema.parse(result), 200);
  });

  app.post("/blocks", requireUsername, async (c) => {
    const auth = c.get("auth");
    if (!auth) throw new AppError("UNAUTHENTICATED", "Authentification requise");
    const body = await parseJsonBody(c, BlockUserRequestSchema);
    await blockUser(deps.db, auth.userId, body.userId);
    return c.body(null, 204);
  });

  app.delete("/blocks/:userId", requireUsername, async (c) => {
    const auth = c.get("auth");
    if (!auth) throw new AppError("UNAUTHENTICATED", "Authentification requise");
    const { userId } = parseParam(c, UserIdParamSchema);
    await unblockUser(deps.db, auth.userId, userId);
    return c.body(null, 204);
  });
}
