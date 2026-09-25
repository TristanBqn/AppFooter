// Variables d'environnement (docs/architecture.md §8, .env.example) validées par Zod.
// Le démarrage échoue si `APP_ENV=production` et qu'une variable requise manque, ou si
// la connexion de dev / le transport console / PGlite sont actifs (docs/architecture.md §4).
import { z } from "zod";

const booleanFlag = z
  .string()
  .optional()
  .transform((v) => v === "true");

const RawEnvSchema = z.object({
  APP_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().optional().default(""),
  ENABLE_DEV_LOGIN: booleanFlag,
  APPLE_BUNDLE_ID: z.string().min(1).optional(),
  APPLE_TEAM_ID: z.string().min(1).optional(),
  APPLE_SIGNIN_KEY_ID: z.string().min(1).optional(),
  APPLE_SIGNIN_PRIVATE_KEY: z.string().min(1).optional(),
  APPLE_TOKEN_ENC_KEY: z.string().min(1).optional(),
  PUSH_TRANSPORT: z.enum(["apns", "console"]).default("console"),
  APNS_KEY_ID: z.string().min(1).optional(),
  APNS_PRIVATE_KEY: z.string().min(1).optional(),
  TRUST_PROXY: booleanFlag,
  /** Débit /auth/* relevé pour les E2E (beaucoup d'utilisateurs créés depuis une même IP) ;
   * jamais en production (voir `assertProductionReady`), fixé uniquement par `start:e2e`. */
  E2E_AUTH_RATE_LIMIT: z.coerce.number().int().positive().optional(),
});

export interface Env {
  appEnv: "development" | "test" | "production";
  apiPort: number;
  databaseUrl: string;
  enableDevLogin: boolean;
  appleBundleId: string | undefined;
  appleTeamId: string | undefined;
  appleSignInKeyId: string | undefined;
  appleSignInPrivateKey: string | undefined;
  appleTokenEncKey: string | undefined;
  pushTransport: "apns" | "console";
  apnsKeyId: string | undefined;
  apnsPrivateKey: string | undefined;
  trustProxy: boolean;
  e2eAuthRateLimit: number | undefined;
}

/** Lève une erreur listant tout ce qui manque plutôt que d'échouer sur la première variable. */
function assertProductionReady(env: Env): void {
  if (env.appEnv !== "production") return;
  const problems: string[] = [];
  if (!env.databaseUrl) problems.push("DATABASE_URL (PGlite est interdit en production)");
  if (env.databaseUrl.startsWith("pglite://")) problems.push("DATABASE_URL (PGlite est interdit en production)");
  if (env.enableDevLogin) problems.push("ENABLE_DEV_LOGIN doit être absent ou `false`");
  if (env.pushTransport !== "apns") problems.push("PUSH_TRANSPORT doit valoir `apns`");
  if (!env.appleBundleId) problems.push("APPLE_BUNDLE_ID");
  if (!env.appleTeamId) problems.push("APPLE_TEAM_ID");
  if (!env.appleSignInKeyId) problems.push("APPLE_SIGNIN_KEY_ID");
  if (!env.appleSignInPrivateKey) problems.push("APPLE_SIGNIN_PRIVATE_KEY");
  if (!env.appleTokenEncKey) problems.push("APPLE_TOKEN_ENC_KEY");
  if (!env.apnsKeyId) problems.push("APNS_KEY_ID");
  if (!env.apnsPrivateKey) problems.push("APNS_PRIVATE_KEY");
  if (env.e2eAuthRateLimit !== undefined) problems.push("E2E_AUTH_RATE_LIMIT ne doit jamais être défini en production");
  if (problems.length > 0) {
    throw new Error(`Configuration de production invalide : ${problems.join(", ")}`);
  }
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const raw = RawEnvSchema.parse(source);
  const env: Env = {
    appEnv: raw.APP_ENV,
    apiPort: raw.API_PORT,
    databaseUrl: raw.DATABASE_URL,
    enableDevLogin: raw.ENABLE_DEV_LOGIN,
    appleBundleId: raw.APPLE_BUNDLE_ID,
    appleTeamId: raw.APPLE_TEAM_ID,
    appleSignInKeyId: raw.APPLE_SIGNIN_KEY_ID,
    appleSignInPrivateKey: raw.APPLE_SIGNIN_PRIVATE_KEY,
    appleTokenEncKey: raw.APPLE_TOKEN_ENC_KEY,
    pushTransport: raw.PUSH_TRANSPORT,
    apnsKeyId: raw.APNS_KEY_ID,
    apnsPrivateKey: raw.APNS_PRIVATE_KEY,
    trustProxy: raw.TRUST_PROXY,
    e2eAuthRateLimit: raw.E2E_AUTH_RATE_LIMIT,
  };
  assertProductionReady(env);
  return env;
}
