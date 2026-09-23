import type { ReactNode } from "react";
import { Pressable, StyleSheet, Switch, View } from "react-native";
import { layout, lightColors, space, type ColorToken } from "../tokens";
import { AppText } from "./AppText";

type Base = {
  title: string;
  subtitle?: string;
  /** Élément à gauche (Monogram, icône décorative). */
  leading?: ReactNode;
  titleColor?: ColorToken;
};

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
export function ListRow({ title, subtitle, leading, titleColor = "text", value, trailing, onPress, accessibilityHint }: ListRowProps) {
  const label = [title, subtitle, value].filter(Boolean).join(", ");
  const content = (
    <>
      {leading}
      <RowText title={title} subtitle={subtitle} titleColor={titleColor} />
      {value ? (
        <AppText variant="body" color="textSecondary">
          {value}
        </AppText>
      ) : null}
      {onPress && !trailing ? (
        <AppText variant="headline" color="textSecondary" accessibilityElementsHidden importantForAccessibility="no">
          ›
        </AppText>
      ) : null}
    </>
  );

  if (trailing) {
    return (
      <View style={styles.row}>
        <View style={styles.inline} accessible accessibilityLabel={[title, subtitle].filter(Boolean).join(", ")}>
          {leading}
          <RowText title={title} subtitle={subtitle} titleColor={titleColor} />
        </View>
        <View style={styles.trailing}>{trailing}</View>
      </View>
    );
  }

  if (!onPress) {
    return (
      <View style={styles.row} accessible accessibilityLabel={label}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

export type SwitchRowProps = Base & {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
};

/** Ligne avec interrupteur iOS natif (paramètres). Le titre et le sous-titre forment le libellé VoiceOver. */
export function SwitchRow({ title, subtitle, leading, titleColor = "text", value, onValueChange, disabled }: SwitchRowProps) {
  return (
    <View style={styles.row}>
      {leading}
      <View style={styles.body} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <RowText title={title} subtitle={subtitle} titleColor={titleColor} />
      </View>
      <Switch
        accessibilityLabel={title}
        accessibilityHint={subtitle}
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ true: lightColors.accent, false: lightColors.progressTrack }}
        ios_backgroundColor={lightColors.progressTrack}
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
  body: { flex: 1, gap: space[1] / 2 },
  trailing: { flexDirection: "row", gap: space[2], flexWrap: "wrap", justifyContent: "flex-end" },
});
