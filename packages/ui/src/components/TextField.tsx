import { forwardRef, useState } from "react";
import { StyleSheet, TextInput, View, type TextInputProps } from "react-native";
import { layout, lightColors, radius, space } from "../tokens";
import { AppText, textStyle } from "./AppText";

export type TextFieldProps = Omit<TextInputProps, "style" | "placeholderTextColor"> & {
  label: string;
  /** Aide permanente, ex. « 3 à 20 caractères : lettres minuscules, chiffres, _ et . ». */
  helper?: string;
  /** Message d'erreur qui dit quoi faire. Remplace l'aide quand il est présent. */
  error?: string;
  /** Élément à droite (bouton compact, indicateur). */
  trailing?: React.ReactNode;
};

/** Champ de saisie : libellé visible, contour 3:1, focus marqué, erreur lue par VoiceOver. */
export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, helper, error, trailing, onFocus, onBlur, editable = true, ...rest },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const note = error ?? helper;
  return (
    <View style={styles.root}>
      <AppText variant="subheadline" color="textSecondary" accessibilityElementsHidden importantForAccessibility="no">
        {label}
      </AppText>
      <View
        style={[
          styles.box,
          focused && styles.focused,
          error ? styles.error : null,
          !editable && styles.disabled,
        ]}
      >
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          accessibilityHint={note}
          accessibilityState={{ disabled: !editable }}
          editable={editable}
          placeholderTextColor={lightColors.textSecondary}
          selectionColor={lightColors.accent}
          style={[textStyle("body"), styles.input]}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...rest}
        />
        {trailing}
      </View>
      {note ? (
        <AppText
          variant="footnote"
          color={error ? "danger" : "textSecondary"}
          accessibilityLiveRegion={error ? "polite" : undefined}
        >
          {note}
        </AppText>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  root: { gap: space[2] },
  box: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[2],
    minHeight: layout.buttonHeight,
    paddingHorizontal: space[4],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: lightColors.borderStrong,
    backgroundColor: lightColors.surface,
  },
  focused: { borderColor: lightColors.focus, borderWidth: 2, paddingHorizontal: space[4] - 1 },
  error: { borderColor: lightColors.danger, borderWidth: 2, paddingHorizontal: space[4] - 1 },
  disabled: { backgroundColor: lightColors.surfaceOpaque },
  input: { flex: 1, paddingVertical: space[3] },
});
