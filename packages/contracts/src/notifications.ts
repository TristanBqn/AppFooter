// Types de notifications et charge personnalisée des push APNs (lue par le mobile pour le routage).
import { z } from "zod";
import { LocalDateSchema, UserIdSchema, UsernameSchema } from "./common";
import { EncouragementMessageIdSchema } from "./encouragements-catalog";

export const NotificationTypeSchema = z.enum([
  "milestone_self",
  "milestone_friend",
  "encouragement_received",
  "friend_request_received",
  "friend_request_accepted",
]);
export type NotificationType = z.infer<typeof NotificationTypeSchema>;

/** V1 : aucun type urgent ; tous sont retenus pendant les heures silencieuses (CA10). */
export const URGENT_NOTIFICATION_TYPES: readonly NotificationType[] = [];

const milestone = z.int().positive();
const from = { fromUserId: UserIdSchema, fromUsername: UsernameSchema };

/** Clé `footer` de la charge APNs (à côté de `aps`). Aucune donnée de santé au-delà du seuil franchi. */
export const PushPayloadSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("milestone_self"), date: LocalDateSchema, milestone }),
  z.object({ type: z.literal("milestone_friend"), ...from, milestone }),
  z.object({ type: z.literal("encouragement_received"), ...from, messageId: EncouragementMessageIdSchema }),
  z.object({ type: z.literal("friend_request_received"), ...from }),
  z.object({ type: z.literal("friend_request_accepted"), ...from }),
]);
export type PushPayload = z.infer<typeof PushPayloadSchema>;
