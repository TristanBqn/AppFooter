import { useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, StyleSheet, View, useWindowDimensions } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Stop } from "react-native-svg";
import { useMotionDuration } from "../a11y";
import { lightColors, space } from "../tokens";
import { toPercent } from "../format";

/** Au-delà de ce facteur Dynamic Type, le contenu central passe sous l'anneau. */
export const LARGE_TEXT_SCALE = 1.3;

export type StepRingProps = {
  /** Avancement 0–1 vers le prochain seuil. */
  progress: number;
  /** Libellé VoiceOver, ex. « Progression vers 10 000 pas ». */
  accessibilityLabel: string;
  /** Valeur lue par VoiceOver, ex. « 8 450 pas sur 10 000 ». */
  accessibilityValueText: string;
  size?: number;
  strokeWidth?: number;
  /** Contenu central (chiffre du jour). Placé sous l'anneau en très grande taille de texte. */
  children?: ReactNode;
};

/** Anneau de progression des pas, animé à l'apparition (instantané si « Réduire les animations »). */
export function StepRing({
  progress,
  accessibilityLabel,
  accessibilityValueText,
  size = 240,
  strokeWidth = 18,
  children,
}: StepRingProps) {
  const { fontScale } = useWindowDimensions();
  const duration = useMotionDuration("slow");
  const clamped = Math.min(1, Math.max(0, progress));
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  // Valeur affichée pilotée par un état (et non une prop animée du SVG) pour fonctionner aussi sur le web.
  const [shown, setShown] = useState(duration === 0 ? clamped : 0);
  const anim = useRef(new Animated.Value(duration === 0 ? clamped : 0)).current;

  useEffect(() => {
    const id = anim.addListener(({ value }) => setShown(value));
    return () => anim.removeListener(id);
  }, [anim]);

  useEffect(() => {
    if (duration === 0) {
      anim.setValue(clamped);
      return;
    }
    const a = Animated.timing(anim, { toValue: clamped, duration, useNativeDriver: false });
    a.start();
    return () => a.stop();
  }, [anim, clamped, duration]);

  const dashOffset = circumference * (1 - shown);
  const stacked = fontScale >= LARGE_TEXT_SCALE;

  return (
    <View
      style={styles.root}
      accessible
      role="progressbar"
      aria-label={accessibilityLabel}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={toPercent(clamped)}
      aria-valuetext={accessibilityValueText}
    >
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <Defs>
            <LinearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={lightColors.progressStart} />
              <Stop offset="1" stopColor={lightColors.progressEnd} />
            </LinearGradient>
          </Defs>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={lightColors.progressTrack} strokeWidth={strokeWidth} fill="none" />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke="url(#ring)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={dashOffset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </Svg>
        {!stacked ? <View style={[StyleSheet.absoluteFill, styles.center]}>{children}</View> : null}
      </View>
      {stacked ? <View style={styles.below}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: "center" },
  center: { alignItems: "center", justifyContent: "center", padding: space[6] },
  below: { alignItems: "center", marginTop: space[4] },
});
