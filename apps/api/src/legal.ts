// Résolution du texte source de la politique de confidentialité (`docs/legal/privacy.md`,
// propriété du lead, lecture seule pour le backend). Fichier volontairement placé à la racine de
// `src/` (et non dans `modules/privacy/`) : après le bundle esbuild (`apps/api/dist/server.js`),
// `import.meta.url` redevient celui du fichier de sortie ; `src/` et `dist/` étant tous deux à un
// niveau de `apps/api/`, le même chemin relatif reste valide en développement comme en
// production (même principe que `MIGRATIONS_FOLDER` dans `packages/db/src/client.ts`).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const PRIVACY_MD_PATH = fileURLToPath(new URL("../../../docs/legal/privacy.md", import.meta.url));

export function loadPrivacyMarkdown(): string {
  return readFileSync(PRIVACY_MD_PATH, "utf8");
}
