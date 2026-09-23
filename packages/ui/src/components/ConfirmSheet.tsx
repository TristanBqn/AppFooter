import { Modal, Pressable, StyleSheet, View } from "react-native";
import { useReducedMotion } from "../a11y";
import { lightColors, radius, space } from "../tokens";
import { AppText } from "./AppText";
import { Button } from "./Button";
import { GlassCard } from "./GlassCard";

export type ConfirmSheetProps = {
  visible: boolean;
  title: string;
  /** Conséquence concrète de l'action, ex. « Léa ne verra plus ton activité. » */
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** `destructive` pour blocage, retrait d'ami, suppression du compte. */
  tone?: "destructive" | "default";
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/** Feuille de confirmation (CA14). Le voile et « Annuler » ferment sans agir. */
export function ConfirmSheet({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel = "Annuler",
  tone = "destructive",
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmSheetProps) {
  const reduced = useReducedMotion();
  return (
    <Modal visible={visible} transparent animationType={reduced ? "fade" : "slide"} onRequestClose={onCancel}>
      <View style={styles.root}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel="Fermer sans rien changer"
        />
        <GlassCard tone="strong" style={styles.sheet} accessibilityViewIsModal>
          <View style={styles.grabber} accessibilityElementsHidden />
          <AppText variant="title3" accessibilityRole="header">
            {title}
          </AppText>
          <AppText variant="callout" color="textSecondary" style={styles.message}>
            {message}
          </AppText>
          <View style={styles.actions}>
            <Button label={confirmLabel} variant={tone === "destructive" ? "destructive" : "primary"} loading={loading} onPress={onConfirm} />
            <Button label={cancelLabel} variant="ghost" disabled={loading} onPress={onCancel} />
          </View>
        </GlassCard>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end", backgroundColor: lightColors.scrim },
  sheet: {
    margin: space[3],
    marginBottom: space[8],
    borderRadius: radius.xl,
  },
  grabber: {
    alignSelf: "center",
    width: 36,
    height: 5,
    borderRadius: radius.full,
    backgroundColor: lightColors.border,
    marginBottom: space[4],
  },
  message: { marginTop: space[2] },
  actions: { gap: space[2], marginTop: space[6] },
});
