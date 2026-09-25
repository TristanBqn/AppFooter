// Heures silencieuses (ADR 004, CA10) : fonctions pures, aucune dépendance à la base de données.
// `isQuietTime` gère la plage qui chevauche minuit (ex. 22:00–08:00, valeurs par défaut).
import { localTimeToMinutes } from "../lib/time";
import { addDaysToLocalDate, localDate } from "./local-date";

export interface QuietHours {
  enabled: boolean;
  start: string;
  end: string;
}

/** Minute du jour (0–1439) d'un instant, dans le fuseau IANA donné. */
export function localMinutesOfDay(instant: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const parts = formatter.formatToParts(instant);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return (hour % 24) * 60 + minute;
}

export function isQuietTime(now: Date, timeZone: string, quietHours: QuietHours): boolean {
  if (!quietHours.enabled) return false;
  const start = localTimeToMinutes(quietHours.start);
  const end = localTimeToMinutes(quietHours.end);
  if (start === end) return false; // borne déjà refusée par le schéma, défensif.
  const current = localMinutesOfDay(now, timeZone);
  if (start < end) return current >= start && current < end; // plage dans la même journée civile.
  return current >= start || current < end; // plage à cheval sur minuit.
}

/** Décalage (minutes) entre `timeZone` et UTC pour l'instant donné (positif = à l'est de UTC). */
function offsetMinutesAt(instant: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = Object.fromEntries(formatter.formatToParts(instant).map((p) => [p.type, p.value]));
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
  );
  return (asUtc - instant.getTime()) / 60_000;
}

/**
 * Instant UTC correspondant à l'heure locale `HH:MM` du jour civil `date`, dans `timeZone`.
 * Deux passes pour rester correct au voisinage d'un changement d'heure (DST).
 */
export function zonedDateTimeToInstant(date: string, hhmm: string, timeZone: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = hhmm.split(":").map(Number);
  const naiveUtcMs = Date.UTC(year!, month! - 1, day!, hour!, minute!);
  const offset1 = offsetMinutesAt(new Date(naiveUtcMs), timeZone);
  const offset2 = offsetMinutesAt(new Date(naiveUtcMs - offset1 * 60_000), timeZone);
  return new Date(naiveUtcMs - offset2 * 60_000);
}

/**
 * Fin de la plage silencieuse en cours (instant UTC), à utiliser comme `deliver_after` d'une
 * notification retenue. N'a de sens que si `isQuietTime(now, timeZone, quietHours)` est vrai.
 */
export function endOfQuietWindow(now: Date, timeZone: string, quietHours: QuietHours): Date {
  const today = localDate(now, timeZone);
  const start = localTimeToMinutes(quietHours.start);
  const end = localTimeToMinutes(quietHours.end);
  const current = localMinutesOfDay(now, timeZone);
  // Plage sur la même journée, ou plage à cheval sur minuit mais déjà après minuit : fin aujourd'hui.
  const endDate = start < end || current < end ? today : addDaysToLocalDate(today, 1);
  return zonedDateTimeToInstant(endDate, quietHours.end, timeZone);
}
