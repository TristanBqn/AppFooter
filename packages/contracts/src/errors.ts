// Enveloppe d'erreur unique de l'API et catalogue fermé des codes (code => statut HTTP).
import { z } from "zod";

export const ERROR_STATUS = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  APPLE_TOKEN_INVALID: 401,
  USERNAME_REQUIRED: 403,
  HEALTH_CONSENT_REQUIRED: 403,
  NOT_FOUND: 404,
  USERNAME_TAKEN: 409,
  USERNAME_ALREADY_SET: 409,
  TARGET_BLOCKED: 409,
  FRIEND_LIMIT_REACHED: 409,
  CANNOT_TARGET_SELF: 422,
  DATE_OUT_OF_RANGE: 422,
  ENCOURAGEMENT_LIMIT: 429,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  UPSTREAM_UNAVAILABLE: 503,
} as const;

export type ErrorCode = keyof typeof ERROR_STATUS;
export const ERROR_CODES = Object.keys(ERROR_STATUS) as [ErrorCode, ...ErrorCode[]];
export const ErrorCodeSchema = z.enum(ERROR_CODES);

export const ApiErrorSchema = z.object({
  error: z.object({
    code: ErrorCodeSchema,
    /** Message technique, non destiné à l'affichage : le mobile traduit le code. */
    message: z.string(),
    /** Détails de validation (chemin + message), seulement pour VALIDATION_ERROR. */
    issues: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;
