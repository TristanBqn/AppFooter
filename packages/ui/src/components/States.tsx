import { useEffect, useRef, type ReactNode } from "react";
import { Animated, StyleSheet, View, type DimensionValue } from "react-native";
import { nativeDriver, useReducedMotion } from "../a11y";
import { lightColors, motion, radius, space } from "../tokens";
import { AppText } from "./AppText";
import { Button } from "./Button";
import { Illustration, type IllustrationKind } from "./Illustration";

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
        Animated.timing(opacity, { toValue: 1, duration: motion.duration.celebrate, useNativeDriver: nativeDriver }),
        Animated.timing(opacity, { toValue: 0.6, duration: motion.duration.celebrate, useNativeDriver: nativeDriver }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity, reduced]);
  return (
    <Animated.View
      aria-hidden
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
    <View accessible aria-label={accessibilityLabel} aria-busy style={styles.loading}>
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
  illustration?: IllustrationKind;
};

/** Absence de données : rassurant, une seule action. */
export function EmptyState({ title, message, action, illustration = "calm" }: EmptyStateProps) {
  return (
    <View style={styles.center}>
      <Illustration kind={illustration} />
      <AppText variant="title3" style={styles.centerText} role="heading">
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
    <View style={styles.center} aria-live="polite">
      <Illustration kind="offline" />
      <AppText variant="title3" style={styles.centerText} role="heading">
        {title}
      </AppText>
      <AppText variant="callout" color="textSecondary" style={styles.centerText}>
        {message}
      </AppText>
      {onRetry ? <Button label="Réessayer" variant="secondary" onPress={onRetry} loading={retrying} style={styles.action} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { gap: space[3], paddingVertical: space[4] },
  center: { alignItems: "center", justifyContent: "center", gap: space[3], paddingVertical: space[10], paddingHorizontal: space[6] },
  centerText: { textAlign: "center" },
  action: { marginTop: space[3], alignSelf: "stretch" },
});
