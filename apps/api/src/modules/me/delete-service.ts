// DELETE /me (CA12, ADR 001, ADR 006) : révocation Apple best effort, puis suppression en
// cascade (une seule instruction SQL, toutes les FK vers `users.id` sont `ON DELETE CASCADE`).
import type { Db } from "@app/db";
import { schema } from "@app/db";
import { eq } from "drizzle-orm";
import { decryptSecret } from "../../lib/secret-box";
import type { AppleTokenClient } from "../auth/apple/token-client";

export async function deleteAccount(
  db: Db,
  appleTokenClient: AppleTokenClient,
  appleTokenEncKey: string | undefined,
  userId: string,
): Promise<void> {
  const [user] = await db
    .select({ appleRefreshTokenEnc: schema.users.appleRefreshTokenEnc })
    .from(schema.users)
    .where(eq(schema.users.id, userId));

  if (user?.appleRefreshTokenEnc && appleTokenEncKey) {
    try {
      const refreshToken = decryptSecret(user.appleRefreshTokenEnc, appleTokenEncKey);
      await appleTokenClient.revoke(refreshToken); // best effort, ne lève jamais (ADR 001).
    } catch {
      // Déchiffrement impossible (ex. clé changée) : la suppression du compte n'est jamais bloquée.
    }
  }

  await db.delete(schema.users).where(eq(schema.users.id, userId));
}
