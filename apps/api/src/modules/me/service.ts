// Assemblage de GET /me : profil utilisateur + paramètres (toujours créés ensemble, cf.
// `findOrCreateUserByAppleSub`).
import type { Me } from "@app/contracts";
import type { Db } from "@app/db";
import { schema } from "@app/db";
import { eq } from "drizzle-orm";
import { getSettings } from "./settings-service";

export async function loadMe(db: Db, userId: string): Promise<Me | null> {
  const [user] = await db
    .select({
      userId: schema.users.id,
      username: schema.users.username,
      timeZone: schema.users.timeZone,
      healthConsentAt: schema.users.healthConsentAt,
      lastSyncAt: schema.users.lastSyncAt,
      createdAt: schema.users.createdAt,
    })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  if (!user) return null;

  const settings = await getSettings(db, userId);
  if (!settings) return null; // ne devrait pas arriver : créés ensemble à l'inscription.

  return {
    userId: user.userId,
    username: user.username,
    timeZone: user.timeZone,
    healthConsentAt: user.healthConsentAt?.toISOString() ?? null,
    lastSyncAt: user.lastSyncAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    settings,
  };
}
