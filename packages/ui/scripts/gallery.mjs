// Galerie web des composants @app/ui (react-native-web) + captures Playwright.
// Usage : pnpm --filter @app/ui gallery  -> dist/gallery/ puis docs/design/review/gallery-*.png
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import { chromium } from "@playwright/test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "dist", "gallery");
const shotsDir = resolve(root, "..", "..", "docs", "design", "review");

mkdirSync(outDir, { recursive: true });
writeFileSync(
  join(root, "gallery.html"),
  `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Galerie @app/ui</title>
<style>html,body,#root{height:100%;margin:0}#root{display:flex}</style></head>
<body><div id="root"></div><script type="module" src="/src/__tests__/gallery-entry.tsx"></script></body></html>`,
);

await build({
  root,
  configFile: join(root, "vitest.config.ts"),
  base: "./",
  logLevel: "error",
  define: { __DEV__: "false", "process.env.NODE_ENV": JSON.stringify("production"), global: "globalThis" },
  build: { outDir, emptyOutDir: true, rollupOptions: { input: join(root, "gallery.html") } },
});

rmSync(join(root, "gallery.html"));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
// Fichiers servis par interception Playwright (pas de serveur HTTP, les modules ES refusent file://).
const origin = "http://gallery.local";
await page.route(`${origin}/**`, (route) => {
  const path = new URL(route.request().url()).pathname;
  const type = path.endsWith(".js") ? "text/javascript" : path.endsWith(".css") ? "text/css" : "text/html";
  route.fulfill({ body: readFileSync(join(outDir, decodeURIComponent(path))), contentType: type });
});
const url = `${origin}/gallery.html`;
mkdirSync(shotsDir, { recursive: true });
for (const [name, query, reduced] of [["gallery", "", false], ["gallery-sheet", "?sheet=1", false], ["gallery-reduced-motion", "", true]]) {
  await page.emulateMedia({ reducedMotion: reduced ? "reduce" : "no-preference" });
  await page.goto(url + query);
  await page.waitForTimeout(800);
  if (query) {
    await page.screenshot({ path: join(shotsDir, `${name}.png`) });
  } else {
    // Capture pleine hauteur : la fenêtre est agrandie à la hauteur du contenu défilant.
    const height = await page.evaluate(() => document.querySelector("[data-testid=gallery-scroll]")?.scrollHeight ?? 844);
    await page.setViewportSize({ width: 390, height });
    await page.waitForTimeout(300);
    await page.screenshot({ path: join(shotsDir, `${name}.png`) });
    await page.setViewportSize({ width: 390, height: 844 });
  }
}
await browser.close();
if (errors.length) {
  console.error("Erreurs navigateur :\n" + errors.join("\n"));
  process.exit(1);
}
console.log(`Captures écrites dans ${shotsDir}`);
