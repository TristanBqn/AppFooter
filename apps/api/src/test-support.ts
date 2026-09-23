// Fabriques réutilisées par les tests d'intégration (PGlite en mémoire, horloge injectable).
import { createDb, type DbHandle } from "@app/db";
import { createApp } from "./app";
import type { Env } from "./env";

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
}

export async function createTestApp(options: { env?: Partial<Env>; now?: () => Date } = {}): Promise<TestApp> {
  const handle = await createDb("");
  await handle.migrate();
  const app = createApp({ db: handle.db, env: testEnv(options.env), now: options.now });
  return { ...handle, app };
}
