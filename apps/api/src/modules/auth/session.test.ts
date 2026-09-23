import { SESSION_TTL_DAYS } from "@app/contracts";
import { createDb, schema, type DbHandle } from "@app/db";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createSession, deleteSession, resolveSession } from "./session";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

describe("sessions (ADR 001)", () => {
  let handle: DbHandle;
  let userId: string;

  beforeEach(async () => {
    handle = await createDb("");
    await handle.migrate();
    const [user] = await handle.db.insert(schema.users).values({ appleSub: "dev:alice" }).returning();
    if (!user) throw new Error("insertion utilisateur échouée");
    userId = user.id;
  });
  afterEach(async () => {
    await handle.close();
  });

  it("résout une session valide et renvoie son propriétaire", async () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const { token } = await createSession(handle.db, userId, now);
    const resolved = await resolveSession(handle.db, token, now);
    expect(resolved).toEqual({ sessionId: expect.any(String), userId, username: null });
  });

  it("jeton inconnu ⇒ null", async () => {
    const resolved = await resolveSession(handle.db, "jeton-inexistant", new Date());
    expect(resolved).toBeNull();
  });

  it("session expirée (> SESSION_TTL_DAYS) ⇒ null", async () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const { token } = await createSession(handle.db, userId, now);
    const after = new Date(now.getTime() + (SESSION_TTL_DAYS + 1) * ONE_DAY_MS);
    expect(await resolveSession(handle.db, token, after)).toBeNull();
  });

  it("expiration glissante : last_used_at n'avance qu'au-delà d'un jour", async () => {
    const t0 = new Date("2026-01-01T00:00:00Z");
    const { token } = await createSession(handle.db, userId, t0);

    const soon = new Date(t0.getTime() + 60_000);
    await resolveSession(handle.db, token, soon);
    const [afterSoon] = await handle.db.select().from(schema.sessions).where(eq(schema.sessions.userId, userId));
    expect(afterSoon?.lastUsedAt.getTime()).toBe(t0.getTime());

    const muchLater = new Date(t0.getTime() + 2 * ONE_DAY_MS);
    await resolveSession(handle.db, token, muchLater);
    const [afterLater] = await handle.db.select().from(schema.sessions).where(eq(schema.sessions.userId, userId));
    expect(afterLater?.lastUsedAt.getTime()).toBe(muchLater.getTime());
    expect(afterLater?.expiresAt.getTime()).toBe(muchLater.getTime() + SESSION_TTL_DAYS * ONE_DAY_MS);
  });

  it("deleteSession invalide immédiatement le jeton", async () => {
    const now = new Date();
    const { token } = await createSession(handle.db, userId, now);
    const resolved = await resolveSession(handle.db, token, now);
    await deleteSession(handle.db, resolved!.sessionId);
    expect(await resolveSession(handle.db, token, now)).toBeNull();
  });
});
