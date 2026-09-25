// Conversion pure entre "HH:MM" (LocalTimeSchema, @app/contracts) et `Date` (nécessaire au
// sélecteur natif `@react-native-community/datetimepicker`, mode "time" : seuls heures/minutes
// comptent, le reste de la date est arbitraire).
export function parseLocalTime(value: string): Date {
  const [hours, minutes] = value.split(":").map(Number) as [number, number];
  const date = new Date(2000, 0, 1);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

export function formatLocalTime(date: Date): string {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

/** "08:00" -> "8 h 00", "22:05" -> "22 h 05" (m4 : pas de zéro initial sur l'heure). */
export function formatQuietHour(value: string): string {
  const [hours, minutes] = value.split(":");
  return `${Number(hours)} h ${minutes}`;
}
