// Mappage ErrorCode (contrat) -> message FR affichable, et erreur unifiée du client API.
// Ton DESIGN.md §5 : tutoiement, jamais culpabilisant. Les écrans peuvent composer un texte plus
// spécifique ; ce mapping est le filet de sécurité générique.
import { ApiErrorSchema, type ErrorCode } from "@app/contracts";

export const ERROR_MESSAGES_FR: Record<ErrorCode, string> = {
  VALIDATION_ERROR: "Certaines informations ne sont pas valides.",
  UNAUTHENTICATED: "Ta session a expiré. Reconnecte-toi.",
  APPLE_TOKEN_INVALID: "La connexion avec Apple n'a pas abouti. Réessaie.",
  USERNAME_REQUIRED: "Choisis d'abord ton pseudo.",
  HEALTH_CONSENT_REQUIRED: "Autorise d'abord l'accès à tes données de santé.",
  NOT_FOUND: "Introuvable.",
  USERNAME_TAKEN: "Ce pseudo est déjà pris.",
  USERNAME_ALREADY_SET: "Ton pseudo est déjà choisi.",
  TARGET_BLOCKED: "Cette action n'est pas possible.",
  FRIEND_LIMIT_REACHED: "Tu as atteint le nombre maximum d'amis.",
  CANNOT_TARGET_SELF: "Cette action n'est pas possible sur toi-même.",
  DATE_OUT_OF_RANGE: "Cette période n'est pas disponible.",
  ENCOURAGEMENT_LIMIT: "Envoyé aujourd'hui. Tu pourras l'encourager à nouveau demain.",
  RATE_LIMITED: "Trop de tentatives. Réessaie dans un instant.",
  INTERNAL_ERROR: "Petit nuage sur la connexion. Réessaie dans un instant.",
  UPSTREAM_UNAVAILABLE: "Service momentanément indisponible. Réessaie dans un instant.",
};

export const NETWORK_ERROR_MESSAGE_FR = "Vérifie ta connexion puis réessaie.";
export const TIMEOUT_ERROR_MESSAGE_FR = "La connexion prend trop de temps. Réessaie.";
export const UNEXPECTED_RESPONSE_MESSAGE_FR = "Réponse inattendue du serveur. Réessaie dans un instant.";

export type ApiClientErrorKind = "http" | "network" | "timeout" | "parse";

export type ApiClientErrorParams = {
  kind: ApiClientErrorKind;
  /** Message technique (journaux), jamais affiché tel quel. */
  message: string;
  /** Message FR prêt à afficher à l'utilisateur. */
  userMessage: string;
  status?: number;
  code?: ErrorCode;
  issues?: readonly { path: string; message: string }[];
};

/** Erreur unique levée par le client API : réseau, délai dépassé, réponse HTTP ou réponse invalide. */
export class ApiClientError extends Error {
  readonly kind: ApiClientErrorKind;
  readonly status?: number;
  readonly code?: ErrorCode;
  readonly issues?: readonly { path: string; message: string }[];
  readonly userMessage: string;

  constructor(params: ApiClientErrorParams) {
    super(params.message);
    this.name = "ApiClientError";
    this.kind = params.kind;
    this.status = params.status;
    this.code = params.code;
    this.issues = params.issues;
    this.userMessage = params.userMessage;
  }
}

/** Construit une `ApiClientError` à partir d'une réponse HTTP non-2xx (enveloppe du contrat). */
export async function apiClientErrorFromResponse(response: Response): Promise<ApiClientError> {
  const status = response.status;
  let raw: unknown;
  try {
    raw = await response.json();
  } catch {
    return new ApiClientError({
      kind: "parse",
      message: `Réponse d'erreur illisible (statut ${status})`,
      userMessage: UNEXPECTED_RESPONSE_MESSAGE_FR,
      status,
    });
  }
  const parsed = ApiErrorSchema.safeParse(raw);
  if (!parsed.success) {
    return new ApiClientError({
      kind: "parse",
      message: `Enveloppe d'erreur invalide (statut ${status})`,
      userMessage: UNEXPECTED_RESPONSE_MESSAGE_FR,
      status,
    });
  }
  const { code, message, issues } = parsed.data.error;
  return new ApiClientError({
    kind: "http",
    message,
    userMessage: ERROR_MESSAGES_FR[code],
    status,
    code,
    issues,
  });
}
