// Point d'entrée process : charge l'environnement, ouvre la base, démarre le serveur HTTP.
// Utilisé par `start` (build esbuild) et `start:e2e` (exécuté directement via tsx).
import { serve } from "@hono/node-server";
import { createDb } from "@app/db";
import { createApp } from "./app";
import { loadEnv } from "./env";

const env = loadEnv();
const { db, migrate, close } = await createDb(env.databaseUrl);
await migrate();
const app = createApp({ db });

const server = serve({ fetch: app.fetch, port: env.apiPort }, (info) => {
  console.log(JSON.stringify({ level: "info", message: "api_started", port: info.port, appEnv: env.appEnv }));
});

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(JSON.stringify({ level: "info", message: "api_shutdown", signal }));
  server.close();
  await close();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
