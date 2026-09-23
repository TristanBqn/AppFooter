import { useEffect, useRef, type ReactNode } from "react";
import { Animated, StyleSheet, View, type DimensionValue } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { useReducedMotion } from "../a11y";
import { lightColors, motion, radius, space } from "../tokens";
import { AppText } from "./AppText";
import { Button } from "./Button";
import { CLOUD } from "./SkyBackground";

export type SkeletonProps = { width?: DimensionValue; height?: number; rounded?: boolean };

/** Bloc de chargement : pulsation lente, figée si « Réduire les animations ». */
export function Skeleton({ width = "100%", height = 16, rounded = false }: SkeletonProps) {
  const reduced = useReducedMotion();
  const opacity = useRef(new Animated.Value(0.6)).current;
  useEffect(() => {
    if (reduced) {
      opacity.setValue(0.6);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: motion.duration.celebrate, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.6, duration: motion.duration.celebrate, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity, reduced]);
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width, height, opacity, borderRadius: rounded ? radius.full : radius.sm, backgroundColor: lightColors.progressTrack }}
    />
  );
}

export type LoadingStateProps = {
  /** Annoncé par VoiceOver, ex. « Chargement du classement ». */
  accessibilityLabel: string;
  /** Squelette propre à l'écran ; à défaut, trois lignes. */
  children?: ReactNode;
};

export function LoadingState({ accessibilityLabel, children }: LoadingStateProps) {
  return (
    <View accessible accessibilityLabel={accessibilityLabel} accessibilityState={{ busy: true }} style={styles.loading}>
      {children ?? (
        <>
          <Skeleton height={24} width="60%" />
          <Skeleton height={16} />
          <Skeleton height={16} width="80%" />
        </>
      )}
    </View>
  );
}

type Action = { label: string; onPress: () => void; loading?: boolean };

export type EmptyStateProps = {
  title: string;
  message?: string;
  action?: Action;
  illustration?: "cloud" | "sun";
};

/** Absence de données : rassurant, une seule action. */
export function EmptyState({ title, message, action, illustration = "cloud" }: EmptyStateProps) {
  return (
    <View style={styles.center}>
      <Illustration kind={illustration} />
      <AppText variant="title3" style={styles.centerText} accessibilityRole="header">
        {title}
      </AppText>
      {message ? (
        <AppText variant="callout" color="textSecondary" style={styles.centerText}>
          {message}
        </AppText>
      ) : null}
      {action ? <Button label={action.label} onPress={action.onPress} loading={action.loading} style={styles.action} /> : null}
    </View>
  );
}

export type ErrorStateProps = {
  title?: string;
  /** Dire quoi faire, ex. « Vérifie ta connexion puis réessaie. » */
  message: string;
  onRetry?: () => void;
  retrying?: boolean;
};

export function ErrorState({ title = "Petit nuage sur la connexion", message, onRetry, retrying }: ErrorStateProps) {
  return (
    <View style={styles.center} accessibilityLiveRegion="polite">
      <Illustration kind="cloud" />
      <AppText variant="title3" style={styles.centerText} accessibilityRole="header">
        {title}
      </AppText>
      <AppText variant="callout" color="textSecondary" style={styles.centerText}>
        {message}
      </AppText>
      {onRetry ? <Button label="Réessayer" variant="secondary" onPress={onRetry} loading={retrying} style={styles.action} /> : null}
    </View>
  );
}

function Illustration({ kind }: { kind: "cloud" | "sun" }) {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={160} height={96} viewBox="0 0 160 96">
        {kind === "sun" ? <Circle cx={112} cy={32} r={26} fill={lightColors.sun} /> : null}
        <Path d={CLOUD} fill={lightColors.surface} transform="translate(10 30)" />
        <Path d={CLOUD} fill={lightColors.accentSoft} opacity={0.6} transform="translate(60 56) scale(0.4)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { gap: space[3], paddingVertical: space[4] },
  center: { alignItems: "center", justifyContent: "center", gap: space[3], paddingVertical: space[10], paddingHorizontal: space[6] },
  centerText: { textAlign: "center" },
  action: { marginTop: space[3], alignSelf: "stretch" },
});
