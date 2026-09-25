// DELETE /me (CA12, ADR 001/006) : révocation Apple best effort, suppression en cascade,
// ancien jeton invalidé. Test générique (même technique que `packages/db/cascade.test.ts`) :
// parcourt le schéma pour trouver toute colonne référençant `users.id`, sans liste codée en dur.
import { randomBytes } from "node:crypto";
import { SignInResponseSchema } from "@app/contracts";
import { schema } from "@app/db";
import { eq, is, sql } from "drizzle-orm";
import { type AnyPgColumn, getTableConfig, PgTable } from "drizzle-orm/pg-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { decryptSecret } from "../../lib/secret-box";
import { resetRateLimits } from "../../middleware/rate-limit";
import { createTestApp, type TestApp } from "../../test-support";
import type { AppleIdentityVerifier } from "../auth/apple/identity-verifier";
import type { AppleTokenClient } from "../auth/apple/token-client";

function tables(): PgTable[] {
  return Object.values(schema).filter((value) => is(value, PgTable)) as PgTable[];
}

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

async function countRowsFor(testApp: TestApp, table: PgTable, column: AnyPgColumn, userId: string): Promise<number> {
  const result = await testApp.db.execute<{ count: number }>(
    sql`select count(*)::int as count from ${table} where ${column} = ${userId}`,
  );
  return Number(result.rows[0]?.count ?? -1);
}

async function signInDev(testApp: TestApp, devUserKey: string) {
  const res = await testApp.app.request("/auth/dev", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ devUserKey }),
  });
  return SignInResponseSchema.parse(await res.json());
}

function authHeader(token: string) {
  return { authorization: `Bearer ${token}`, "content-type": "application/json" };
}

async function seedUser(testApp: TestApp, devUserKey: string, username: string) {
  const signIn = await signInDev(testApp, devUserKey);
  await testApp.app.request("/me/username", {
    method: "PUT",
    headers: authHeader(signIn.session.token),
    body: JSON.stringify({ username }),
  });
  return signIn;
}

describe("DELETE /me (CA12)", () => {
  let testApp: TestApp;

  beforeEach(() => resetRateLimits());
  afterEach(async () => {
    await testApp?.close();
  });

  it("efface toute ligne référençant l'utilisateur dans toutes les tables ; ancien jeton ⇒ 401", async () => {
    testApp = await createTestApp();
    const alice = await seedUser(testApp, "alice", "alice");
    const bob = await seedUser(testApp, "bob", "bob");

    // Consentement, synchro, historique.
    await testApp.app.request("/me/consents/health", {
      method: "PUT",
      headers: authHeader(alice.session.token),
      body: JSON.stringify({ granted: true }),
    });
    await testApp.app.request("/me/activity", {
      method: "PUT",
      headers: authHeader(alice.session.token),
      body: JSON.stringify({ timeZone: "Europe/Paris", days: [{ date: "2026-09-20", steps: 5200, activeCalories: 200 }] }),
    });

    // Amitié, demande, blocage, encouragement, appareil.
    await testApp.db.insert(schema.friendships).values([
      { userId: alice.userId, friendId: bob.userId },
      { userId: bob.userId, friendId: alice.userId },
    ]);
    await testApp.db.insert(schema.friendRequests).values({ senderId: bob.userId, recipientId: alice.userId });
    await testApp.db.insert(schema.blocks).values({ blockerId: alice.userId, blockedId: bob.userId });
    await testApp.db.insert(schema.encouragements).values({
      senderId: bob.userId,
      recipientId: alice.userId,
      messageId: "bravo",
      senderLocalDate: "2026-09-20",
    });
    await testApp.app.request("/me/devices", {
      method: "PUT",
      headers: authHeader(alice.session.token),
      body: JSON.stringify({ apnsToken: "a".repeat(64), environment: "sandbox" }),
    });
    await testApp.db.insert(schema.pendingNotifications).values({
      recipientId: bob.userId,
      actorId: alice.userId,
      type: "encouragement_received",
      payload: { fromUserId: alice.userId, fromUsername: "alice", messageId: "bravo" },
      deliverAfter: new Date(),
      expiresAt: new Date(Date.now() + 86_400_000),
    });

    const res = await testApp.app.request("/me", { method: "DELETE", headers: authHeader(alice.session.token) });
    expect(res.status).toBe(204);

    for (const { table, column } of columnsReferencingUsers()) {
      const count = await countRowsFor(testApp, table, column, alice.userId);
      expect(count, `${getTableConfig(table).name}.${column.name} référence encore l'utilisateur supprimé`).toBe(0);
    }

    const meAfter = await testApp.app.request("/me", { headers: authHeader(alice.session.token) });
    expect(meAfter.status).toBe(401);

    // Bob (non supprimé) doit toujours exister.
    const bobRow = await testApp.db.select().from(schema.users).where(eq(schema.users.id, bob.userId));
    expect(bobRow).toHaveLength(1);
  });

  it("révoque le refresh token Apple (best effort) avant suppression", async () => {
    const encKey = randomBytes(32).toString("base64");
    const revoke = vi.fn().mockResolvedValue(undefined);
    const appleTokenClient: AppleTokenClient = { exchangeCode: vi.fn().mockResolvedValue("refresh-secret"), revoke };
    const appleIdentityVerifier: AppleIdentityVerifier = { verify: vi.fn().mockResolvedValue({ sub: "apple-sub-1" }) };
    testApp = await createTestApp({ env: { appleTokenEncKey: encKey }, appleIdentityVerifier, appleTokenClient });

    const signInRes = await testApp.app.request("/auth/apple", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ identityToken: "jwt", authorizationCode: "code", nonce: randomBytes(16).toString("hex") }),
    });
    const signIn = SignInResponseSchema.parse(await signInRes.json());

    const [row] = await testApp.db.select({ enc: schema.users.appleRefreshTokenEnc }).from(schema.users).where(eq(schema.users.id, signIn.userId));
    expect(decryptSecret(row!.enc!, encKey)).toBe("refresh-secret");

    const res = await testApp.app.request("/me", { method: "DELETE", headers: authHeader(signIn.session.token) });
    expect(res.status).toBe(204);
    expect(revoke).toHaveBeenCalledWith("refresh-secret");
  });

  it("compte de dev sans refresh token Apple : suppression réussit sans appeler revoke", async () => {
    const revoke = vi.fn().mockResolvedValue(undefined);
    testApp = await createTestApp({ appleTokenClient: { exchangeCode: vi.fn().mockResolvedValue(null), revoke } });
    const alice = await seedUser(testApp, "alice", "alice");

    const res = await testApp.app.request("/me", { method: "DELETE", headers: authHeader(alice.session.token) });
    expect(res.status).toBe(204);
    expect(revoke).not.toHaveBeenCalled();
  });

  it("sans jeton ⇒ 401", async () => {
    testApp = await createTestApp();
    const res = await testApp.app.request("/me", { method: "DELETE" });
    expect(res.status).toBe(401);
  });
});
