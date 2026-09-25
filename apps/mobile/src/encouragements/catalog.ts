// Lecture du catalogue fermé (M8, CA9) : aucun texte libre, tout vient de @app/contracts.
import { ENCOURAGEMENT_CATALOG, type EncouragementMessageId } from "@app/contracts";

const TEXT_BY_ID = new Map(ENCOURAGEMENT_CATALOG.map((message) => [message.id, message.text]));

export function encouragementText(id: EncouragementMessageId): string {
  return TEXT_BY_ID.get(id) ?? "";
}
