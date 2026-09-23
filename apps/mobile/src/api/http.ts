// Client HTTP bas niveau : authentification (Bearer), délai + nouvelles tentatives (voir
// queryClient.ts pour les lectures), validation des réponses par les schémas du contrat.
// Aucune action n'échoue silencieusement : toute erreur devient une ApiClientError typée.
import type { ZodType } from "zod";
import { API_BASE_URL } from "./env";
import { getToken, clearSession } from "./session";
import { emitUnauthorized } from "./authEvents";
import {
  ApiClientError,
  apiClientErrorFromResponse,
  NETWORK_ERROR_MESSAGE_FR,
  TIMEOUT_ERROR_MESSAGE_FR,
  UNEXPECTED_RESPONSE_MESSAGE_FR,
} from "./errors";

const DEFAULT_TIMEOUT_MS = 10_000;

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type QueryParams = Record<string, string | number | boolean | undefined>;

export type ApiRequestOptions<TResponse> = {
  method: HttpMethod;
  /** Chemin déjà résolu (paramètres substitués), ex. "/friends/1234/activity". */
  path: string;
  /** Envoie le jeton de session s'il existe. Défaut : true. */
  auth?: boolean;
  query?: QueryParams;
  /** Sérialisé en JSON si présent. */
  body?: unknown;
  /** Schéma du contrat validant la réponse ; omis pour les réponses 204 sans corps. */
  responseSchema?: ZodType<TResponse>;
  timeoutMs?: number;
};

function buildUrl(path: string, query?: QueryParams): string {
  const url = new URL(path, `${API_BASE_URL}/`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

/** Requête authentifiée validée par le contrat. `TResponse` vaut `void` pour les réponses 204. */
export async function apiRequest<TResponse = void>(options: ApiRequestOptions<TResponse>): Promise<TResponse> {
  const { method, path, auth = true, query, body, responseSchema, timeoutMs = DEFAULT_TIMEOUT_MS } = options;

  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = await getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (cause) {
    if (controller.signal.aborted) {
      throw new ApiClientError({
        kind: "timeout",
        message: `Délai dépassé (${timeoutMs}ms) : ${method} ${path}`,
        userMessage: TIMEOUT_ERROR_MESSAGE_FR,
      });
    }
    throw new ApiClientError({
      kind: "network",
      message: cause instanceof Error ? cause.message : `Erreur réseau : ${method} ${path}`,
      userMessage: NETWORK_ERROR_MESSAGE_FR,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const error = await apiClientErrorFromResponse(response);
    if (response.status === 401 && auth) {
      await clearSession();
      emitUnauthorized();
    }
    throw error;
  }

  if (response.status === 204 || !responseSchema) {
    return undefined as TResponse;
  }

  let raw: unknown;
  try {
    raw = await response.json();
  } catch {
    throw new ApiClientError({
      kind: "parse",
      message: `Réponse illisible : ${method} ${path}`,
      userMessage: UNEXPECTED_RESPONSE_MESSAGE_FR,
      status: response.status,
    });
  }

  const parsed = responseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ApiClientError({
      kind: "parse",
      message: `Réponse invalide (${method} ${path}) : ${parsed.error.message}`,
      userMessage: UNEXPECTED_RESPONSE_MESSAGE_FR,
      status: response.status,
    });
  }
  return parsed.data;
}
