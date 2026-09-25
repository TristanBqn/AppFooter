import { StyleSheet, View } from "react-native";
import { lightColors, radius } from "../tokens";
import { AppText } from "./AppText";

export type MonogramProps = {
  name: string;
  size?: number;
  /** `soft` (défaut, fond `accentSoft`) ; `surface` (fond blanc) sur un fond déjà teinté, ex. ma ligne au classement. */
  tone?: "soft" | "surface";
};

/** Pastille avec l'initiale du pseudonyme. Décorative : le nom est lu par l'élément parent. */
export function Monogram({ name, size = 40, tone = "soft" }: MonogramProps) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <View
      aria-hidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.root, tone === "surface" && styles.surface, { width: size, height: size }]}
    >
      <AppText variant={size >= 56 ? "title2" : "headline"} color="accentText" maxFontSizeMultiplier={1.2}>
        {initial}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    borderRadius: radius.full,
    backgroundColor: lightColors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  surface: { backgroundColor: lightColors.surface },
});
