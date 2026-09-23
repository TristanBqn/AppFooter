// Assemblage de GET /me : profil utilisateur + paramètres (toujours créés ensemble, cf.
// `findOrCreateUserByAppleSub`).
import type { Me } from "@app/contracts";
import type { Db } from "@app/db";
import { schema } from "@app/db";
import { eq } from "drizzle-orm";
import { minutesToLocalTime } from "../../lib/time";

export async function loadMe(db: Db, userId: string): Promise<Me | null> {
  const rows = await db
    .select({
      userId: schema.users.id,
      username: schema.users.username,
      timeZone: schema.users.timeZone,
      healthConsentAt: schema.users.healthConsentAt,
      lastSyncAt: schema.users.lastSyncAt,
      createdAt: schema.users.createdAt,
      showCalories: schema.userSettings.showCalories,
      acceptFriendRequests: schema.userSettings.acceptFriendRequests,
      shareMilestones: schema.userSettings.shareMilestones,
      notifyMilestones: schema.userSettings.notifyMilestones,
      notifyFriendMilestones: schema.userSettings.notifyFriendMilestones,
      notifyEncouragements: schema.userSettings.notifyEncouragements,
      notifyFriendRequests: schema.userSettings.notifyFriendRequests,
      quietEnabled: schema.userSettings.quietEnabled,
      quietStartMin: schema.userSettings.quietStartMin,
      quietEndMin: schema.userSettings.quietEndMin,
    })
    .from(schema.users)
    .innerJoin(schema.userSettings, eq(schema.userSettings.userId, schema.users.id))
    .where(eq(schema.users.id, userId))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  return {
    userId: row.userId,
    username: row.username,
    timeZone: row.timeZone,
    healthConsentAt: row.healthConsentAt?.toISOString() ?? null,
    lastSyncAt: row.lastSyncAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    settings: {
      privacy: {
        showCalories: row.showCalories,
        acceptFriendRequests: row.acceptFriendRequests,
        shareMilestones: row.shareMilestones,
      },
      notifications: {
        milestones: row.notifyMilestones,
        friendMilestones: row.notifyFriendMilestones,
        encouragements: row.notifyEncouragements,
        friendRequests: row.notifyFriendRequests,
      },
      quietHours: {
        enabled: row.quietEnabled,
        start: minutesToLocalTime(row.quietStartMin),
        end: minutesToLocalTime(row.quietEndMin),
      },
    },
  };
}
