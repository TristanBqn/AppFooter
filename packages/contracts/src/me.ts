// Profil, pseudonyme, paramètres, consentement santé, appareils push.
import { z } from "zod";
import {
  LocalTimeSchema,
  TimeZoneSchema,
  TimestampSchema,
  UserIdSchema,
  UsernameSchema,
} from "./common";

const quietHoursShape = {
  enabled: z.boolean(),
  start: LocalTimeSchema,
  end: LocalTimeSchema,
};
const distinctBounds = (q: { start: string; end: string }) => q.start !== q.end;

export const QuietHoursSchema = z
  .object(quietHoursShape)
  .refine(distinctBounds, "start et end doivent différer");
export type QuietHours = z.infer<typeof QuietHoursSchema>;

const privacyShape = {
  showCalories: z.boolean(),
  acceptFriendRequests: z.boolean(),
  shareMilestones: z.boolean(),
};
const notificationsShape = {
  milestones: z.boolean(),
  friendMilestones: z.boolean(),
  encouragements: z.boolean(),
  friendRequests: z.boolean(),
};

/** GET /me/settings */
export const SettingsSchema = z.object({
  privacy: z.object(privacyShape),
  notifications: z.object(notificationsShape),
  quietHours: QuietHoursSchema,
});
export type Settings = z.infer<typeof SettingsSchema>;

/** PATCH /me/settings : mise à jour partielle ; renvoie Settings complet. */
export const UpdateSettingsRequestSchema = z.strictObject({
  privacy: z.strictObject(privacyShape).partial().optional(),
  notifications: z.strictObject(notificationsShape).partial().optional(),
  quietHours: z
    .strictObject(quietHoursShape)
    .refine(distinctBounds, "start et end doivent différer")
    .optional(),
});
export type UpdateSettingsRequest = z.infer<typeof UpdateSettingsRequestSchema>;

/** GET /me */
export const MeSchema = z.object({
  userId: UserIdSchema,
  username: UsernameSchema.nullable(),
  timeZone: TimeZoneSchema,
  healthConsentAt: TimestampSchema.nullable(),
  lastSyncAt: TimestampSchema.nullable(),
  createdAt: TimestampSchema,
  settings: SettingsSchema,
});
export type Me = z.infer<typeof MeSchema>;

/** PUT /me/username — une seule fois (USERNAME_ALREADY_SET ensuite). Renvoie Me. */
export const SetUsernameRequestSchema = z.strictObject({ username: UsernameSchema });
export type SetUsernameRequest = z.infer<typeof SetUsernameRequestSchema>;

/**
 * PUT /me/consents/health — consentement explicite art. 9 RGPD, requis avant toute synchro.
 * granted=false : retrait du consentement, efface l'activité stockée.
 */
export const HealthConsentRequestSchema = z.strictObject({ granted: z.boolean() });
export type HealthConsentRequest = z.infer<typeof HealthConsentRequestSchema>;
export const HealthConsentResponseSchema = z.object({ healthConsentAt: TimestampSchema.nullable() });
export type HealthConsentResponse = z.infer<typeof HealthConsentResponseSchema>;

/** PUT /me/devices — jeton APNs natif (hex) rattaché à la session courante. 204. */
export const RegisterDeviceRequestSchema = z.strictObject({
  apnsToken: z.string().regex(/^[0-9a-f]{64,200}$/i),
  environment: z.enum(["sandbox", "production"]),
});
export type RegisterDeviceRequest = z.infer<typeof RegisterDeviceRequestSchema>;
