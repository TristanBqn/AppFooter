// Types de base réutilisés par tous les schémas.
import { z } from "zod";
import {
  MAX_DAILY_ACTIVE_CALORIES,
  MAX_DAILY_STEPS,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  USERNAME_PATTERN,
} from "./constants";

export const UserIdSchema = z.uuid();
export type UserId = z.infer<typeof UserIdSchema>;

/** Pseudonyme normalisé : trim + minuscules, puis format (CA2). */
export const UsernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(USERNAME_MIN_LENGTH)
  .max(USERNAME_MAX_LENGTH)
  .regex(USERNAME_PATTERN);
export type Username = z.infer<typeof UsernameSchema>;

/** Date locale civile AAAA-MM-JJ (jour de l'utilisateur dans son fuseau). */
export const LocalDateSchema = z.iso.date();
export type LocalDate = z.infer<typeof LocalDateSchema>;

/** Horodatage ISO 8601 UTC (suffixe Z). */
export const TimestampSchema = z.iso.datetime();

/** Fuseau IANA reconnu par le moteur Intl (ex. « Europe/Paris »). */
export const TimeZoneSchema = z
  .string()
  .min(1)
  .max(64)
  .refine((tz) => {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }, "Fuseau IANA invalide");

/** Heure locale HH:MM (24 h). */
export const LocalTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const StepsSchema = z.int().min(0).max(MAX_DAILY_STEPS);
export const ActiveCaloriesSchema = z.int().min(0).max(MAX_DAILY_ACTIVE_CALORIES);

/** Référence publique à un autre utilisateur : jamais d'identifiant Apple ni d'e-mail. */
export const PublicUserSchema = z.object({
  userId: UserIdSchema,
  username: UsernameSchema,
});
export type PublicUser = z.infer<typeof PublicUserSchema>;

/** Paramètres de chemin. */
export const UserIdParamSchema = z.strictObject({ userId: UserIdSchema });
export const IdParamSchema = z.strictObject({ id: z.uuid() });
