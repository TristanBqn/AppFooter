// Envoi et réception d'encouragements prédéfinis (F10, CA9).
import { z } from "zod";
import { PublicUserSchema, TimestampSchema, UserIdSchema } from "./common";
import { EncouragementMessageIdSchema } from "./encouragements-catalog";

/**
 * POST /encouragements — objet strict : toute clé supplémentaire (texte libre) => 400.
 * 404 si non ami ; 429 ENCOURAGEMENT_LIMIT au-delà d'un envoi par ami et par jour local de l'expéditeur.
 */
export const SendEncouragementRequestSchema = z.strictObject({
  toUserId: UserIdSchema,
  messageId: EncouragementMessageIdSchema,
});
export type SendEncouragementRequest = z.infer<typeof SendEncouragementRequestSchema>;

export const SendEncouragementResponseSchema = z.object({
  id: z.uuid(),
  sentAt: TimestampSchema,
});
export type SendEncouragementResponse = z.infer<typeof SendEncouragementResponseSchema>;

export const ReceivedEncouragementSchema = z.object({
  id: z.uuid(),
  from: PublicUserSchema,
  messageId: EncouragementMessageIdSchema,
  sentAt: TimestampSchema,
});

/** GET /encouragements/received — RECEIVED_ENCOURAGEMENTS_LIMIT plus récents, amis actuels uniquement. */
export const ReceivedEncouragementsResponseSchema = z.object({
  encouragements: z.array(ReceivedEncouragementSchema),
});
export type ReceivedEncouragementsResponse = z.infer<typeof ReceivedEncouragementsResponseSchema>;
