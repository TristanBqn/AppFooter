// Amis, demandes d'amitié, activité des amis, blocages (F7–F9, F14, CA7, CA8, CA11).
import { z } from "zod";
import { ActivityDaySchema } from "./activity";
import { PublicUserSchema, TimestampSchema, UserIdSchema, UsernameSchema } from "./common";

export const FriendSchema = PublicUserSchema.extend({
  todaySteps: z.int().min(0),
  friendsSince: TimestampSchema,
});
export type Friend = z.infer<typeof FriendSchema>;

/** GET /friends — trié par username. */
export const FriendsResponseSchema = z.object({ friends: z.array(FriendSchema) });
export type FriendsResponse = z.infer<typeof FriendsResponseSchema>;

/** POST /friend-requests — pseudonyme exact uniquement (CA7). */
export const CreateFriendRequestSchema = z.strictObject({ username: UsernameSchema });
export type CreateFriendRequest = z.infer<typeof CreateFriendRequestSchema>;

/**
 * Réponse neutre HTTP 202, identique que le pseudo soit inconnu, qu'il m'ait bloqué,
 * qu'il refuse les demandes, ou que la demande soit réellement créée (CA7).
 */
export const CreateFriendRequestResponseSchema = z.object({ status: z.literal("requested") });
export type CreateFriendRequestResponse = z.infer<typeof CreateFriendRequestResponseSchema>;

export const IncomingFriendRequestSchema = z.object({
  id: z.uuid(),
  from: PublicUserSchema,
  createdAt: TimestampSchema,
});
export const OutgoingFriendRequestSchema = z.object({
  id: z.uuid(),
  to: PublicUserSchema,
  createdAt: TimestampSchema,
});

/** GET /friend-requests */
export const FriendRequestsResponseSchema = z.object({
  incoming: z.array(IncomingFriendRequestSchema),
  outgoing: z.array(OutgoingFriendRequestSchema),
});
export type FriendRequestsResponse = z.infer<typeof FriendRequestsResponseSchema>;

/** POST /friend-requests/:id/accept — 404 si la demande ne m'est pas adressée. */
export const AcceptFriendRequestResponseSchema = z.object({ friend: FriendSchema });
export type AcceptFriendRequestResponse = z.infer<typeof AcceptFriendRequestResponseSchema>;

/** GET /friends/:userId/activity — 404 si non ami (jamais 403 : aucune fuite, CA8). */
export const FriendActivityResponseSchema = z.object({
  user: PublicUserSchema,
  /** Jour local courant de l'ami. */
  today: ActivityDaySchema,
  /** FRIEND_HISTORY_DAYS derniers jours, date décroissante, jours vides omis. */
  history: z.array(ActivityDaySchema),
});
export type FriendActivityResponse = z.infer<typeof FriendActivityResponseSchema>;

/** POST /blocks — idempotent, 204 ; supprime amitié et demandes dans les deux sens (CA11). */
export const BlockUserRequestSchema = z.strictObject({ userId: UserIdSchema });
export type BlockUserRequest = z.infer<typeof BlockUserRequestSchema>;

export const BlockedUserSchema = PublicUserSchema.extend({ blockedAt: TimestampSchema });
/** GET /blocks */
export const BlocksResponseSchema = z.object({ blocked: z.array(BlockedUserSchema) });
export type BlocksResponse = z.infer<typeof BlocksResponseSchema>;
