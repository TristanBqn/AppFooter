// Client Drizzle : PGlite (mémoire ou fichier) si `DATABASE_URL` est vide ou `pglite://…`,
// sinon PostgreSQL managé via `pg` (docs/architecture.md §1, §8).
//
// Les deux pilotes sont chargés par import dynamique : on ne charge jamais le moteur PGlite
// (WASM) en production, où seul `pg` est utilisé.
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

/**
 * Type unique utilisé par le reste de l'API, quel que soit le pilote réel.
 * PGlite et `pg` partagent le même constructeur de requêtes (dialecte PostgreSQL de Drizzle) ;
 * on unifie sur le type `node-postgres` pour éviter de propager une union dans tout le code
 * appelant (aucune fonctionnalité spécifique au pilote n'est utilisée par les dépôts).
 */
export type Db = NodePgDatabase<typeof schema>;

export interface DbHandle {
  db: Db;
  /** Ferme la connexion (pool `pg`) ou l'instance embarquée (PGlite). */
  close: () => Promise<void>;
}

const PGLITE_PREFIX = "pglite://";

/**
 * @param databaseUrl Vide ⇒ PGlite en mémoire (tests, dev sans PostgreSQL) ;
 *   `pglite://<chemin>` ⇒ PGlite persisté dans un dossier local (dev sans Docker) ;
 *   sinon une URL PostgreSQL standard (`postgres://…`), utilisée en production.
 */
export async function createDb(databaseUrl: string): Promise<DbHandle> {
  if (databaseUrl === "" || databaseUrl.startsWith(PGLITE_PREFIX)) {
    const dataDir = databaseUrl.startsWith(PGLITE_PREFIX) ? databaseUrl.slice(PGLITE_PREFIX.length) : undefined;
    const [{ PGlite }, { drizzle }] = await Promise.all([
      import("@electric-sql/pglite"),
      import("drizzle-orm/pglite"),
    ]);
    const client = new PGlite(dataDir);
    const db = drizzle(client, { schema }) as unknown as Db;
    return { db, close: () => client.close() };
  }

  const [{ Pool }, { drizzle }] = await Promise.all([
    import("pg"),
    import("drizzle-orm/node-postgres"),
  ]);
  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool, { schema });
  return {
    db,
    close: async () => {
      await pool.end();
    },
  };
}
