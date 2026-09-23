// Catalogue fermé des encouragements (F10). Aucun texte libre n'est accepté par l'API (CA9).
import { z } from "zod";

export const ENCOURAGEMENT_CATALOG = [
  { id: "bravo", text: "Bravo pour tes pas du jour !" },
  { id: "keep_going", text: "Continue comme ça, tu avances bien !" },
  { id: "almost_there", text: "Encore un petit effort, tu y es presque !" },
  { id: "walk_together", text: "Et si on allait marcher ensemble ?" },
  { id: "hats_off", text: "Chapeau pour ta journée !" },
  { id: "nice_walk", text: "Belle balade à toi !" },
] as const;

export type EncouragementMessageId = (typeof ENCOURAGEMENT_CATALOG)[number]["id"];

export const ENCOURAGEMENT_MESSAGE_IDS = ENCOURAGEMENT_CATALOG.map((m) => m.id) as [
  EncouragementMessageId,
  ...EncouragementMessageId[],
];

export const EncouragementMessageIdSchema = z.enum(ENCOURAGEMENT_MESSAGE_IDS);
