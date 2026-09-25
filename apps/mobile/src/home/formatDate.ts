// Formatage de dates FR (tutoiement, DESIGN.md), pur (Intl seul, aucune dépendance React Native).
// Les entrées sont des `LocalDate` ("AAAA-MM-JJ") déjà résolues dans le fuseau de l'utilisateur
// (voir src/health/aggregate.ts `toLocalDate`) : on reconstruit une date locale à minuit à partir
// des composants pour ne jamais re-glisser d'un jour au formatage.
import type { LocalDate } from "@app/contracts";

function capitalize(text: string): string {
  return text.length === 0 ? text : text.charAt(0).toUpperCase() + text.slice(1);
}

function toMidnight(date: LocalDate): Date {
  const [year, month, day] = date.split("-").map(Number) as [number, number, number];
  return new Date(year, month - 1, day);
}

/** "2026-09-25" -> "Jeudi 25 septembre" (en-tête Accueil). */
export function formatHeaderDate(date: LocalDate): string {
  return capitalize(
    new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" }).format(toMidnight(date)),
  );
}

/** "2026-09-24" -> "Jeudi 24 sept." (lignes d'historique). */
export function formatShortDate(date: LocalDate): string {
  return capitalize(
    new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "short" }).format(toMidnight(date)),
  );
}

/** "2026-09-12" -> "le 12 septembre" (résumé de l'historique : meilleur jour). */
export function formatDayOfMonth(date: LocalDate): string {
  return `le ${new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" }).format(toMidnight(date))}`;
}
