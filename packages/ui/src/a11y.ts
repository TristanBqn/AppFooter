// Préférences d'accessibilité iOS : « Réduire les animations » et « Réduire la transparence ».
import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";
import { motion, type MotionDuration } from "./tokens";

function useAccessibilitySetting(
  read: () => Promise<boolean>,
  event: "reduceMotionChanged" | "reduceTransparencyChanged",
): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let active = true;
    read().then((v) => active && setEnabled(v)).catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener(event, setEnabled);
    return () => {
      active = false;
      sub.remove();
    };
  }, [read, event]);
  return enabled;
}

const readReduceMotion = () => AccessibilityInfo.isReduceMotionEnabled();
const readReduceTransparency = () => AccessibilityInfo.isReduceTransparencyEnabled();

export function useReducedMotion(): boolean {
  return useAccessibilitySetting(readReduceMotion, "reduceMotionChanged");
}

export function useReducedTransparency(): boolean {
  return useAccessibilitySetting(readReduceTransparency, "reduceTransparencyChanged");
}

/** Durée d'animation respectant « Réduire les animations ». */
export function useMotionDuration(name: MotionDuration): number {
  const reduced = useReducedMotion();
  return reduced ? motion.reduced[name] : motion.duration[name];
}

/** Annonce VoiceOver ponctuelle (retour après une action). */
export function announce(message: string): void {
  AccessibilityInfo.announceForAccessibility(message);
}
