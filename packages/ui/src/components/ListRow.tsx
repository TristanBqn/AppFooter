import type { ReactNode } from "react";
import { Pressable, StyleSheet, Switch, View } from "react-native";
import { layout, lightColors, radius, space, type ColorToken } from "../tokens";
import { AppText } from "./AppText";

type Base = {
  title: string;
  subtitle?: string;
  /** Élément à gauche (Monogram, `SunBadge`…). Décoratif : masqué à VoiceOver. */
  leading?: ReactNode;
  /** Sens de `leading` s'il porte une information, ajouté au libellé VoiceOver (ex. « palier de 10 000 franchi »). */
  leadingLabel?: string;
  titleColor?: ColorToken;
};

/** Emplacement de tête, toujours masqué à VoiceOver (le sens éventuel passe par `leadingLabel`). */
function Leading({ children }: { children?: ReactNode }) {
  if (children == null || children === false) return null;
  return (
    <View aria-hidden style={styles.leading}>
      {children}
    </View>
  );
}

/** Pastille soleil décorative (ex. jour où le palier de 10 000 pas est franchi). */
export function SunBadge() {
  return <View aria-hidden style={styles.sunBadge} />;
}

function RowText({ title, subtitle, titleColor }: Pick<Base, "title" | "subtitle"> & { titleColor: ColorToken }) {
  return (
    <View style={styles.body}>
      <AppText variant="body" color={titleColor}>
        {title}
      </AppText>
      {subtitle ? (
        <AppText variant="footnote" color="textSecondary">
          {subtitle}
        </AppText>
      ) : null}
    </View>
  );
}

export type ListRowProps = Base & {
  /** Valeur courte à droite, ex. « 22 h – 8 h ». */
  value?: string;
  /** Actions à droite (boutons compacts). Rend la ligne non pressable. */
  trailing?: ReactNode;
  onPress?: () => void;
  accessibilityHint?: string;
};

/** Ligne de liste (amis, demandes, paramètres). Chevron affiché si pressable. */
export function ListRow({
  title,
  subtitle,
  leading,
  leadingLabel,
  titleColor = "text",
  value,
  trailing,
  onPress,
  accessibilityHint,
}: ListRowProps) {
  const label = [title, subtitle, value, leadingLabel].filter(Boolean).join(", ");
  const content = (
    <>
      <Leading>{leading}</Leading>
      <RowText title={title} subtitle={subtitle} titleColor={titleColor} />
      {value ? (
        <AppText variant="body" color="textSecondary">
          {value}
        </AppText>
      ) : null}
      {onPress && !trailing ? (
        <AppText variant="headline" color="textSecondary" aria-hidden>
          ›
        </AppText>
      ) : null}
    </>
  );

  if (trailing) {
    return (
      <View style={styles.row}>
        <View style={styles.inline} accessible aria-label={[title, subtitle, leadingLabel].filter(Boolean).join(", ")}>
          <Leading>{leading}</Leading>
          <RowText title={title} subtitle={subtitle} titleColor={titleColor} />
        </View>
        <View style={styles.trailing}>{trailing}</View>
      </View>
    );
  }

  if (!onPress) {
    return (
      <View style={styles.row} accessible aria-label={label}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      role="button"
      aria-label={label}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

export type SwitchRowProps = Omit<Base, "leadingLabel"> & {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
};

/** Ligne avec interrupteur iOS natif (paramètres). Le titre et le sous-titre forment le libellé VoiceOver. */
export function SwitchRow({ title, subtitle, leading, titleColor = "text", value, onValueChange, disabled }: SwitchRowProps) {
  return (
    <View style={styles.row}>
      <Leading>{leading}</Leading>
      <View style={styles.body} aria-hidden>
        <RowText title={title} subtitle={subtitle} titleColor={titleColor} />
      </View>
      <Switch
        aria-label={title}
        accessibilityHint={subtitle}
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ true: lightColors.accent, false: lightColors.progressTrack }}
        ios_backgroundColor={lightColors.progressTrack}
        thumbColor={lightColors.surface}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[3],
    minHeight: layout.minTouch + space[2],
    paddingVertical: space[3],
  },
  inline: { flex: 1, flexDirection: "row", alignItems: "center", gap: space[3] },
  pressed: { opacity: 0.6 },
  leading: { alignItems: "center", justifyContent: "center" },
  sunBadge: {
    width: space[3],
    height: space[3],
    borderRadius: radius.full,
    backgroundColor: lightColors.sun,
    borderWidth: 1.5,
    borderColor: lightColors.warning,
  },
  body: { flex: 1, gap: space[1] / 2 },
  trailing: { flexDirection: "row", gap: space[2], flexWrap: "wrap", justifyContent: "flex-end" },
});
