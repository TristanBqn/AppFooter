// Design tokens : SEULE source des valeurs visuelles (web via Tailwind, mobile via NativeWind).
// Propriétaire : designer. Valeurs neutres provisoires, à remplacer d'après docs/design/DESIGN.md.
export const tokens = {
  color: {
    light: {
      bg: "#FFFFFF", surface: "#F7F7F8", border: "#E4E4E7",
      text: "#18181B", textMuted: "#52525B",
      primary: "#18181B", primaryFg: "#FFFFFF",
      danger: "#DC2626", success: "#16A34A", warning: "#D97706",
    },
    dark: {
      bg: "#09090B", surface: "#18181B", border: "#27272A",
      text: "#FAFAFA", textMuted: "#A1A1AA",
      primary: "#FAFAFA", primaryFg: "#09090B",
      danger: "#F87171", success: "#4ADE80", warning: "#FBBF24",
    },
  },
  font: { sans: "Inter, system-ui, sans-serif", mono: "ui-monospace, monospace" },
  fontSize: { xs: 12, sm: 14, base: 16, lg: 18, xl: 20, "2xl": 24, "3xl": 30, "4xl": 36 },
  space: { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 16: 64 },
  radius: { sm: 4, md: 8, lg: 12, xl: 16, full: 9999 },
  motion: { fast: 120, base: 200, slow: 320 },
} as const;
export type Tokens = typeof tokens;
