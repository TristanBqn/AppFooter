// Fusion pure d'un correctif partiel (PATCH /me/settings) dans les réglages connus, pour la mise
// à jour optimiste de chaque bascule (M9, DESIGN.md §0 : « Chaque bascule est optimiste »).
import type { Settings, UpdateSettingsRequest } from "@app/contracts";

export function mergeSettings(current: Settings, patch: UpdateSettingsRequest): Settings {
  return {
    privacy: { ...current.privacy, ...patch.privacy },
    notifications: { ...current.notifications, ...patch.notifications },
    quietHours: patch.quietHours ? { ...current.quietHours, ...patch.quietHours } : current.quietHours,
  };
}
