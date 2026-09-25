// Revue visuelle phase 3 : captures des écrans de l'app (aperçu web Expo) et de leurs états.
// Usage (depuis la racine) :
//   1. cd apps/mobile && EXPO_PUBLIC_API_URL=http://localhost:4000 EXPO_PUBLIC_HEALTH_SOURCE=simulated \
//        npx expo export --platform web --output-dir <DIST>
//   2. node docs/design/review/capture-screens.mjs <DIST>
// Démarre l'API (`pnpm --filter @app/api start:e2e`, port 4000, PGlite en mémoire), la peuple,
// capture en viewport iPhone 390 × 844 @3x, puis arrête l'API. Aucun serveur HTTP pour l'app :
// fichiers servis par interception Playwright ; appels API relayés côté Node (pas de CORS en V1).
import { spawn, execSync } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "..", "..", "..");
const dist = resolve(process.argv[2] ?? join(repo, "apps", "mobile", "dist"));
const shots = join(here, "screens");
const API = "http://127.0.0.1:4000";
const ORIGIN = "http://footer.local";
const TZ = "Europe/Paris";
mkdirSync(shots, { recursive: true });

// ---------- API ----------
// Journal de l'API hors du dépôt (diagnostic si elle s'arrête en cours de route).
const apiLogPath = join(tmpdir(), "footer-capture-api.log");
const apiLog = createWriteStream(apiLogPath);
const apiProc = spawn("pnpm --filter @app/api start:e2e", { cwd: repo, shell: true, stdio: ["ignore", "pipe", "pipe"] });
apiProc.stdout.pipe(apiLog);
apiProc.stderr.pipe(apiLog);
apiProc.on("exit", (code) => console.error(`API arrêtée (code ${code}), journal : ${apiLogPath}`));
function stopApi() {
  try {
    if (process.platform === "win32") execSync(`taskkill /pid ${apiProc.pid} /T /F`, { stdio: "ignore" });
    else apiProc.kill("SIGTERM");
  } catch {
    // déjà arrêtée
  }
}
process.on("exit", stopApi);
// Interruption (Ctrl+C) ou erreur hors du try/finally principal : l'API ne doit jamais rester active.
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => process.exit(130));
process.on("uncaughtException", (e) => {
  console.error(e);
  process.exit(1);
});

