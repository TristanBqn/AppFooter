// Calendrier local, fonctions pures (ADR 002, ADR 003) : aucune dépendance à la base de données,
// testables sans horloge réelle. Réutilisé par la synchro (B5), les classements et l'accueil (B6).
const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatterCache.get(timeZone);
  if (!formatter) {
    // `en-CA` produit AAAA-MM-JJ, format identique à `LocalDateSchema` (@app/contracts).
    formatter = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
    formatterCache.set(timeZone, formatter);
  }
  return formatter;
}

/** Date civile (AAAA-MM-JJ) d'un instant, dans le fuseau IANA donné. */
export function localDate(instant: Date, timeZone: string): string {
  return formatterFor(timeZone).format(instant);
}

/** Jour ISO de la semaine (1 = lundi … 7 = dimanche) d'une date locale, sans dépendre d'un fuseau. */
export function isoWeekday(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  // UTC pour éviter tout décalage d'heure d'été : on ne raisonne que sur le calendrier.
  const weekday = new Date(Date.UTC(year!, month! - 1, day!)).getUTCDay();
  return weekday === 0 ? 7 : weekday;
}

/** Décale une date locale (AAAA-MM-JJ) de `deltaDays` jours calendaires. */
export function addDaysToLocalDate(date: string, deltaDays: number): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, day! + deltaDays)).toISOString().slice(0, 10);
}

/** Lundi (inclus) de la semaine ISO contenant `date`. */
export function mondayOfWeek(date: string): string {
  return addDaysToLocalDate(date, -(isoWeekday(date) - 1));
}

export function compareLocalDates(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
