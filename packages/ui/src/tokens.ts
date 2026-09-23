// Design tokens Footer : SEULE source des valeurs visuelles (composants @app/ui et preset NativeWind).
// Propriétaire : designer. Directives : docs/design/DESIGN.md (calme, aérien, ludique ; ciel, nuages, lumière).
// Aucune dépendance à React Native ici : ce fichier est lu aussi par la config Tailwind/NativeWind.

/** Palette brute : ne pas l'utiliser directement dans les écrans, passer par `color.light`. */
export const palette = {
  white: "#FFFFFF",
  sky50: "#F7FBFF",
  sky100: "#EEF7FF",
  sky200: "#D6EBFF",
  sky300: "#BFDFFF",
  sky400: "#8CC4F5",
  sky500: "#2F7BDD",
  sky600: "#1859B0",
  sky700: "#134A94",
  ink900: "#0B2545",
  ink700: "#3A5578",
  ink500: "#5A7596",
  ink300: "#A9BCD3",
  mint700: "#17664B",
  mint100: "#DDF3EA",
  rose700: "#A3334A",
  rose100: "#FBE6EA",
  rose200: "#F6D3DA",
  amber700: "#7A4F00",
  amber100: "#FFF1CC",
  sun300: "#FFE08A",
  sun100: "#FFF6DB",
} as const;

/**
 * Couleurs sémantiques. Le texte (`text*`, `accentText`, `success`, `danger`, `warning`)
 * est vérifié AA (4,5:1) sur toutes les surfaces porteuses de texte, y compris le verre
 * composité sur le ciel (voir `tokens.test.ts`). Les couleurs graphiques (`progress*`,
 * `borderStrong`) sont vérifiées à 3:1 (WCAG 1.4.11).
 */
export const lightColors = {
  // Fonds
  background: palette.sky100,
  surface: palette.white,
  surfaceOpaque: palette.sky50, // remplace le verre si « Réduire la transparence » est actif
  glass: "rgba(255, 255, 255, 0.62)",
  glassStrong: "rgba(255, 255, 255, 0.78)", // feuilles, barre d'onglets, champ de saisie
  glassBorder: "rgba(255, 255, 255, 0.85)",
  highlight: "rgba(47, 123, 221, 0.10)", // ligne « moi » au classement, élément sélectionné
  scrim: "rgba(11, 37, 69, 0.32)", // voile derrière une feuille modale

  // Texte
  text: palette.ink900,
  textSecondary: palette.ink700,
  textOnAccent: palette.white,
  accentText: palette.sky600, // liens, boutons secondaires

  // Accent
  accent: palette.sky600,
  accentPressed: palette.sky700,
  accentSoft: palette.sky200, // fond de bouton secondaire, puces
  accentSoftPressed: palette.sky300,
  accentDisabled: palette.ink300,

  // Bordures
  border: "rgba(11, 37, 69, 0.10)", // séparateurs décoratifs uniquement
  borderStrong: palette.ink500, // contour de champ (3:1)
  focus: palette.sky500,

  // Progression (graphique, 3:1 minimum sur verre)
  progressTrack: "rgba(24, 89, 176, 0.14)",
  progressStart: palette.sky500,
  progressEnd: palette.sky600,

  // Statuts doux (pas de rouge agressif)
  success: palette.mint700,
  successSoft: palette.mint100,
  danger: palette.rose700,
  dangerSoft: palette.rose100,
  dangerSoftPressed: palette.rose200,
  warning: palette.amber700,
  warningSoft: palette.amber100,

  // Décor (jamais porteur de texte ni d'information)
  sun: palette.sun300,
  sunGlow: palette.sun100,
  cloud: "rgba(255, 255, 255, 0.9)",
} as const;

export type ColorToken = keyof typeof lightColors;
/** Contrat pour un futur thème sombre : mêmes clés, autres valeurs. */
export type SemanticColors = Record<ColorToken, string>;

/** Dégradés de ciel, de haut en bas. `locations` en fractions 0–1 (expo-linear-gradient). */
export const gradients = {
  sky: { colors: [palette.sky300, palette.sky200, palette.sky100, palette.white], locations: [0, 0.35, 0.7, 1] },
  dawn: { colors: [palette.sky200, palette.sky100, palette.sun100], locations: [0, 0.6, 1] },
  progress: { colors: [palette.sky500, palette.sky600], locations: [0, 1] },
} as const;

