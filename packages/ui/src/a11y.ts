// Préférences d'accessibilité iOS : « Réduire les animations » et « Réduire la transparence ».
// Dégradation web (aperçu react-native-web) : la transparence réduite n'existe pas, on renvoie false.
import { useEffect, useState } from "react";
import { AccessibilityInfo, Platform } from "react-native";
import { motion, type MotionDuration } from "./tokens";

/** Le pilote natif d'Animated n'existe pas sur le web. */
export const nativeDriver = Platform.OS !== "web";

type SettingEvent = "reduceMotionChanged" | "reduceTransparencyChanged";

function useAccessibilitySetting(read: (() => Promise<boolean>) | undefined, event: SettingEvent): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    if (!read) return;
    let active = true;
    read().then((v) => active && setEnabled(v)).catch(() => undefined);
    // react-native-web renvoie `undefined` si l'événement n'est pas pris en charge.
    const sub = AccessibilityInfo.addEventListener(event, setEnabled) as { remove(): void } | undefined;
    return () => {
      active = false;
      sub?.remove();
    };
  }, [read, event]);
  return enabled;
}

const readReduceMotion =
  typeof AccessibilityInfo.isReduceMotionEnabled === "function" ? () => AccessibilityInfo.isReduceMotionEnabled() : undefined;
const readReduceTransparency =
  typeof AccessibilityInfo.isReduceTransparencyEnabled === "function"
    ? () => AccessibilityInfo.isReduceTransparencyEnabled()
    : undefined;

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

/** Annonce VoiceOver ponctuelle (retour après une action). Sans effet sur le web. */
export function announce(message: string): void {
  AccessibilityInfo.announceForAccessibility?.(message);
}
