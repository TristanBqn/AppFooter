import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useReducedMotion } from "../a11y";
import { layout, lightColors, motion, radius, space, type ColorToken } from "../tokens";
import { AppText } from "./AppText";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";

export type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  /** Libellé VoiceOver si différent du texte visible (ex. « Encourager Léa »). */
  accessibilityLabel?: string;
  accessibilityHint?: string;
  disabled?: boolean;
  loading?: boolean;
  /** Icône décorative à gauche (masquée pour VoiceOver). */
  icon?: ReactNode;
  size?: "regular" | "compact";
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const palettes: Record<ButtonVariant, { bg: string; bgPressed: string; fg: ColorToken }> = {
  primary: { bg: lightColors.accent, bgPressed: lightColors.accentPressed, fg: "textOnAccent" },
  secondary: { bg: lightColors.accentSoft, bgPressed: lightColors.accentSoftPressed, fg: "accentText" },
  ghost: { bg: "transparent", bgPressed: lightColors.highlight, fg: "accentText" },
  destructive: { bg: lightColors.dangerSoft, bgPressed: lightColors.dangerSoftPressed, fg: "danger" },
};

/** Bouton : une seule action principale (`primary`) par écran. */
export function Button({
  label,
  onPress,
  variant = "primary",
  accessibilityLabel,
  accessibilityHint,
  disabled = false,
  loading = false,
  icon,
  size = "regular",
  style,
  testID,
}: ButtonProps) {
  const reducedMotion = useReducedMotion();
  const p = palettes[variant];
  const inactive = disabled || loading;
  const fg: ColorToken = disabled ? "textSecondary" : p.fg;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      testID={testID}
      hitSlop={size === "compact" ? space[1] : 0}
      style={({ pressed }) => [
        styles.base,
        size === "compact" ? styles.compact : styles.regular,
        { backgroundColor: disabled ? (variant === "ghost" ? "transparent" : lightColors.accentSoft) : pressed ? p.bgPressed : p.bg },
        pressed && !reducedMotion ? { transform: [{ scale: motion.pressedScale }] } : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={lightColors[fg]} accessibilityElementsHidden />
      ) : (
        <View style={styles.content}>
          {icon ? (
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              {icon}
            </View>
          ) : null}
          <AppText variant="headline" color={fg} style={styles.label}>
            {label}
          </AppText>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space[6],
  },
  regular: { minHeight: layout.buttonHeight, paddingVertical: space[3] },
  compact: { minHeight: layout.minTouch - space[2], paddingVertical: space[2], paddingHorizontal: space[4] },
  content: { flexDirection: "row", alignItems: "center", gap: space[2], flexShrink: 1 },
  label: { textAlign: "center", flexShrink: 1 },
});
