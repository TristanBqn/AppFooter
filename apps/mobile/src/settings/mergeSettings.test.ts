import { describe, expect, it } from "vitest";
import type { Settings } from "@app/contracts";
import { mergeSettings } from "./mergeSettings";

const BASE: Settings = {
  privacy: { showCalories: true, acceptFriendRequests: true, shareMilestones: true },
  notifications: { milestones: true, friendMilestones: true, encouragements: true, friendRequests: true },
  quietHours: { enabled: true, start: "22:00", end: "08:00" },
};

describe("mergeSettings", () => {
  it("applique un correctif de confidentialité sans toucher au reste", () => {
    expect(mergeSettings(BASE, { privacy: { showCalories: false } })).toEqual({
      ...BASE,
      privacy: { ...BASE.privacy, showCalories: false },
    });
  });

  it("applique un correctif de notifications", () => {
    expect(mergeSettings(BASE, { notifications: { encouragements: false } })).toEqual({
      ...BASE,
      notifications: { ...BASE.notifications, encouragements: false },
    });
  });

  it("applique un correctif d'heures silencieuses complet", () => {
    expect(mergeSettings(BASE, { quietHours: { enabled: false, start: "23:00", end: "07:00" } })).toEqual({
      ...BASE,
      quietHours: { enabled: false, start: "23:00", end: "07:00" },
    });
  });

  it("correctif vide : aucun changement", () => {
    expect(mergeSettings(BASE, {})).toEqual(BASE);
  });
});
