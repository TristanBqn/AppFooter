import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { announce, useMotionDuration } from "../a11y";
import { lightColors, radius, shadow, space } from "../tokens";
import { AppText } from "./AppText";

export type ToastProps = {
  visible: boolean;
  message: string;
  tone?: "success" | "info" | "error";
  /** Appelé après `durationMs` ; le parent passe alors `visible` à false. */
  onHide: () => void;
  durationMs?: number;
};

const toneColor = {
  success: { bg: lightColors.successSoft, fg: "success" },
  info: { bg: lightColors.surface, fg: "text" },
  error: { bg: lightColors.dangerSoft, fg: "danger" },
} as const;

/** Retour immédiat après une action (ex. « Encouragement envoyé à Léa »). Annoncé par VoiceOver. */
export function Toast({ visible, message, tone = "success", onHide, durationMs = 2600 }: ToastProps) {
  const duration = useMotionDuration("base");
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    announce(message);
    Animated.timing(opacity, { toValue: 1, duration, useNativeDriver: true }).start();
    const timer = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration, useNativeDriver: true }).start(() => onHide());
    }, durationMs);
    return () => clearTimeout(timer);
  }, [visible, message, duration, durationMs, onHide, opacity]);

  if (!visible) return null;
  const c = toneColor[tone];
  return (
    <View pointerEvents="none" style={styles.host}>
      <Animated.View style={[styles.toast, { backgroundColor: c.bg, opacity }]}>
        <AppText variant="headline" color={c.fg} style={styles.text}>
          {message}
        </AppText>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: "absolute", left: space[5], right: space[5], bottom: space[12], alignItems: "center" },
  toast: {
    borderRadius: radius.full,
    paddingVertical: space[3],
    paddingHorizontal: space[5],
    shadowColor: shadow.float.color,
    shadowOpacity: shadow.float.opacity,
    shadowRadius: shadow.float.radius,
    shadowOffset: { width: 0, height: shadow.float.offsetY },
  },
  text: { textAlign: "center" },
});
