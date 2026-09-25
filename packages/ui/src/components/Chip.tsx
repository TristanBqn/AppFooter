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
      role="button"
      aria-label={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      aria-disabled={disabled}
      aria-selected={selected}
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
  /** Rend la tuile pressable (bouton), ex. rang du jour → Classement. */
  onPress?: () => void;
  /** Conséquence du toucher, ex. « Ouvre le classement ». Ignoré sans `onPress`. */
  accessibilityHint?: string;
};

/** Petit indicateur chiffré (calories, rang du jour). Pressable si `onPress` est fourni. */
export function StatTile({ label, value, accessibilityLabel, onPress, accessibilityHint }: StatTileProps) {
  const reduced = useReducedMotion();
  const a11yLabel = accessibilityLabel ?? `${label}, ${value}`;
  const content = (
    <>
      {onPress ? (
        <View style={styles.tileLabel}>
          <AppText variant="footnote" color="textSecondary" style={styles.tileLabelText}>
            {label}
          </AppText>
          <AppText variant="footnote" color="textSecondary" aria-hidden>
            ›
          </AppText>
        </View>
      ) : (
        <AppText variant="footnote" color="textSecondary">
          {label}
        </AppText>
      )}
      <AppText variant="title2" style={styles.value}>
        {value}
      </AppText>
    </>
  );

  if (!onPress) {
    return (
      <View style={styles.tile} accessible aria-label={a11yLabel}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      role="button"
      aria-label={a11yLabel}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      hitSlop={space[2]}
      style={({ pressed }) => [
        styles.tile,
        styles.tilePressable,
        pressed && styles.tilePressed,
        pressed && !reduced ? { transform: [{ scale: motion.pressedScale }] } : null,
      ]}
    >
      {content}
    </Pressable>
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
  tileLabel: { flexDirection: "row", alignItems: "center", gap: space[1] },
  tileLabelText: { flexShrink: 1 },
  tilePressable: { minHeight: layout.minTouch, justifyContent: "center" },
  tilePressed: { opacity: 0.6 },
  value: { fontVariant: ["tabular-nums"] },
});
