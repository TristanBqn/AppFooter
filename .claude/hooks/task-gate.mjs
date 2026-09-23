// TaskCompleted : refuse la complétion si typecheck/tests du périmètre du propriétaire échouent.
// Propriétaire lu dans le préfixe du sujet de tâche : "[backend] …". Sans préfixe connu => pas de contrôle.
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const input = JSON.parse(readFileSync(0, "utf8") || "{}");
const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
const owner = /^\s*\[([\w-]+)\]/.exec(input.task_subject || "")?.[1]?.toLowerCase();

const scopes = {
  architect: ["packages/contracts"],
  designer: ["packages/ui"],
  backend: ["apps/api", "packages/db", "packages/contracts"],
  frontend: ["apps/web"],
  mobile: ["apps/mobile"],
};
if (!owner || !scopes[owner]) process.exit(0);
if (!existsSync(path.join(root, "node_modules"))) process.exit(0); // projet pas encore installé

const dirs = scopes[owner].filter((d) => existsSync(path.join(root, d, "package.json")));
if (dirs.length === 0) process.exit(0);

const args = ["turbo", "run", "typecheck", "test", "--output-logs=errors-only", ...dirs.map((d) => `--filter=./${d}`)];
const r = spawnSync("pnpm", args, { cwd: root, encoding: "utf8", shell: true });
if (r.status === 0) process.exit(0);

const out = `${r.stdout || ""}\n${r.stderr || ""}`.trim().split("\n").slice(-60).join("\n");
process.stderr.write(
  `Tâche non validée : typecheck/tests en échec sur ${dirs.join(", ")}.\n${out}\n\n` +
  `Corrige puis marque la tâche terminée à nouveau. Si l'échec vient d'un autre périmètre, préviens son propriétaire et le lead.`
);
process.exit(2);
