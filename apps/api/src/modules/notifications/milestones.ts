// Détection des seuils de pas franchis à la synchro (F11, ADR 004) : seuils déjà connus dans
// `milestone_events` sont ignorés (idempotent), seul le plus haut seuil nouvellement franchi
// déclenche une notification. Appelé uniquement pour le jour courant local (jamais en rattrapage
// historique) par `activity/service.ts`.
import { STEP_MILESTONES } from "@app/contracts";
import type { Db } from "@app/db";
import { schema } from "@app/db";
import { eq } from "drizzle-orm";
import { isUniqueViolation } from "../../lib/db-errors";
import { notify } from "./service";
import type { PushTransport } from "./transport";

export async function detectAndNotifyMilestone(
  db: Db,
  transport: PushTransport,
  userId: string,
  date: string,
  prevSteps: number,
  newSteps: number,
  now: Date,
): Promise<void> {
  const crossed = STEP_MILESTONES.filter((m) => prevSteps < m && m <= newSteps);
  if (crossed.length === 0) return;
  const highest = crossed[crossed.length - 1]!;

  try {
    await db.insert(schema.milestoneEvents).values({ userId, date, threshold: highest });
  } catch (err) {
    if (isUniqueViolation(err)) return; // déjà notifié pour ce jour + seuil (resynchro).
    throw err;
  }

  await notify(db, transport, userId, "milestone_self", { type: "milestone_self", date, milestone: highest }, undefined, now);

  const [settings] = await db
    .select({ shareMilestones: schema.userSettings.shareMilestones })
    .from(schema.userSettings)
    .where(eq(schema.userSettings.userId, userId));
  if (!settings?.shareMilestones) return;

  const [author] = await db.select({ username: schema.users.username }).from(schema.users).where(eq(schema.users.id, userId));
  if (!author?.username) return; // sans pseudonyme, pas d'amis à qui propager.

  const friendRows = await db
    .select({ friendId: schema.friendships.friendId })
    .from(schema.friendships)
    .where(eq(schema.friendships.userId, userId));
  for (const { friendId } of friendRows) {
    await notify(
      db,
      transport,
      friendId,
      "milestone_friend",
      { type: "milestone_friend", fromUserId: userId, fromUsername: author.username, milestone: highest },
      userId,
      now,
    );
  }
}
