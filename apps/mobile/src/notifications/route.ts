// Routage au toucher d'une notification (M10, CA10). Aucune destination n'est spécifiée par
// screens.md pour les push (hors périmètre du design des écrans) : choix pragmatique, chaque type
// ouvre l'écran le plus pertinent pour agir dessus.
import { PushPayloadSchema, type PushPayload } from "@app/contracts";

export type PushRoute = { pathname: string; params?: Record<string, string> };

export function resolvePushRoute(payload: PushPayload): PushRoute {
  switch (payload.type) {
    case "milestone_self":
      return { pathname: "/(tabs)/accueil" };
    case "encouragement_received":
      return { pathname: "/(tabs)/accueil" };
    case "friend_request_received":
      return { pathname: "/(tabs)/amis" };
    case "milestone_friend":
    case "friend_request_accepted":
      return {
        pathname: "/(tabs)/amis/[userId]",
        params: { userId: payload.fromUserId, username: payload.fromUsername },
      };
  }
}

/** `data` = contenu personnalisé de la notification reçue (clé `footer` à côté de `aps`, voir @app/contracts). */
export function parsePushPayload(data: unknown): PushPayload | null {
  if (!data || typeof data !== "object" || !("footer" in data)) return null;
  const parsed = PushPayloadSchema.safeParse((data as { footer: unknown }).footer);
  return parsed.success ? parsed.data : null;
}
