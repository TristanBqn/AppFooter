// Constantes métier partagées api / mobile. Valeurs V1 (voir docs/brief.md et docs/adr/).

/** Seuils de pas déclenchant une notification (F11). Ordre croissant. */
export const STEP_MILESTONES = [5_000, 10_000, 15_000] as const;
export type StepMilestone = (typeof STEP_MILESTONES)[number];

/** Pseudonyme (CA2) : 3–20 caractères [a-z0-9_.], comparé en minuscules. */
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 20;
export const USERNAME_PATTERN = /^[a-z0-9_.]+$/;

/** Synchronisation (F2, F13). */
export const SYNC_MAX_DAYS = 31;
export const INITIAL_BACKFILL_DAYS = 30;
export const HISTORY_MAX_DAYS = 30;
export const FRIEND_HISTORY_DAYS = 7;
export const MAX_DAILY_STEPS = 200_000;
export const MAX_DAILY_ACTIVE_CALORIES = 20_000;

/** Anti-spam (F12, CA9) et bornes des listes (pas de pagination en V1). */
export const ENCOURAGEMENTS_PER_FRIEND_PER_DAY = 1;
export const FRIEND_REQUESTS_PER_DAY = 20;
export const MAX_FRIENDS = 200;
export const MAX_PENDING_OUTGOING_REQUESTS = 50;
export const RECEIVED_ENCOURAGEMENTS_LIMIT = 50;

/** Limitation de débit HTTP (fenêtre glissante d'une minute). */
export const RATE_LIMIT_AUTH_PER_MINUTE_PER_IP = 10;
export const RATE_LIMIT_PER_MINUTE_PER_USER = 120;
export const RATE_LIMIT_USERNAME_PER_MINUTE_PER_USER = 10;

/** Heures silencieuses par défaut, heure locale du destinataire (F12, CA10). */
export const DEFAULT_QUIET_HOURS = { enabled: true, start: "22:00", end: "08:00" } as const;
/** Une notification retenue au-delà de ce délai est abandonnée. */
export const PENDING_NOTIFICATION_TTL_HOURS = 24;

/** Session opaque émise par l'API, glissante (ADR 001). */
export const SESSION_TTL_DAYS = 90;

export const DEFAULT_TIME_ZONE = "Europe/Paris";
