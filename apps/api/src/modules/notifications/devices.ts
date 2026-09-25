// PUT /me/devices : jeton APNs natif rattaché à la session courante (un jeton appartient à un
// seul appareil physique ; le ré-enregistrer réassigne utilisateur/session, ex. après reconnexion).
import type { Db } from "@app/db";
import { schema } from "@app/db";

export async function registerDevice(
  db: Db,
  userId: string,
  sessionId: string,
  apnsToken: string,
  environment: "sandbox" | "production",
): Promise<void> {
  await db
    .insert(schema.pushDevices)
    .values({ userId, sessionId, apnsToken, environment })
    .onConflictDoUpdate({ target: schema.pushDevices.apnsToken, set: { userId, sessionId, environment } });
}