async function waitApi() {
  for (let i = 0; i < 120; i += 1) {
    try {
      if ((await fetch(`${API}/health`)).ok) return;
    } catch {
      // pas encore prête
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("API injoignable");
}

async function call(method, path, token, body) {
  const res = await fetch(API + path, {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

function localDate(offsetDays = 0) {
  const d = new Date(Date.now() - offsetDays * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** Même calcul que SimulatedHealthSource (apps/mobile) : pas du jour de l'utilisateur de l'app. */
function simulatedSteps(date) {
  let hash = 0;
  for (let i = 0; i < date.length; i += 1) hash = (hash * 31 + date.charCodeAt(i)) >>> 0;
  // Mélange final fmix32 (murmur3), identique à SimulatedHealthSource (m7).
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;
  hash >>>= 0;
  return Math.max(0, Math.round(8500 + (hash / 0xffffffff - 0.5) * 2 * 5000));
}

async function user(key, username, todaySteps) {
  const { session, userId } = await call("POST", "/auth/dev", null, { devUserKey: key });
  await call("PUT", "/me/username", session.token, { username });
  const actor = { token: session.token, userId, username };
  if (todaySteps !== undefined) {
    await call("PUT", "/me/consents/health", actor.token, { granted: true });
    const days = Array.from({ length: 7 }, (_, i) => ({
      date: localDate(i),
      steps: i === 0 ? todaySteps : Math.round(todaySteps * (0.6 + ((i * 37) % 50) / 100)),
      activeCalories: Math.round(todaySteps / 30),
    }));
    await call("PUT", "/me/activity", actor.token, { timeZone: TZ, days });
  }
  return actor;
}

// ---------- Navigateur ----------
const overrides = []; // { method, re, mode: "hang" | "fail" }
const cors = {
  "access-control-allow-origin": ORIGIN,
  "access-control-allow-headers": "authorization, content-type, accept",
  "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
};

function mime(path) {
  return { ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".ico": "image/x-icon", ".ttf": "font/ttf", ".json": "application/json" }[extname(path)] ?? "text/html";
}

const failures = [];
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  locale: "fr-FR",
  timezoneId: TZ,
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();
page.on("pageerror", (e) => failures.push(`pageerror: ${e.message}`));

await page.route(`${ORIGIN}/**`, (route) => {
  const path = decodeURIComponent(new URL(route.request().url()).pathname);
  const file = join(dist, path);
  const target = path !== "/" && existsSync(file) ? file : join(dist, "index.html");
  route.fulfill({ body: readFileSync(target), contentType: mime(target) });
});
await page.route("http://localhost:4000/**", async (route) => {
  const req = route.request();
  if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
  const path = new URL(req.url()).pathname;
  const o = overrides.find((x) => (!x.method || x.method === req.method()) && x.re.test(path));
  if (o?.mode === "hang") return; // jamais résolue : état de chargement
  if (o?.mode === "fail") return route.abort("failed");
  try {
    const res = await route.fetch({ url: req.url().replace("http://localhost:4000", API) });
    return await route.fulfill({ response: res, headers: { ...res.headers(), ...cors } });
  } catch (e) {
    failures.push(`relais API ${req.method()} ${path}: ${e.message.split("\n")[0]}`);
    return route.abort("failed").catch(() => undefined);
  }
});

const wait = (ms) => page.waitForTimeout(ms);
async function shot(name, { tall = false } = {}) {
  await wait(700);
  await page.screenshot({ path: join(shots, `${name}.png`) });
  if (tall) {
    // Hauteur du contenu défilant le plus haut (ScrollView RN web = div à overflow auto).
    const h = await page.evaluate(() => {
      let max = 844;
      for (const el of document.querySelectorAll("div")) {
        const s = getComputedStyle(el);
        if ((s.overflowY === "auto" || s.overflowY === "scroll") && el.clientHeight > 300) {
          max = Math.max(max, el.scrollHeight + (window.innerHeight - el.clientHeight));
        }
      }
      return Math.min(max, 4000);
    });
    if (h > 860) {
      await page.setViewportSize({ width: 390, height: h });
      await wait(500);
      await page.screenshot({ path: join(shots, `${name}-complet.png`) });
      await page.setViewportSize({ width: 390, height: 844 });
      await wait(300);
    }
  }
  console.log("capture", name);
}
async function step(name, fn) {
  try {
    await fn();
  } catch (e) {
    failures.push(`${name}: ${e.message.split("\n")[0]}`);
    console.error("ECHEC", name, e.message.split("\n")[0]);
  }
}
// Les onglets et écrans empilés restent dans le DOM (masqués) : ne viser que le visible.
const btn = (name) =>
  page.getByRole("button", typeof name === "string" ? { name, exact: true } : { name }).filter({ visible: true }).first();
const text = (t) => page.getByText(t, { exact: true }).filter({ visible: true }).first();
async function tab(name) {
  await page.getByRole("tab", { name }).or(page.getByRole("link", { name })).filter({ visible: true }).first().click();
  await wait(800);
}
async function login() {
  overrides.length = 0;
  await page.goto(`${ORIGIN}/`);
  await btn("Passer l'introduction").click({ timeout: 15_000 });
  await btn("DEV — Connexion de développement").click();
  await text(/^Bonjour/).waitFor({ timeout: 15_000 }).catch(() => undefined);
  await wait(1500);
}

try {
  await waitApi();
  const today = localDate(0);
  const mine = simulatedSteps(today);
  // Amis : lea devant, sam.b à égalité avec moi, marc_d et nina derrière.
  const lea = await user("lea", "lea", mine + 1200);
  const sam = await user("samb", "sam.b", mine);
  const marc = await user("marc", "marc_d", Math.max(0, mine - 2330));
  const nina = await user("nina", "nina", Math.max(0, mine - 5400));
  const juju = await user("juju", "juju");
  await user("zoe", "zoe");
  const max = await user("max", "max");

  // ----- 1. Onboarding, connexion, pseudo, consentement -----
  await page.goto(`${ORIGIN}/`);
  await step("onboarding", async () => {
    await btn("Continuer").waitFor({ timeout: 20_000 });
    await shot("01-onboarding-page1");
    await btn("Continuer").click();
    await wait(800);
    await shot("01-onboarding-page2");
    await btn("Continuer").click();
  });
  await step("connexion", async () => {
    await btn("DEV — Connexion de développement").waitFor();
    await shot("02-connexion");
    overrides.push({ method: "POST", re: /^\/auth\/dev$/, mode: "fail" });
    await btn("DEV — Connexion de développement").click();
    await wait(600);
    await shot("02-connexion-erreur");
    overrides.length = 0;
    await wait(2500);
    await btn("DEV — Connexion de développement").click();
  });
  await step("pseudo", async () => {
    const field = page.getByLabel("Pseudo", { exact: true }).first();
    await field.waitFor({ timeout: 15_000 });
    await shot("03-pseudo");
    await field.fill("Lea");
    await shot("03-pseudo-saisie-minuscules");
    await field.fill("lé!");
    await field.press("Enter");
    await shot("03-pseudo-erreur-format");
    await field.fill("lea");
    await btn("C'est parti").click();
    await wait(800);
    await shot("03-pseudo-deja-pris");
    await field.fill("tom");
    await btn("C'est parti").click();
  });
  await step("consentement", async () => {
    await text("Ce que Footer utilise").waitFor({ timeout: 15_000 });
    await shot("04-consentement", { tall: true });
    await page.getByRole("switch").first().click();
    await shot("04-consentement-accord-active");
    await btn("Pas maintenant").click();
    await wait(300);
    await shot("04-consentement-pas-maintenant-toast");
  });

  // ----- 2. Sans consentement, sans ami -----
  await step("accueil sans consentement", async () => {
    await text("Connecte Apple Santé pour voir tes pas").waitFor({ timeout: 15_000 });
    await shot("05-accueil-sans-consentement", { tall: true });
  });
  await step("classement vide", async () => {
    await tab("Classement");
    await wait(1500);
    await shot("06-classement-vide", { tall: true });
  });
  await step("amis vide", async () => {
    await tab("Amis");
    await wait(1500);
    await shot("07-amis-vide", { tall: true });
    const field = page.getByLabel("Pseudo de ton ami").first();
    await field.fill("tom");
    await btn("Ajouter").click();
    await shot("07-amis-erreur-propre-pseudo");
    await field.fill("zoe");
    await btn("Ajouter").click();
    await wait(400);
    await shot("07-amis-demande-envoyee-toast");
  });
  await step("accueil autoriser", async () => {
    await tab("Accueil");
    await btn("Autoriser l'accès").click();
    // B1 : l'action rouvre l'écran de consentement (aucun accord en un toucher).
    await text("Ce que Footer utilise").waitFor({ timeout: 15_000 });
    await shot("05-accueil-autoriser-ouvre-consentement");
    await page.getByRole("switch").filter({ visible: true }).first().click();
    await btn("J'accepte et je continue").click();
    await wait(3000);
    await shot("05-accueil-sans-ami", { tall: true });
  });

  // ----- 3. Données sociales -----
  const tom = await call("POST", "/auth/dev", null, { devUserKey: "dev" });
  const tomActor = { token: tom.session.token, userId: tom.userId, username: "tom" };
  for (const friend of [lea, sam, marc, nina]) {
    await call("POST", "/friend-requests", friend.token, { username: "tom" });
  }
  await call("POST", "/friend-requests", juju.token, { username: "tom" });
  const { incoming } = await call("GET", "/friend-requests", tomActor.token);
  for (const r of incoming.filter((x) => x.from.username !== "juju" && x.from.username !== "nina")) {
    await call("POST", `/friend-requests/${r.id}/accept`, tomActor.token);
  }

  await login();
  await step("amis demandes", async () => {
    await tab("Amis");
    await wait(1500);
    await shot("08-amis-demandes", { tall: true });
    await btn("Accepter la demande de nina").click();
    await wait(400);
    await shot("08-amis-accepte-toast");
  });
  await call("POST", "/encouragements", lea.token, { toUserId: tomActor.userId, messageId: "bravo" });
  await call("POST", "/encouragements", sam.token, { toUserId: tomActor.userId, messageId: "consistency" });

  await login();
  await step("accueil complet", async () => {
    await shot("09-accueil", { tall: true });
  });
  await step("encouragements", async () => {
    await btn(/^Tout voir/).click();
    await wait(1500);
    await shot("10-encouragements-recus");
    await page.goBack();
    await wait(800);
  });
  await step("historique", async () => {
    await btn(/^Tes 30 derniers jours/).click();
    await wait(2000);
    await shot("11-historique", { tall: true });
    await page.goBack();
    await wait(800);
  });
  await step("classement", async () => {
    await tab("Classement");
    await wait(1500);
    await shot("12-classement-jour", { tall: true });
    await page.getByRole("tab", { name: "Cette semaine" }).or(btn("Cette semaine")).first().click();
    await wait(800);
    await shot("12-classement-semaine", { tall: true });
    await page.getByRole("tab", { name: "Aujourd'hui" }).or(btn("Aujourd'hui")).first().click();
  });
  await step("profil ami", async () => {
    await btn(/^1er, lea,/).click();
    await wait(2000);
    await shot("13-profil-ami", { tall: true });
    await btn("Envoyer à lea : Bravo pour ta marche !").click();
    await wait(500);
    await shot("13-profil-ami-encouragement-envoye", { tall: true });
    await btn("Retirer de mes amis").click();
    await wait(800);
    await shot("13-profil-ami-confirmer-retrait");
    await btn("Annuler").click();
    await wait(600);
    await btn("Bloquer lea").click();
    await wait(800);
    await shot("13-profil-ami-confirmer-blocage");
    await btn("Annuler").click();
    await wait(600);
  });
  await step("amis liste", async () => {
    await tab("Amis");
    await wait(1200);
    await shot("14-amis-liste", { tall: true });
  });

  // ----- 4. Paramètres -----
  await call("POST", "/blocks", tomActor.token, { userId: max.userId });
  await login();
  await step("parametres", async () => {
    await btn("Paramètres").click();
    await wait(2000);
    await shot("15-parametres", { tall: true });
    await btn(/^Comptes bloqués/).click();
    await wait(1500);
    await shot("16-comptes-bloques");
    await btn("Débloquer max").click();
    await wait(1200);
    await shot("16-comptes-bloques-vide-toast");
    await page.goBack();
    await wait(800);
    await btn("Supprimer mon compte").click();
    await wait(1200);
    await shot("17-supprimer-compte");
    await btn("Supprimer mon compte").click();
    await wait(800);
    await shot("17-supprimer-compte-confirmation");
    overrides.push({ method: "DELETE", re: /^\/me$/, mode: "fail" });
    await btn("Supprimer définitivement").click();
    await wait(800);
    await shot("17-supprimer-compte-erreur-toast");
    overrides.length = 0;
  });

  // ----- 5. États de chargement et d'erreur -----
  const loadingCases = [
    ["18-accueil-chargement", /^\/me\/today$/, null],
    ["19-classement-chargement", /^\/leaderboards\//, "Classement"],
    ["20-amis-chargement", /^\/friends$|^\/friend-requests$/, "Amis"],
  ];
  for (const [name, re, tabName] of loadingCases) {
    await step(name, async () => {
      await login();
      overrides.push({ method: "GET", re, mode: "hang" });
      // Invalide le cache TanStack Query (staleTime 30 s) : rechargement complet de la page.
      // La session est conservée : l'app rouvre directement l'Accueil.
      await page.reload();
      await wait(2500);
      if (tabName) await tab(tabName);
      await wait(1200);
      await shot(name);
    });
  }
  const errorCases = [
    ["18-accueil-erreur", /^\/me\/today$/, null],
    ["18-accueil-erreur-synchro", /^\/me\/activity$/, null, "PUT"],
    ["19-classement-erreur", /^\/leaderboards\//, "Classement"],
    ["20-amis-erreur", /^\/friends$|^\/friend-requests$/, "Amis"],
  ];
  for (const [name, re, tabName, method] of errorCases) {
    await step(name, async () => {
      await page.goto(`${ORIGIN}/`);
      overrides.length = 0;
      overrides.push({ method: method ?? "GET", re, mode: "fail" });
      await btn("Passer l'introduction").click({ timeout: 15_000 });
      await btn("DEV — Connexion de développement").click();
      await wait(1500);
      if (tabName) await tab(tabName);
      await wait(6000);
      await shot(name);
    });
  }
  await step("historique erreur", async () => {
    await login();
    overrides.push({ method: "GET", re: /^\/me\/activity$/, mode: "fail" });
    await btn(/^Tes 30 derniers jours/).click();
    await wait(6000);
    await shot("21-historique-erreur");
    overrides.length = 0;
  });
  await step("profil ami erreur", async () => {
    await login();
    overrides.push({ method: "GET", re: /\/activity$/, mode: "fail" });
    await tab("Amis");
    await wait(1200);
    await btn(/^sam\.b/).click();
    await wait(6000);
    await shot("22-profil-ami-erreur");
    overrides.length = 0;
  });
  await step("profil ami chargement", async () => {
    await login();
    overrides.push({ method: "GET", re: /^\/friends\/[^/]+\/activity$/, mode: "hang" });
    await tab("Amis");
    await wait(1200);
    await btn(/^marc_d/).click();
    await wait(1500);
    await shot("22-profil-ami-chargement");
    overrides.length = 0;
  });
} finally {
  await browser.close();
  stopApi();
  if (failures.length) console.error("Anomalies :\n" + failures.join("\n"));
  console.log(`Captures dans ${shots}`);
}
