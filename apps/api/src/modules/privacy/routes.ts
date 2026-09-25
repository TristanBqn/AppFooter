// GET /privacy (ADR 006) : politique de confidentialité, HTML statique généré depuis
// `docs/legal/privacy.md` (texte fourni par le lead, lecture seule) au premier appel puis mis en
// cache pour le reste du processus — pas de nouvelle lecture disque à chaque requête publique.
import { loadPrivacyMarkdown } from "../../legal";
import type { AppDeps, AppHono } from "../../context";
import { renderPrivacyHtml } from "./markdown-to-html";

let cachedHtml: string | undefined;

function privacyPageHtml(): string {
  if (cachedHtml === undefined) {
    cachedHtml = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Politique de confidentialité de Footer</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 40rem; margin: 2rem auto; padding: 0 1rem; line-height: 1.5; color: #1a1a1a; }
  h1, h2 { line-height: 1.25; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #ccc; padding: 0.5rem; text-align: left; }
  blockquote { border-left: 3px solid #ccc; margin: 0; padding-left: 1rem; color: #555; }
</style>
</head>
<body>
${renderPrivacyHtml(loadPrivacyMarkdown())}
</body>
</html>
`;
  }
  return cachedHtml;
}

export function registerPrivacyRoutes(app: AppHono, _deps: AppDeps): void {
  app.get("/privacy", (c) => c.html(privacyPageHtml()));
}
