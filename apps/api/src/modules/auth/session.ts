// Cycle de vie des sessions opaques (ADR 001) : création, résolution (avec expiration glissante
// mise à jour au plus une fois par jour), suppression (déconnexion).
import { SESSION_TTL_DAYS } from "@app/contracts";
import type { Db } from "@app/db";
import { schema } from "@app/db";
import { and, eq, gt } from "drizzle-orm";
import { hashSessionToken, generateSessionToken } from "../../lib/session-token";
import type { AuthContext } from "../../context";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const SESSION_TTL_MS = SESSION_TTL_DAYS * ONE_DAY_MS;

export interface CreatedSession {
  token: string;
  expiresAt: Date;
}

export async function createSession(db: Db, userId: string, now: Date): Promise<CreatedSession> {
  const token = generateSessionToken();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  await db.insert(schema.sessions).values({
    userId,
    tokenHash: hashSessionToken(token),
    expiresAt,
    lastUsedAt: now,
  });
  return { token, expiresAt };
}

/** null si le jeton est inconnu, expiré, ou malformé. */
export async function resolveSession(db: Db, token: string, now: Date): Promise<AuthContext | null> {
  const tokenHash = hashSessionToken(token);
  const rows = await db
    .select({
      sessionId: schema.sessions.id,
      userId: schema.sessions.userId,
      username: schema.users.username,
      lastUsedAt: schema.sessions.lastUsedAt,
    })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(and(eq(schema.sessions.tokenHash, tokenHash), gt(schema.sessions.expiresAt, now)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;

  if (now.getTime() - row.lastUsedAt.getTime() > ONE_DAY_MS) {
    await db
      .update(schema.sessions)
      .set({ lastUsedAt: now, expiresAt: new Date(now.getTime() + SESSION_TTL_MS) })
      .where(eq(schema.sessions.id, row.sessionId));
  }

  return { sessionId: row.sessionId, userId: row.userId, username: row.username };
}

export async function deleteSession(db: Db, sessionId: string): Promise<void> {
  await db.delete(schema.sessions).where(eq(schema.sessions.id, sessionId));
}
