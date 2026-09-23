// Validation Zod à la frontière HTTP : tout échec devient une AppError VALIDATION_ERROR (400),
// jamais une exception non gérée (docs/architecture.md §3).
import type { Context } from "hono";
import type { z } from "zod";
import { AppError, type AppErrorIssue } from "../errors";

function toIssues(error: z.ZodError): AppErrorIssue[] {
  return error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }));
}

export function parseWith<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new AppError("VALIDATION_ERROR", "Requête invalide", toIssues(result.error));
  }
  return result.data;
}

/** Lit et valide le corps JSON d'une requête. Un JSON malformé est aussi une VALIDATION_ERROR. */
export async function parseJsonBody<T extends z.ZodTypeAny>(c: Context, schema: T): Promise<z.infer<T>> {
  let data: unknown;
  try {
    data = await c.req.json();
  } catch {
    throw new AppError("VALIDATION_ERROR", "Corps de requête JSON invalide");
  }
  return parseWith(schema, data);
}

/** Valide les paramètres de requête (`?a=b`) après conversion en objet simple. */
export function parseQuery<T extends z.ZodTypeAny>(c: Context, schema: T): z.infer<T> {
  return parseWith(schema, c.req.query());
}
