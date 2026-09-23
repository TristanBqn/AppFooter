// Client Drizzle : PGlite (mémoire ou fichier) si `DATABASE_URL` est vide ou `pglite://…`,
// sinon PostgreSQL managé via `pg` (docs/architecture.md §1, §8).
//
// Les deux pilotes sont chargés par import dynamique : on ne charge jamais le moteur PGlite
// (WASM) en production, où seul `pg` est utilisé.
import { fileURLToPath } from "node:url";
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
  /** Applique les migrations de `drizzle/` (idempotent, table `__drizzle_migrations`). */
  migrate: () => Promise<void>;
  /** Ferme la connexion (pool `pg`) ou l'instance embarquée (PGlite). */
  close: () => Promise<void>;
}

const PGLITE_PREFIX = "pglite://";

/**
 * Dossier des migrations, résolu relativement à ce fichier (et non à `process.cwd()`).
 * `apps/api/scripts/build.mjs` copie `drizzle/` à côté de `dist/` avec le même décalage
 * relatif, pour que ce chemin reste valide une fois `client.ts` intégré au bundle de l'API.
 */
const MIGRATIONS_FOLDER = fileURLToPath(new URL("../drizzle", import.meta.url));

/**
 * @param databaseUrl Vide ⇒ PGlite en mémoire (tests, dev sans PostgreSQL) ;
 *   `pglite://<chemin>` ⇒ PGlite persisté dans un dossier local (dev sans Docker) ;
 *   sinon une URL PostgreSQL standard (`postgres://…`), utilisée en production.
 */
export async function createDb(databaseUrl: string): Promise<DbHandle> {
  if (databaseUrl === "" || databaseUrl.startsWith(PGLITE_PREFIX)) {
    const dataDir = databaseUrl.startsWith(PGLITE_PREFIX) ? databaseUrl.slice(PGLITE_PREFIX.length) : undefined;
    const [{ PGlite }, { drizzle }, { migrate }] = await Promise.all([
      import("@electric-sql/pglite"),
      import("drizzle-orm/pglite"),
      import("drizzle-orm/pglite/migrator"),
    ]);
    const client = new PGlite(dataDir);
    const db = drizzle(client, { schema });
    return {
      db: db as unknown as Db,
      migrate: () => migrate(db, { migrationsFolder: MIGRATIONS_FOLDER }),
      close: () => client.close(),
    };
  }

  const [{ Pool }, { drizzle }, { migrate }] = await Promise.all([
    import("pg"),
    import("drizzle-orm/node-postgres"),
    import("drizzle-orm/node-postgres/migrator"),
  ]);
  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool, { schema });
  return {
    db,
    migrate: () => migrate(db, { migrationsFolder: MIGRATIONS_FOLDER }),
    close: async () => {
      await pool.end();
    },
  };
}
