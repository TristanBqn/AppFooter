// Config Playwright API (reviewer, R1). Pas de navigateur : tests via `request` uniquement,
// contre l'API réelle démarrée sur le port fixe 4000 (CLAUDE.md), base PGlite en mémoire.
// Un seul worker : la base est partagée par tout le run (pas de route de remise à zéro), les
// tests doivent donc utiliser des identifiants uniques (voir tests/e2e/support/api.ts).
import { defineConfig } from "@playwright/test";

const PORT = 4000;
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL,
    extraHTTPHeaders: { "content-type": "application/json" },
  },
  webServer: {
    command: "pnpm --filter @app/api start:e2e",
    url: `${baseURL}/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
