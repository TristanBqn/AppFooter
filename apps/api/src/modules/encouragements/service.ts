// POST /encouragements, GET /encouragements/received (F10, CA9). Catalogue fermé (aucun texte
// libre, objet strict côté contrat) ; quota exact en base : un envoi par ami et par jour civil
// local de l'expéditeur (index unique `(sender_id, recipient_id, sender_local_date)`, ADR 007).
import type { EncouragementMessageId, ReceivedEncouragementsResponse, SendEncouragementResponse } from "@app/contracts";
import { RECEIVED_ENCOURAGEMENTS_LIMIT } from "@app/contracts";
import type { Db } from "@app/db";
import { schema } from "@app/db";
import { and, desc, eq, inArray } from "drizzle-orm";
import { localDate } from "../../domain/local-date";
import { AppError } from "../../errors";
import { isUniqueViolation } from "../../lib/db-errors";
import { notify } from "../notifications/service";
import type { PushTransport } from "../notifications/transport";

async function areFriends(db: Db, userId: string, friendId: string): Promise<boolean> {
  const [row] = await db
    .select({ userId: schema.friendships.userId })
    .from(schema.friendships)
    .where(and(eq(schema.friendships.userId, userId), eq(schema.friendships.friendId, friendId)));
  return !!row;
}

/** 404 si non ami — jamais 403 (même principe que CA8/ADR 005) ; 429 si déjà envoyé aujourd'hui. */
export async function sendEncouragement(
  db: Db,
  transport: PushTransport,
  senderId: string,
  senderUsername: string,
  toUserId: string,
  messageId: EncouragementMessageId,
  now: Date,
): Promise<SendEncouragementResponse> {
  if (!(await areFriends(db, senderId, toUserId))) {
    throw new AppError("NOT_FOUND", "Ami introuvable");
  }

  const [sender] = await db.select({ timeZone: schema.users.timeZone }).from(schema.users).where(eq(schema.users.id, senderId));
  if (!sender) throw new AppError("UNAUTHENTICATED", "Utilisateur introuvable");
  const senderLocalDate = localDate(now, sender.timeZone);

  let id: string;
  try {
    const [row] = await db
      .insert(schema.encouragements)
      .values({ senderId, recipientId: toUserId, messageId, senderLocalDate, createdAt: now })
      .returning({ id: schema.encouragements.id });
    if (!row) throw new Error("Échec de l'enregistrement de l'encouragement");
    id = row.id;
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new AppError("ENCOURAGEMENT_LIMIT", "Un seul encouragement par ami et par jour");
    }
    throw err;
  }

  await notify(
    db,
    transport,
    toUserId,
    "encouragement_received",
    { type: "encouragement_received", fromUserId: senderId, fromUsername: senderUsername, messageId },
    senderId,
    now,
  );

  return { id, sentAt: now.toISOString() };
}

/** RECEIVED_ENCOURAGEMENTS_LIMIT plus récents, amis actuels uniquement (un ex-ami/bloqué disparaît). */
export async function listReceivedEncouragements(db: Db, userId: string): Promise<ReceivedEncouragementsResponse> {
  const friendRows = await db.select({ friendId: schema.friendships.friendId }).from(schema.friendships).where(eq(schema.friendships.userId, userId));
  const friendIds = friendRows.map((f) => f.friendId);
  if (friendIds.length === 0) return { encouragements: [] };

  const rows = await db
    .select({
      id: schema.encouragements.id,
      senderId: schema.encouragements.senderId,
      messageId: schema.encouragements.messageId,
      createdAt: schema.encouragements.createdAt,
    })
    .from(schema.encouragements)
    .where(and(eq(schema.encouragements.recipientId, userId), inArray(schema.encouragements.senderId, friendIds)))
    .orderBy(desc(schema.encouragements.createdAt))
    .limit(RECEIVED_ENCOURAGEMENTS_LIMIT);

  const senders = await db.select({ id: schema.users.id, username: schema.users.username }).from(schema.users).where(inArray(schema.users.id, friendIds));
  const sendersById = new Map(senders.map((s) => [s.id, s] as const));

  return {
    encouragements: rows
      .filter((r) => sendersById.get(r.senderId)?.username)
      .map((r) => ({
        id: r.id,
        from: { userId: r.senderId, username: sendersById.get(r.senderId)!.username! },
        messageId: r.messageId as EncouragementMessageId,
        sentAt: r.createdAt.toISOString(),
      })),
  };
}
