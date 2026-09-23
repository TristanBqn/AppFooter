// PUT /me/consents/health (art. 9 RGPD, ADR 006). Le retrait efface l'activité stockée.
import type { Db } from "@app/db";
import { schema } from "@app/db";
import { eq } from "drizzle-orm";

/** Renvoie l'horodatage du consentement (accordé) ou `null` (retiré). */
export async function setHealthConsent(db: Db, userId: string, granted: boolean, now: Date): Promise<Date | null> {
  if (granted) {
    await db.update(schema.users).set({ healthConsentAt: now }).where(eq(schema.users.id, userId));
    return now;
  }

  await db.transaction(async (tx) => {
    await tx.delete(schema.dailyActivity).where(eq(schema.dailyActivity.userId, userId));
    await tx.delete(schema.milestoneEvents).where(eq(schema.milestoneEvents.userId, userId));
    await tx.update(schema.users).set({ healthConsentAt: null }).where(eq(schema.users.id, userId));
  });
  return null;
}
