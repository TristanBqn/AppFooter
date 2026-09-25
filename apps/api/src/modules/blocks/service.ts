// POST/GET /blocks, DELETE /blocks/:userId (CA11, ADR 005) : bloquer supprime l'amitié et les
// demandes en cours dans les deux sens (transaction), empêche toute nouvelle interaction —
// toute future demande du bloqué est cachée (cf. `friends/service.ts`, `isBlocking`).
import type { BlocksResponse } from "@app/contracts";
import type { Db } from "@app/db";
import { schema } from "@app/db";
import { and, desc, eq, or } from "drizzle-orm";
import { AppError } from "../../errors";

async function userExists(db: Db, userId: string): Promise<boolean> {
  const [row] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.id, userId));
  return !!row;
}

async function isBlocked(db: Db, blockerId: string, blockedId: string): Promise<boolean> {
  const [row] = await db
    .select({ blockerId: schema.blocks.blockerId })
    .from(schema.blocks)
    .where(and(eq(schema.blocks.blockerId, blockerId), eq(schema.blocks.blockedId, blockedId)));
  return !!row;
}

export async function listBlocks(db: Db, userId: string): Promise<BlocksResponse> {
  const rows = await db
    .select({ blockedId: schema.blocks.blockedId, blockedAt: schema.blocks.createdAt, username: schema.users.username })
    .from(schema.blocks)
    .innerJoin(schema.users, eq(schema.users.id, schema.blocks.blockedId))
    .where(eq(schema.blocks.blockerId, userId))
    .orderBy(desc(schema.blocks.createdAt));

  return {
    blocked: rows
      .filter((r): r is typeof r & { username: string } => r.username !== null)
      .map((r) => ({ userId: r.blockedId, username: r.username, blockedAt: r.blockedAt.toISOString() })),
  };
}

/** Idempotent (rappeler un blocage déjà en place ne fait rien). */
export async function blockUser(db: Db, blockerId: string, blockedId: string): Promise<void> {
  if (blockerId === blockedId) throw new AppError("CANNOT_TARGET_SELF", "Impossible de se bloquer soi-même");
  if (await isBlocked(db, blockerId, blockedId)) return;
  if (!(await userExists(db, blockedId))) throw new AppError("NOT_FOUND", "Utilisateur introuvable");

  await db.transaction(async (tx) => {
    await tx.insert(schema.blocks).values({ blockerId, blockedId });
    await tx.delete(schema.friendships).where(and(eq(schema.friendships.userId, blockerId), eq(schema.friendships.friendId, blockedId)));
    await tx.delete(schema.friendships).where(and(eq(schema.friendships.userId, blockedId), eq(schema.friendships.friendId, blockerId)));
    await tx
      .delete(schema.friendRequests)
      .where(
        or(
          and(eq(schema.friendRequests.senderId, blockerId), eq(schema.friendRequests.recipientId, blockedId)),
          and(eq(schema.friendRequests.senderId, blockedId), eq(schema.friendRequests.recipientId, blockerId)),
        ),
      );
    await tx
      .delete(schema.pendingNotifications)
      .where(
        or(
          and(eq(schema.pendingNotifications.recipientId, blockerId), eq(schema.pendingNotifications.actorId, blockedId)),
          and(eq(schema.pendingNotifications.recipientId, blockedId), eq(schema.pendingNotifications.actorId, blockerId)),
        ),
      );
  });
}

export async function unblockUser(db: Db, blockerId: string, blockedId: string): Promise<void> {
  if (!(await isBlocked(db, blockerId, blockedId))) throw new AppError("NOT_FOUND", "Ce blocage n'existe pas");
  await db.delete(schema.blocks).where(and(eq(schema.blocks.blockerId, blockerId), eq(schema.blocks.blockedId, blockedId)));
}
