import { describe, expect, it } from "vitest";
import { loadEnv } from "./env";

const validProduction = {
  APP_ENV: "production",
  DATABASE_URL: "postgres://user:pass@host:5432/footer",
  ENABLE_DEV_LOGIN: "false",
  PUSH_TRANSPORT: "apns",
  APPLE_BUNDLE_ID: "com.footer.app",
  APPLE_TEAM_ID: "TEAM123",
  APPLE_SIGNIN_KEY_ID: "KEY123",
  APPLE_SIGNIN_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----",
  APPLE_TOKEN_ENC_KEY: "base64key",
  APNS_KEY_ID: "APNSKEY",
  APNS_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----",
} satisfies NodeJS.ProcessEnv;

describe("loadEnv", () => {
  it("valeurs par défaut en développement (PGlite mémoire, transport console)", () => {
    const env = loadEnv({});
    expect(env.appEnv).toBe("development");
    expect(env.apiPort).toBe(4000);
    expect(env.databaseUrl).toBe("");
    expect(env.enableDevLogin).toBe(false);
    expect(env.pushTransport).toBe("console");
  });

  it("APP_ENV=production sans configuration ⇒ échec listant tout ce qui manque", () => {
    expect(() => loadEnv({ APP_ENV: "production" })).toThrowError(/DATABASE_URL/);
  });

  it("production avec DATABASE_URL vide ou pglite:// ⇒ échec (PGlite interdit)", () => {
    expect(() => loadEnv({ ...validProduction, DATABASE_URL: "" })).toThrow();
    expect(() => loadEnv({ ...validProduction, DATABASE_URL: "pglite://./data" })).toThrow();
  });

  it("production avec ENABLE_DEV_LOGIN=true ⇒ échec", () => {
    expect(() => loadEnv({ ...validProduction, ENABLE_DEV_LOGIN: "true" })).toThrowError(/ENABLE_DEV_LOGIN/);
  });

  it("production avec PUSH_TRANSPORT=console ⇒ échec", () => {
    expect(() => loadEnv({ ...validProduction, PUSH_TRANSPORT: "console" })).toThrowError(/PUSH_TRANSPORT/);
  });

  it("production avec toutes les variables requises ⇒ chargement réussi", () => {
    const env = loadEnv(validProduction);
    expect(env.appEnv).toBe("production");
    expect(env.pushTransport).toBe("apns");
    expect(env.e2eAuthRateLimit).toBeUndefined();
  });

  it("production avec E2E_AUTH_RATE_LIMIT défini ⇒ échec (réservé à start:e2e)", () => {
    expect(() => loadEnv({ ...validProduction, E2E_AUTH_RATE_LIMIT: "1000" })).toThrowError(/E2E_AUTH_RATE_LIMIT/);
  });

  it("hors production, E2E_AUTH_RATE_LIMIT est accepté et converti en nombre", () => {
    const env = loadEnv({ E2E_AUTH_RATE_LIMIT: "1000" });
    expect(env.e2eAuthRateLimit).toBe(1000);
  });
});
