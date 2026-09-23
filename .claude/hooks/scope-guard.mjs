// PreToolUse (Write|Edit|NotebookEdit) : bloque l'écriture d'un agent hors de son périmètre (.claude/ownership.json).
// Fail-open : session principale (lead), agent inconnu ou erreur de lecture => autorisé.
import { readFileSync } from "node:fs";
import path from "node:path";

const input = JSON.parse(readFileSync(0, "utf8") || "{}");
const agent = input.agent_type;
const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
let map;
try { map = JSON.parse(readFileSync(path.join(root, ".claude", "ownership.json"), "utf8")); } catch { process.exit(0); }
if (!agent || !Array.isArray(map[agent])) process.exit(0);

const target = input.tool_input?.file_path || input.tool_input?.notebook_path;
if (!target) process.exit(0);
const rel = path.relative(root, path.resolve(root, target)).split(path.sep).join("/");
if (rel.startsWith("..")) process.exit(0); // hors projet (scratchpad, etc.) : non concerné

const allowed = map[agent].some((p) => (p.endsWith("/") ? rel.startsWith(p) : rel === p));
if (allowed) process.exit(0);

process.stderr.write(
  `Écriture refusée : "${rel}" est hors du périmètre de ${agent} (${map[agent].join(", ")}). ` +
  `Envoie un message au propriétaire du fichier ou au lead (SendMessage) avec la modification souhaitée.`
);
process.exit(2);
