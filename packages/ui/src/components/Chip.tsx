import { Pressable, StyleSheet, View } from "react-native";
import { useReducedMotion } from "../a11y";
import { layout, lightColors, motion, radius, space } from "../tokens";
import { AppText } from "./AppText";

export type ChipProps = {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  disabled?: boolean;
  selected?: boolean;
};

/** Puce pressable : encouragements prédéfinis (envoi en une action). */
export function Chip({ label, onPress, accessibilityLabel, accessibilityHint, disabled = false, selected = false }: ChipProps) {
  const reduced = useReducedMotion();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.selected,
        pressed && styles.pressed,
        pressed && !reduced ? { transform: [{ scale: motion.pressedScale }] } : null,
        disabled && !selected && styles.disabled,
      ]}
    >
      <AppText variant="callout" color={selected ? "textOnAccent" : disabled ? "textSecondary" : "accentText"}>
        {label}
      </AppText>
    </Pressable>
  );
}

export type StatTileProps = {
  label: string;
  value: string;
  /** Lecture VoiceOver si différente, ex. « Calories actives, 312 kilocalories ». */
  accessibilityLabel?: string;
};

/** Petit indicateur chiffré (calories, rang du jour). */
export function StatTile({ label, value, accessibilityLabel }: StatTileProps) {
  return (
    <View style={styles.tile} accessible accessibilityLabel={accessibilityLabel ?? `${label}, ${value}`}>
      <AppText variant="footnote" color="textSecondary">
        {label}
      </AppText>
      <AppText variant="title2" style={styles.value}>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: layout.minTouch,
    justifyContent: "center",
    paddingHorizontal: space[4],
    paddingVertical: space[2],
    borderRadius: radius.full,
    backgroundColor: lightColors.accentSoft,
  },
  selected: { backgroundColor: lightColors.accent },
  pressed: { backgroundColor: lightColors.accentSoftPressed },
  disabled: { backgroundColor: lightColors.surfaceOpaque },
  tile: { flex: 1, gap: space[1] },
  value: { fontVariant: ["tabular-nums"] },
});
