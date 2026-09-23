// Création et pseudonyme des utilisateurs (CA2). La connexion Apple (B4) et la connexion de dev
// partagent ces fonctions une fois l'identité (`apple_sub` ou `dev:<clé>`) établie.
import { schema } from "@app/db";
import type { Db } from "@app/db";
import { eq } from "drizzle-orm";
import { AppError } from "../../errors";

export interface SignedInUser {
  id: string;
  username: string | null;
  needsUsername: boolean;
}

/**
 * Code SQLSTATE d'une violation de contrainte unique (identique pour `pg` et PGlite, vrai
 * Postgres). Drizzle enveloppe l'erreur du pilote dans `DrizzleQueryError` (`.cause`).
 */
function isUniqueViolation(err: unknown): boolean {
  const code = (err as { code?: unknown } | undefined)?.code;
  if (code === "23505") return true;
  const cause = (err as { cause?: unknown } | undefined)?.cause;
  return typeof cause === "object" && cause !== null && (cause as { code?: unknown }).code === "23505";
}

/** Trouve ou crée l'utilisateur pour un `apple_sub` donné (réel ou `dev:<clé>`), avec ses paramètres par défaut. */
export async function findOrCreateUserByAppleSub(db: Db, appleSub: string): Promise<SignedInUser> {
  const existing = await db
    .select({ id: schema.users.id, username: schema.users.username })
    .from(schema.users)
    .where(eq(schema.users.appleSub, appleSub))
    .limit(1);
  const found = existing[0];
  if (found) {
    return { id: found.id, username: found.username, needsUsername: found.username === null };
  }

  const [created] = await db
    .insert(schema.users)
    .values({ appleSub })
    .returning({ id: schema.users.id, username: schema.users.username });
  if (!created) throw new Error("Échec de la création de l'utilisateur");
  await db.insert(schema.userSettings).values({ userId: created.id });
  return { id: created.id, username: created.username, needsUsername: true };
}

/**
 * PUT /me/username : une seule fois (409 USERNAME_ALREADY_SET ensuite).
 * 409 USERNAME_TAKEN si un autre utilisateur a déjà ce pseudonyme (insensible à la casse, CA2) :
 * détecté via l'index unique `lower(username)`, pas par une lecture préalable (pas de TOCTOU).
 */
export async function setUsername(db: Db, userId: string, username: string): Promise<void> {
  const current = await db
    .select({ username: schema.users.username })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  if (!current[0]) throw new AppError("UNAUTHENTICATED", "Utilisateur introuvable");
  if (current[0].username !== null) {
    throw new AppError("USERNAME_ALREADY_SET", "Le pseudonyme est déjà défini");
  }
  try {
    await db.update(schema.users).set({ username }).where(eq(schema.users.id, userId));
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new AppError("USERNAME_TAKEN", "Ce pseudonyme est déjà pris");
    }
    throw err;
  }
}
