// GET/POST /friend-requests, accept/decline/cancel, GET /friends, DELETE /friends/:userId,
// GET /friends/:userId/activity (CA7, CA8, ADR 005). Routes sociales : pseudonyme requis.
import {
  AcceptFriendRequestResponseSchema,
  CreateFriendRequestResponseSchema,
  CreateFriendRequestSchema,
  FRIEND_REQUESTS_PER_DAY,
  FriendActivityResponseSchema,
  FriendRequestsResponseSchema,
  FriendsResponseSchema,
  IdParamSchema,
  UserIdParamSchema,
} from "@app/contracts";
import type { AppDeps, AppHono } from "../../context";
import { AppError } from "../../errors";
import { parseJsonBody, parseParam } from "../../lib/validate";
import { rateLimit } from "../../middleware/rate-limit";
import { requireUsername } from "../../middleware/require-username";
import {
  acceptFriendRequest,
  cancelFriendRequest,
  createFriendRequest,
  declineFriendRequest,
  getFriendActivity,
  listFriendRequests,
  listFriends,
  removeFriend,
} from "./service";

const ONE_DAY_MS = 24 * 60 * 60_000;

export function registerFriendRoutes(app: AppHono, deps: AppDeps): void {
  app.get("/friends", requireUsername, async (c) => {
    const auth = c.get("auth");
    if (!auth) throw new AppError("UNAUTHENTICATED", "Authentification requise");
    const result = await listFriends(deps.db, auth.userId, deps.now());
    return c.json(FriendsResponseSchema.parse(result), 200);
  });

  app.delete("/friends/:userId", requireUsername, async (c) => {
    const auth = c.get("auth");
    if (!auth) throw new AppError("UNAUTHENTICATED", "Authentification requise");
    const { userId } = parseParam(c, UserIdParamSchema);
    await removeFriend(deps.db, auth.userId, userId);
    return c.body(null, 204);
  });

  app.get("/friends/:userId/activity", requireUsername, async (c) => {
    const auth = c.get("auth");
    if (!auth) throw new AppError("UNAUTHENTICATED", "Authentification requise");
    const { userId } = parseParam(c, UserIdParamSchema);
    const result = await getFriendActivity(deps.db, auth.userId, userId, deps.now());
    return c.json(FriendActivityResponseSchema.parse(result), 200);
  });

  app.get("/friend-requests", requireUsername, async (c) => {
    const auth = c.get("auth");
    if (!auth) throw new AppError("UNAUTHENTICATED", "Authentification requise");
    const result = await listFriendRequests(deps.db, auth.userId);
    return c.json(FriendRequestsResponseSchema.parse(result), 200);
  });

  app.post(
    "/friend-requests",
    requireUsername,
    rateLimit({
      max: FRIEND_REQUESTS_PER_DAY,
      windowMs: ONE_DAY_MS,
      keyFn: (c) => {
        const auth = c.get("auth");
        return auth ? `friend-request:${auth.userId}` : null;
      },
    }),
    async (c) => {
      const auth = c.get("auth");
      if (!auth) throw new AppError("UNAUTHENTICATED", "Authentification requise");
      const body = await parseJsonBody(c, CreateFriendRequestSchema);
      const result = await createFriendRequest(deps.db, auth.userId, body.username, deps.now());
      return c.json(CreateFriendRequestResponseSchema.parse(result), 202);
    },
  );

  app.post("/friend-requests/:id/accept", requireUsername, async (c) => {
    const auth = c.get("auth");
    if (!auth) throw new AppError("UNAUTHENTICATED", "Authentification requise");
    const { id } = parseParam(c, IdParamSchema);
    const result = await acceptFriendRequest(deps.db, auth.userId, id, deps.now());
    return c.json(AcceptFriendRequestResponseSchema.parse(result), 200);
  });

  app.post("/friend-requests/:id/decline", requireUsername, async (c) => {
    const auth = c.get("auth");
    if (!auth) throw new AppError("UNAUTHENTICATED", "Authentification requise");
    const { id } = parseParam(c, IdParamSchema);
    await declineFriendRequest(deps.db, auth.userId, id);
    return c.body(null, 204);
  });

  app.delete("/friend-requests/:id", requireUsername, async (c) => {
    const auth = c.get("auth");
    if (!auth) throw new AppError("UNAUTHENTICATED", "Authentification requise");
    const { id } = parseParam(c, IdParamSchema);
    await cancelFriendRequest(deps.db, auth.userId, id);
    return c.body(null, 204);
  });
}
