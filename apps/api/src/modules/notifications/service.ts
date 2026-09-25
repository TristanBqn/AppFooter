// Point d'entrée unique des notifications (ADR 004) : préférence du destinataire + absence de
// blocage, puis heures silencieuses (retient dans `pending_notifications` si dans la plage,
// envoi immédiat sinon). `flushDueNotifications` vide la file (setInterval côté `server.ts`).
import type { NotificationType, PushPayload } from "@app/contracts";
import { PENDING_NOTIFICATION_TTL_HOURS } from "@app/contracts";
import type { Db } from "@app/db";
import { schema } from "@app/db";
import { and, eq, lte, or } from "drizzle-orm";
import { endOfQuietWindow, isQuietTime } from "../../domain/quiet-hours";
import { minutesToLocalTime } from "../../lib/time";
import type { PushTransport } from "./transport";

const ONE_HOUR_MS = 60 * 60_000;

type PreferenceColumn = "notifyMilestones" | "notifyFriendMilestones" | "notifyEncouragements" | "notifyFriendRequests";

/** `friend_request_accepted` n'a pas de préférence dédiée : rattachée à `notifyFriendRequests`. */
const PREFERENCE_BY_TYPE: Record<NotificationType, PreferenceColumn> = {
  milestone_self: "notifyMilestones",
  milestone_friend: "notifyFriendMilestones",
  encouragement_received: "notifyEncouragements",
  friend_request_received: "notifyFriendRequests",
  friend_request_accepted: "notifyFriendRequests",
};

async function isBlockedEitherWay(db: Db, a: string, b: string): Promise<boolean> {
  const [row] = await db
    .select({ blockerId: schema.blocks.blockerId })
    .from(schema.blocks)
    .where(
      or(
        and(eq(schema.blocks.blockerId, a), eq(schema.blocks.blockedId, b)),
        and(eq(schema.blocks.blockerId, b), eq(schema.blocks.blockedId, a)),
      ),
    );
  return !!row;
}

async function sendNow(db: Db, transport: PushTransport, recipientId: string, type: NotificationType, payload: PushPayload): Promise<void> {
  const devices = await db
    .select({ apnsToken: schema.pushDevices.apnsToken, environment: schema.pushDevices.environment })
    .from(schema.pushDevices)
    .where(eq(schema.pushDevices.userId, recipientId));
  for (const device of devices) {
    await transport.send(device, { recipientId, type, payload });
  }
}

export async function notify(
  db: Db,
  transport: PushTransport,
  recipientId: string,
  type: NotificationType,
  payload: PushPayload,
  actorId: string | undefined,
  now: Date,
): Promise<void> {
  const preferenceColumn = PREFERENCE_BY_TYPE[type];
  const [recipient] = await db
    .select({
      timeZone: schema.users.timeZone,
      quietEnabled: schema.userSettings.quietEnabled,
      quietStartMin: schema.userSettings.quietStartMin,
      quietEndMin: schema.userSettings.quietEndMin,
      allowed: schema.userSettings[preferenceColumn],
    })
    .from(schema.users)
    .innerJoin(schema.userSettings, eq(schema.userSettings.userId, schema.users.id))
    .where(eq(schema.users.id, recipientId));
  if (!recipient || !recipient.allowed) return;
  if (actorId && (await isBlockedEitherWay(db, actorId, recipientId))) return;

  const quietHours = {
    enabled: recipient.quietEnabled,
    start: minutesToLocalTime(recipient.quietStartMin),
    end: minutesToLocalTime(recipient.quietEndMin),
  };

  // V1 : aucun type urgent (`URGENT_NOTIFICATION_TYPES` vide), toujours retenu si silencieux.
  if (isQuietTime(now, recipient.timeZone, quietHours)) {
    await db.insert(schema.pendingNotifications).values({
      recipientId,
      actorId: actorId ?? null,
      type,
      payload,
      deliverAfter: endOfQuietWindow(now, recipient.timeZone, quietHours),
      expiresAt: new Date(now.getTime() + PENDING_NOTIFICATION_TTL_HOURS * ONE_HOUR_MS),
    });
    return;
  }

  await sendNow(db, transport, recipientId, type, payload);
}

/**
 * Envoie les notifications retenues dont `deliver_after` est passé, supprime les expirées, et ne
 * garde qu'une notification par (destinataire, type, acteur) — la plus récente. L'envoi (I/O
 * réseau) se fait après la transaction, pas de verrou tenu pendant l'appel au transport.
 */
export async function flushDueNotifications(db: Db, transport: PushTransport, now: Date): Promise<void> {
  const toSend = await db.transaction(async (tx) => {
    await tx.delete(schema.pendingNotifications).where(lte(schema.pendingNotifications.expiresAt, now));

    const due = await tx
      .select()
      .from(schema.pendingNotifications)
      .where(lte(schema.pendingNotifications.deliverAfter, now))
      .for("update", { skipLocked: true });

    const dedup = new Map<string, (typeof due)[number]>();
    for (const row of due) {
      const key = `${row.recipientId}:${row.type}:${row.actorId ?? ""}`;
      const existing = dedup.get(key);
      if (!existing || row.deliverAfter > existing.deliverAfter) dedup.set(key, row);
    }

    for (const row of due) {
      await tx.delete(schema.pendingNotifications).where(eq(schema.pendingNotifications.id, row.id));
    }

    return [...dedup.values()];
  });

  for (const row of toSend) {
    await sendNow(db, transport, row.recipientId, row.type as NotificationType, row.payload as PushPayload);
  }
}
