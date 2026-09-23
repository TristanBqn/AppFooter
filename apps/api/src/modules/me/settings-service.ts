// GET/PATCH /me/settings (F15). Toujours créés avec l'utilisateur (`findOrCreateUserByAppleSub`).
import type { Settings, UpdateSettingsRequest } from "@app/contracts";
import type { Db } from "@app/db";
import { schema } from "@app/db";
import { eq } from "drizzle-orm";
import { localTimeToMinutes, minutesToLocalTime } from "../../lib/time";

type UserSettingsRow = typeof schema.userSettings.$inferSelect;

function toSettings(row: UserSettingsRow): Settings {
  return {
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
  };
}

export async function getSettings(db: Db, userId: string): Promise<Settings | null> {
  const [row] = await db.select().from(schema.userSettings).where(eq(schema.userSettings.userId, userId));
  return row ? toSettings(row) : null;
}

export async function updateSettings(db: Db, userId: string, patch: UpdateSettingsRequest): Promise<Settings | null> {
  const values: Partial<typeof schema.userSettings.$inferInsert> = {};

  if (patch.privacy?.showCalories !== undefined) values.showCalories = patch.privacy.showCalories;
  if (patch.privacy?.acceptFriendRequests !== undefined) values.acceptFriendRequests = patch.privacy.acceptFriendRequests;
  if (patch.privacy?.shareMilestones !== undefined) values.shareMilestones = patch.privacy.shareMilestones;

  if (patch.notifications?.milestones !== undefined) values.notifyMilestones = patch.notifications.milestones;
  if (patch.notifications?.friendMilestones !== undefined) values.notifyFriendMilestones = patch.notifications.friendMilestones;
  if (patch.notifications?.encouragements !== undefined) values.notifyEncouragements = patch.notifications.encouragements;
  if (patch.notifications?.friendRequests !== undefined) values.notifyFriendRequests = patch.notifications.friendRequests;

  if (patch.quietHours) {
    values.quietEnabled = patch.quietHours.enabled;
    values.quietStartMin = localTimeToMinutes(patch.quietHours.start);
    values.quietEndMin = localTimeToMinutes(patch.quietHours.end);
  }

  if (Object.keys(values).length > 0) {
    await db.update(schema.userSettings).set(values).where(eq(schema.userSettings.userId, userId));
  }
  return getSettings(db, userId);
}
