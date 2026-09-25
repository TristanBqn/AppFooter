// Fabriques réutilisées par les tests d'intégration (PGlite en mémoire, horloge injectable).
import { createDb, type DbHandle } from "@app/db";
import { createApp } from "./app";
import type { Env } from "./env";
import type { AppleIdentityVerifier } from "./modules/auth/apple/identity-verifier";
import type { AppleTokenClient } from "./modules/auth/apple/token-client";
import { ConsoleTransport } from "./modules/notifications/console-transport";
import type { PushTransport } from "./modules/notifications/transport";

export function testEnv(overrides: Partial<Env> = {}): Env {
  return {
    appEnv: "test",
    apiPort: 4000,
    databaseUrl: "",
    enableDevLogin: true,
    appleBundleId: undefined,
    appleTeamId: undefined,
    appleSignInKeyId: undefined,
    appleSignInPrivateKey: undefined,
    appleTokenEncKey: undefined,
    pushTransport: "console",
    apnsKeyId: undefined,
    apnsPrivateKey: undefined,
    trustProxy: false,
    ...overrides,
  };
}

export interface TestApp extends DbHandle {
  app: ReturnType<typeof createApp>;
  /** `ConsoleTransport` par défaut (boîte d'envoi inspectable), sauf transport fourni en option. */
  pushTransport: PushTransport;
}

export interface CreateTestAppOptions {
  env?: Partial<Env>;
  now?: () => Date;
  appleIdentityVerifier?: AppleIdentityVerifier;
  appleTokenClient?: AppleTokenClient;
  pushTransport?: PushTransport;
  maxFriends?: number;
}

export async function createTestApp(options: CreateTestAppOptions = {}): Promise<TestApp> {
  const handle = await createDb("");
  await handle.migrate();
  const pushTransport = options.pushTransport ?? new ConsoleTransport();
  const app = createApp({
    db: handle.db,
    env: testEnv(options.env),
    now: options.now,
    appleIdentityVerifier: options.appleIdentityVerifier,
    appleTokenClient: options.appleTokenClient,
    pushTransport,
    maxFriends: options.maxFriends,
  });
  return { ...handle, app, pushTransport };
}
