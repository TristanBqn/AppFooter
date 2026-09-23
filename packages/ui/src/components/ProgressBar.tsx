import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { gradients, lightColors, radius } from "../tokens";
import { toPercent } from "../format";

export type ProgressBarProps = {
  progress: number;
  accessibilityLabel: string;
  accessibilityValueText?: string;
  height?: number;
};

/** Barre de progression horizontale (historique, profil d'un ami). */
export function ProgressBar({ progress, accessibilityLabel, accessibilityValueText, height = 10 }: ProgressBarProps) {
  const clamped = Math.min(1, Math.max(0, progress));
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: toPercent(clamped), text: accessibilityValueText }}
      style={[styles.track, { height }]}
    >
      {clamped > 0 ? (
        <LinearGradient
          colors={gradients.progress.colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.fill, { width: `${Math.max(clamped * 100, 4)}%` }]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { backgroundColor: lightColors.progressTrack, borderRadius: radius.full, overflow: "hidden" },
  fill: { height: "100%", borderRadius: radius.full },
});
