import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import { useReducedTransparency } from "../a11y";
import { blur, layout, lightColors, radius, shadow } from "../tokens";

export type GlassCardProps = ViewProps & {
  /** `card` (défaut) ou `strong` (feuilles, zones de saisie : plus opaque). */
  tone?: "card" | "strong";
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
};

/**
 * Carte « liquid glass » légère : flou discret + voile blanc (62 %) + liseré clair + ombre très douce.
 * Le contraste AA du texte est garanti par le voile seul (flou ignoré dans le calcul).
 * Avec « Réduire la transparence », la carte devient opaque.
 */
export function GlassCard({ tone = "card", padded = true, style, children, ...rest }: GlassCardProps) {
  const opaque = useReducedTransparency();
  const veil = tone === "strong" ? lightColors.glassStrong : lightColors.glass;
  return (
    <View style={[styles.shadow, style]} {...rest}>
      <View style={styles.clip}>
        {opaque ? (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: lightColors.surfaceOpaque }]} />
        ) : (
          <>
            <BlurView intensity={tone === "strong" ? blur.sheet : blur.card} tint="light" style={StyleSheet.absoluteFill} />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: veil }]} />
          </>
        )}
        <View style={padded ? styles.padding : undefined}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    borderRadius: radius.lg,
    boxShadow: shadow.soft.css,
  },
  clip: {
    borderRadius: radius.lg,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: lightColors.glassBorder,
  },
  padding: { padding: layout.cardPadding },
});
