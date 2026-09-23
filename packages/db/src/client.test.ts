import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { createDb } from "./client";

describe("createDb", () => {
  const handles: Array<() => Promise<void>> = [];
  afterEach(async () => {
    await Promise.all(handles.splice(0).map((close) => close()));
  });

  it("DATABASE_URL vide ⇒ PGlite en mémoire, requêtes fonctionnelles", async () => {
    const { db, close } = await createDb("");
    handles.push(close);
    const rows = await db.execute(sql`select 1 as one`);
    expect(rows.rows[0]).toEqual({ one: 1 });
  });

  it("pglite://<dossier> ⇒ PGlite persisté sur disque", async () => {
    const dir = await mkdtemp(join(tmpdir(), "footer-db-test-"));
    try {
      const { db, close } = await createDb(`pglite://${dir}`);
      handles.push(close);
      const rows = await db.execute(sql`select 1 as one`);
      expect(rows.rows[0]).toEqual({ one: 1 });
    } finally {
      await rm(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
    }
  });
});