/** Toutes les couleurs de fond sur lesquelles du texte peut apparaître (hors verre). */
export const skyStops = gradients.sky.colors;

export const fontFamily = {
  /** SF Pro (police système iOS). */
  text: "System",
  /** SF Pro Rounded : chiffres et titres. */
  rounded: "ui-rounded",
} as const;

type TextStyleToken = {
  fontSize: number;
  lineHeight: number;
  fontWeight: "400" | "500" | "600" | "700";
  family: keyof typeof fontFamily;
  /** Plafond Dynamic Type (`maxFontSizeMultiplier`). `undefined` = aucun plafond. */
  maxScale?: number;
  tabular?: boolean;
};

/**
 * Échelle alignée sur les styles de texte iOS (taille « Large » par défaut), qui suivent Dynamic Type
 * via `allowFontScaling` (actif par défaut en React Native). Seuls les très grands chiffres sont plafonnés.
 */
export const typography = {
  hero: { fontSize: 64, lineHeight: 72, fontWeight: "700", family: "rounded", maxScale: 1.4, tabular: true },
  largeTitle: { fontSize: 34, lineHeight: 41, fontWeight: "700", family: "rounded", maxScale: 2 },
  title1: { fontSize: 28, lineHeight: 34, fontWeight: "700", family: "rounded", maxScale: 2 },
  title2: { fontSize: 22, lineHeight: 28, fontWeight: "600", family: "rounded" },
  title3: { fontSize: 20, lineHeight: 25, fontWeight: "600", family: "rounded" },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: "600", family: "text" },
  body: { fontSize: 17, lineHeight: 22, fontWeight: "400", family: "text" },
  callout: { fontSize: 16, lineHeight: 21, fontWeight: "400", family: "text" },
  subheadline: { fontSize: 15, lineHeight: 20, fontWeight: "400", family: "text" },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: "400", family: "text" },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: "500", family: "text" },
  number: { fontSize: 20, lineHeight: 25, fontWeight: "600", family: "rounded", tabular: true },
} as const satisfies Record<string, TextStyleToken>;

export type TypographyToken = keyof typeof typography;

/** Espacements, base 4. */
export const space = {
  0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 16: 64,
} as const;

/** Marge latérale des écrans et écart vertical entre cartes. */
export const layout = {
  screenPadding: space[5],
  cardGap: space[4],
  cardPadding: space[5],
  minTouch: 44,
  buttonHeight: 52,
} as const;

/** Coins très arrondis (DESIGN.md §4). */
export const radius = {
  sm: 10, md: 16, lg: 24, xl: 32, full: 9999,
} as const;

/** Ombres très légères, teintées bleu nuit plutôt que noir. */
export const shadow = {
  none: { color: palette.ink900, opacity: 0, radius: 0, offsetY: 0 },
  soft: { color: palette.ink900, opacity: 0.06, radius: 16, offsetY: 6 },
  float: { color: palette.ink900, opacity: 0.1, radius: 24, offsetY: 10 },
} as const;

/** Intensité de flou `expo-blur` (0–100). Discret par principe. */
export const blur = {
  card: 30, sheet: 50, bar: 60,
} as const;

/** Durées en ms. `reduced` s'applique si « Réduire les animations » est actif. */
export const motion = {
  duration: { instant: 80, fast: 160, base: 240, slow: 400, celebrate: 900 },
  reduced: { instant: 0, fast: 0, base: 120, slow: 120, celebrate: 0 },
  /** Courbe douce (cubic-bezier) pour les entrées. */
  easing: [0.25, 0.1, 0.25, 1] as const,
  pressedScale: 0.97,
} as const;

export type MotionDuration = keyof typeof motion.duration;

export const tokens = {
  palette,
  color: { light: lightColors },
  gradients,
  fontFamily,
  typography,
  space,
  layout,
  radius,
  shadow,
  blur,
  motion,
} as const;

export type Tokens = typeof tokens;
