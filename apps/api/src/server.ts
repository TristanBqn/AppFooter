// Point d'entrée process : charge l'environnement, ouvre la base, démarre le serveur HTTP.
// Utilisé par `start` (build esbuild) et `start:e2e` (exécuté directement via tsx).
import { serve } from "@hono/node-server";
import { createDb } from "@app/db";
import { createApp } from "./app";
import { loadEnv } from "./env";
import { createPushTransport } from "./modules/notifications/factory";
import { flushDueNotifications } from "./modules/notifications/service";

const FLUSH_INTERVAL_MS = 60_000;

const env = loadEnv();
const { db, migrate, close } = await createDb(env.databaseUrl);
await migrate();
const pushTransport = createPushTransport(env);
const app = createApp({ db, env, pushTransport });

const server = serve({ fetch: app.fetch, port: env.apiPort }, (info) => {
  console.log(JSON.stringify({ level: "info", message: "api_started", port: info.port, appEnv: env.appEnv }));
});

// Vidage périodique des notifications retenues (heures silencieuses, ADR 004) ; désactivé en test
// (les tests appellent `flushDueNotifications` directement avec une horloge injectée).
const flushInterval =
  env.appEnv === "test"
    ? undefined
    : setInterval(() => {
        flushDueNotifications(db, pushTransport, new Date()).catch((err: unknown) => {
          console.error(JSON.stringify({ level: "error", message: "flush_notifications_failed", error: String(err) }));
        });
      }, FLUSH_INTERVAL_MS);

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(JSON.stringify({ level: "info", message: "api_shutdown", signal }));
  if (flushInterval) clearInterval(flushInterval);
  server.close();
  await close();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
