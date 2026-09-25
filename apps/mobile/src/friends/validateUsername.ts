// Vérifications locales avant l'envoi d'une demande d'ami (M7, CA7, screens.md §6) : uniquement
// des règles déjà connues côté app (format, doublons), sans appel réseau, pour ne jamais permettre
// l'énumération de pseudos par tâtonnement (le serveur répond toujours 202 neutre, ADR 005).
import { USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH, USERNAME_PATTERN } from "@app/contracts";

export const FRIEND_USERNAME_FORMAT_ERROR = "Utilise seulement des lettres minuscules, des chiffres, _ ou . (3 à 20).";

export function isValidUsernameFormat(value: string): boolean {
  return value.length >= USERNAME_MIN_LENGTH && value.length <= USERNAME_MAX_LENGTH && USERNAME_PATTERN.test(value);
}

export type FriendUsernameCheckParams = {
  username: string;
  myUsername: string | null;
  friendUsernames: readonly string[];
  outgoingUsernames: readonly string[];
};

/** `null` si rien à signaler avant l'envoi. */
export function validateFriendUsernameLocally({
  username,
  myUsername,
  friendUsernames,
  outgoingUsernames,
}: FriendUsernameCheckParams): string | null {
  if (!isValidUsernameFormat(username)) return FRIEND_USERNAME_FORMAT_ERROR;
  if (myUsername !== null && username === myUsername) return "C'est ton propre pseudo.";
  if (friendUsernames.includes(username)) return `${username} fait déjà partie de tes amis.`;
  if (outgoingUsernames.includes(username)) return `Ta demande à ${username} est déjà en attente.`;
  return null;
}
