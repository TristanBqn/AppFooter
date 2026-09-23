// Formatage et libellés (français, tutoiement). Purs et testés : aucun import React Native.

const NBSP = " ";

/** 12345 -> "12 345" (espace insécable, indépendant du support Intl du moteur JS). */
export function formatNumber(value: number): string {
  const n = Math.max(0, Math.round(value));
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
}

export function formatSteps(value: number): string {
  return `${formatNumber(value)}${NBSP}pas`;
}

export function formatKcal(value: number): string {
  return `${formatNumber(value)}${NBSP}kcal`;
}

/** 1 -> "1er", 2 -> "2e". */
export function formatRank(rank: number): string {
  return rank === 1 ? "1er" : `${rank}e`;
}

export function formatRankLabel(rank: number, tied: boolean): string {
  return tied ? `${formatRank(rank)} ex æquo` : formatRank(rank);
}

export type RankLabelInput = {
  rank: number;
  tied: boolean;
  name: string;
  steps: number;
  isMe?: boolean;
};

/** Libellé VoiceOver d'une ligne de classement. */
export function rankAccessibilityLabel({ rank, tied, name, steps, isMe }: RankLabelInput): string {
  const who = isMe ? `${name}, toi` : name;
  return `${formatRankLabel(rank, tied)}, ${who}, ${formatSteps(steps)}`;
}

/**
 * Marque les égalités d'une liste déjà classée (rang fourni par l'API, règle 1, 2, 2, 4).
 * Générique : ne redéfinit aucun type d'API.
 */
export function markTies<T extends { rank: number }>(entries: readonly T[]): Array<T & { tied: boolean }> {
  const counts = new Map<number, number>();
  for (const e of entries) counts.set(e.rank, (counts.get(e.rank) ?? 0) + 1);
  return entries.map((e) => ({ ...e, tied: (counts.get(e.rank) ?? 0) > 1 }));
}

export type ThresholdProgress = {
  /** Prochain seuil, ou `null` si tous sont franchis. */
  next: number | null;
  /** Dernier seuil franchi (0 si aucun). */
  previous: number;
  /** Avancement vers `next`, entre 0 et 1 (1 si tous les seuils sont franchis). */
  fraction: number;
  remaining: number;
};

/** Progression vers le prochain seuil (seuils fournis par l'appelant, triés ou non). */
export function progressToNext(steps: number, thresholds: readonly number[]): ThresholdProgress {
  const sorted = [...thresholds].filter((t) => t > 0).sort((a, b) => a - b);
  const s = Math.max(0, steps);
  const next = sorted.find((t) => t > s) ?? null;
  const previous = [...sorted].reverse().find((t) => t <= s) ?? 0;
  if (next === null) return { next: null, previous, fraction: 1, remaining: 0 };
  const fraction = (s - previous) / (next - previous);
  return { next, previous, fraction: Math.min(1, Math.max(0, fraction)), remaining: next - s };
}

/** Pourcentage entier pour `accessibilityValue`. */
export function toPercent(fraction: number): number {
  return Math.round(Math.min(1, Math.max(0, fraction)) * 100);
}

/** Pas nécessaires pour dépasser strictement quelqu'un (« Encore 1 201 pas pour dépasser lea »). */
export function stepsToOvertake(mine: number, theirs: number): number {
  return Math.max(0, Math.round(theirs) - Math.round(mine) + 1);
}
