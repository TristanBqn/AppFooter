// Bundle unique dist/server.js : inclut @app/contracts et @app/db (source TS, pas de dist
// propre à ces paquets) ; laisse en dehors les vraies dépendances npm, résolues à l'exécution
// via node_modules (pnpm en mode hoisted, cf. .npmrc).
import { build } from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";

await rm("dist", { recursive: true, force: true });
await rm("drizzle", { recursive: true, force: true });
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

// `@app/db` résout son dossier de migrations en `../drizzle` relativement à son propre
// fichier ; une fois ce code inliné dans dist/server.js, ce chemin devient `apps/api/drizzle`
// (un niveau au-dessus de dist/). On y copie donc les migrations pour que ça reste valide.
await cp("../../packages/db/drizzle", "drizzle", { recursive: true });
