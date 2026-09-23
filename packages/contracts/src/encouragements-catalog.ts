// Catalogue fermé des encouragements (F10). Aucun texte libre n'est accepté par l'API (CA9).
import { z } from "zod";

export const ENCOURAGEMENT_CATALOG = [
  { id: "bravo", text: "Bravo pour ta marche !" },
  { id: "one_more_lap", text: "Allez, encore un petit tour !" },
  { id: "nice_day", text: "Belle journée pour marcher" },
  { id: "inspiring", text: "Tu m'inspires !" },
  { id: "walk_tomorrow", text: "On marche ensemble demain ?" },
  { id: "consistency", text: "Quelle régularité !" },
] as const;

export type EncouragementMessageId = (typeof ENCOURAGEMENT_CATALOG)[number]["id"];

export const ENCOURAGEMENT_MESSAGE_IDS = ENCOURAGEMENT_CATALOG.map((m) => m.id) as [
  EncouragementMessageId,
  ...EncouragementMessageId[],
];

export const EncouragementMessageIdSchema = z.enum(ENCOURAGEMENT_MESSAGE_IDS);
