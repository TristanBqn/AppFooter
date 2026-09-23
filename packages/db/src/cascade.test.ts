// CA12 : supprimer un utilisateur ne laisse aucune ligne le référençant, dans aucune table.
// Test générique (docs/architecture.md, tâche B2) : la vérification parcourt le schéma pour
// trouver toute colonne qui référence `users.id` (pas de liste de tables codée en dur), afin
// qu'une future table ajoutée sans `onDelete: "cascade"` fasse échouer ce test si elle est
// peuplée dans la phase de préparation ci-dessous.
import { eq, is, sql } from "drizzle-orm";
import { type AnyPgColumn, getTableConfig, PgTable } from "drizzle-orm/pg-core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDb, type Db, type DbHandle } from "./client";
import * as schema from "./schema";

function tables(): PgTable[] {
  return Object.values(schema).filter((value) => is(value, PgTable)) as PgTable[];
}

/** Toutes les colonnes (de toutes les tables) qui référencent `users.id`. */
function columnsReferencingUsers(): Array<{ table: PgTable; column: AnyPgColumn }> {
  const found: Array<{ table: PgTable; column: AnyPgColumn }> = [];
  for (const table of tables()) {
    const { foreignKeys } = getTableConfig(table);
    for (const fk of foreignKeys) {
      const ref = fk.reference();
      if (getTableConfig(ref.foreignTable).name === "users") {
        found.push({ table, column: ref.columns[0] as AnyPgColumn });
      }
    }
  }
  return found;
}

async function countRowsFor(db: Db, table: PgTable, column: AnyPgColumn, userId: string): Promise<number> {
  const result = await db.execute<{ count: number }>(
    sql`select count(*)::int as count from ${table} where ${column} = ${userId}`,
  );
  return Number(result.rows[0]?.count ?? -1);
}

describe("suppression d'un utilisateur (CA12)", () => {
  let handle: DbHandle;

  beforeEach(async () => {
    handle = await createDb("");
    await handle.migrate();
  });
  afterEach(async () => {
    await handle.close();
  });

  it("le schéma référence bien users.id depuis toutes les tables attendues", () => {
    const referencingTableNames = new Set(columnsReferencingUsers().map(({ table }) => getTableConfig(table).name));
    expect(referencingTableNames).toEqual(
      new Set([
        "user_settings",
        "sessions",
        "push_devices",
        "daily_activity",
        "milestone_events",
        "friendships",
        "friend_requests",
        "blocks",
        "encouragements",
        "pending_notifications",
      ]),
    );
  });

  it("efface toute ligne référençant l'utilisateur supprimé, dans toutes les tables", async () => {
    const { db } = handle;

    const [userA] = await db
      .insert(schema.users)
      .values({ appleSub: "dev:alice", username: "alice" })
      .returning();
    const [userB] = await db
      .insert(schema.users)
      .values({ appleSub: "dev:bob", username: "bob" })
      .returning();
    if (!userA || !userB) throw new Error("insertion utilisateur échouée");

    await db.insert(schema.userSettings).values({ userId: userA.id });

    const [session] = await db
      .insert(schema.sessions)
      .values({
        userId: userA.id,
        tokenHash: "hash-de-test",
        expiresAt: new Date(Date.now() + 86_400_000),
      })
      .returning();
    if (!session) throw new Error("insertion session échouée");

    await db.insert(schema.pushDevices).values({
      userId: userA.id,
      sessionId: session.id,
      apnsToken: "a".repeat(64),
      environment: "sandbox",
    });

    await db.insert(schema.dailyActivity).values({
      userId: userA.id,
      date: "2026-09-20",
      steps: 8000,
      activeCalories: 300,
      timeZone: "Europe/Paris",
    });

    await db.insert(schema.milestoneEvents).values({ userId: userA.id, date: "2026-09-20", threshold: 5000 });

    await db.insert(schema.friendships).values([
      { userId: userA.id, friendId: userB.id },
      { userId: userB.id, friendId: userA.id },
    ]);

    await db.insert(schema.friendRequests).values({ senderId: userA.id, recipientId: userB.id });

    await db.insert(schema.blocks).values({ blockerId: userA.id, blockedId: userB.id });

    await db.insert(schema.encouragements).values({
      senderId: userA.id,
      recipientId: userB.id,
      messageId: "bravo",
      senderLocalDate: "2026-09-20",
    });

    await db.insert(schema.pendingNotifications).values({
      recipientId: userB.id,
      actorId: userA.id,
      type: "encouragement_received",
      payload: { fromUserId: userA.id, fromUsername: "alice", messageId: "bravo" },
      deliverAfter: new Date(),
      expiresAt: new Date(Date.now() + 86_400_000),
    });

    await db.delete(schema.users).where(eq(schema.users.id, userA.id));

    for (const { table, column } of columnsReferencingUsers()) {
      const count = await countRowsFor(db, table, column, userA.id);
      expect(count, `${getTableConfig(table).name}.${column.name} référence encore l'utilisateur supprimé`).toBe(0);
    }

    const remainingB = await db.select().from(schema.users).where(eq(schema.users.id, userB.id));
    expect(remainingB).toHaveLength(1);
  });
});
