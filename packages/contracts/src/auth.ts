// Authentification : Sign in with Apple (prod) et connexion de dev (hors production, ADR 001).
import { z } from "zod";
import { TimestampSchema, UserIdSchema, UsernameSchema } from "./common";

/** POST /auth/apple */
export const AppleSignInRequestSchema = z.strictObject({
  /** JWT identityToken renvoyé par Apple, vérifié côté API via le JWKS Apple. */
  identityToken: z.string().min(1).max(4096),
  /** authorizationCode Apple, échangé côté API contre un refresh token (révocation à la suppression). */
  authorizationCode: z.string().min(1).max(1024),
  /** Nonce brut ; l'app a transmis son SHA-256 (hex) à Apple, l'API compare avec le claim `nonce`. */
  nonce: z.string().min(16).max(128),
});
export type AppleSignInRequest = z.infer<typeof AppleSignInRequestSchema>;

/** POST /auth/dev — route absente en production (404). */
export const DevSignInRequestSchema = z.strictObject({
  /** Identifiant stable d'un utilisateur de dev (ex. « alice »). */
  devUserKey: z.string().regex(/^[a-z0-9_-]{1,32}$/),
});
export type DevSignInRequest = z.infer<typeof DevSignInRequestSchema>;

export const SessionSchema = z.object({
  /** Jeton opaque à envoyer en `Authorization: Bearer <token>`. */
  token: z.string().min(32),
  expiresAt: TimestampSchema,
});
export type Session = z.infer<typeof SessionSchema>;

/** Réponse commune à /auth/apple et /auth/dev. */
export const SignInResponseSchema = z.object({
  session: SessionSchema,
  userId: UserIdSchema,
  username: UsernameSchema.nullable(),
  /** true tant que le pseudonyme n'est pas choisi (écran de choix obligatoire). */
  needsUsername: z.boolean(),
});
export type SignInResponse = z.infer<typeof SignInResponseSchema>;
