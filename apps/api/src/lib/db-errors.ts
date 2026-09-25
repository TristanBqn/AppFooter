// Détection des violations de contrainte unique, indépendante du pilote (`pg` ou PGlite, tous
// deux de vrais Postgres). Drizzle enveloppe l'erreur du pilote dans `DrizzleQueryError` (`.cause`).
const UNIQUE_VIOLATION_SQLSTATE = "23505";

export function isUniqueViolation(err: unknown): boolean {
  const code = (err as { code?: unknown } | undefined)?.code;
  if (code === UNIQUE_VIOLATION_SQLSTATE) return true;
  const cause = (err as { cause?: unknown } | undefined)?.cause;
  return typeof cause === "object" && cause !== null && (cause as { code?: unknown }).code === UNIQUE_VIOLATION_SQLSTATE;
}
