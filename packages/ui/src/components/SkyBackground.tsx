import type { ReactNode } from "react";
import { StyleSheet, View, type ViewStyle, type StyleProp } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from "react-native-svg";
import { gradients, lightColors } from "../tokens";

export type SkyBackgroundProps = {
  /** `sky` pour les onglets, `dawn` (touche de soleil) pour l'onboarding et les états vides. */
  variant?: "sky" | "dawn";
  /** Nuages et halo décoratifs (masqués pour VoiceOver). */
  decorated?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
};

/** Fond d'écran : dégradé de ciel doux, halo de soleil et deux nuages. Purement décoratif. */
export function SkyBackground({ variant = "sky", decorated = true, style, children }: SkyBackgroundProps) {
  const g = gradients[variant];
  return (
    <View style={[styles.root, style]}>
      <LinearGradient colors={g.colors} locations={g.locations} style={StyleSheet.absoluteFill} />
      {decorated ? (
        <View style={[StyleSheet.absoluteFill, styles.passThrough]} aria-hidden>
          <Svg width="100%" height={320} viewBox="0 0 390 320" preserveAspectRatio="xMidYMin slice">
            <Defs>
              <RadialGradient id="sun" cx="0.5" cy="0.5" r="0.5">
                <Stop offset="0" stopColor={lightColors.sunGlow} stopOpacity={0.9} />
                <Stop offset="1" stopColor={lightColors.sunGlow} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx={330} cy={40} r={120} fill="url(#sun)" />
            <Path d={CLOUD} fill={lightColors.cloud} opacity={0.7} transform="translate(-30 70) scale(1.1)" />
            <Path d={CLOUD} fill={lightColors.cloud} opacity={0.5} transform="translate(230 170) scale(0.7)" />
          </Svg>
        </View>
      ) : null}
      {children}
    </View>
  );
}

/** Nuage arrondi (160 x 60). */
export const CLOUD =
  "M30 60a30 30 0 0 1 0-60c8 0 15 3 20 8a38 38 0 0 1 68 6a24 24 0 0 1 12-3a24 24 0 0 1 0 49z";

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: lightColors.background },
  passThrough: { pointerEvents: "none" },
});
