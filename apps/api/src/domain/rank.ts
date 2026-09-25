// Rang « competition » (ADR 003) : tri décroissant sur `value`, départage croissant sur `key`
// (pseudonyme) ; égalité => même rang, rang suivant sauté (1, 2, 2, 4). Fonction pure, réutilisée
// par les classements (B6) et GET /me/today.
export interface Rankable {
  key: string;
  value: number;
}

export function rankEntries<T extends Rankable>(entries: readonly T[]): (T & { rank: number })[] {
  const sorted = [...entries].sort(
    (a, b) => b.value - a.value || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0),
  );

  let previousValue: number | null = null;
  let previousRank = 0;
  return sorted.map((entry, index) => {
    const rank = entry.value === previousValue ? previousRank : index + 1;
    previousValue = entry.value;
    previousRank = rank;
    return { ...entry, rank };
  });
}
