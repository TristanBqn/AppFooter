// Bundle unique dist/server.js : inclut @app/contracts et @app/db (source TS, pas de dist
// propre à ces paquets) ; laisse en dehors les vraies dépendances npm, résolues à l'exécution
// via node_modules (pnpm en mode hoisted, cf. .npmrc).
import { build } from "esbuild";
import { mkdir, rm } from "node:fs/promises";

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });

await build({
  entryPoints: ["src/server.ts"],
  outfile: "dist/server.js",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  sourcemap: true,
  logLevel: "info",
  external: ["hono", "@hono/node-server", "drizzle-orm", "pg", "@electric-sql/pglite", "zod"],
});
