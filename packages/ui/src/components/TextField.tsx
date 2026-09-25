import { forwardRef, useEffect, useState } from "react";
import { StyleSheet, TextInput, View, type TextInputProps } from "react-native";
import { announce } from "../a11y";
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
  // iOS n'a pas de région live : on annonce l'erreur dès qu'elle apparaît.
  useEffect(() => {
    if (error) announce(error);
  }, [error]);
  return (
    <View style={styles.root}>
      <AppText variant="subheadline" color="textSecondary" aria-hidden>
        {label}
      </AppText>
      <View
        style={[
          styles.box,
          focused && styles.focused,
          error ? styles.error : null,
          trailing ? styles.withTrailing : null,
          !editable && styles.disabled,
        ]}
      >
        <TextInput
          ref={ref}
          aria-label={label}
          accessibilityHint={note}
          aria-disabled={!editable}
          editable={editable}
          placeholderTextColor={lightColors.textSecondary}
          selectionColor={lightColors.accent}
          style={[textStyle("body"), styles.input, trailing ? styles.inputWithTrailing : null]}
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
          aria-live={error ? "polite" : undefined}
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
  // Bouton compact à droite : marge réduite pour qu'il reste dans le contour.
  withTrailing: { paddingRight: space[1] },
  // minWidth 0 : sans lui, la largeur intrinsèque du champ pousse `trailing` hors du contour (web).
  // Contour du navigateur supprimé : le focus est déjà marqué par la bordure 2 px `focus` du cadre.
  input: { flex: 1, minWidth: 0, paddingVertical: space[3], outlineWidth: 0 },
  inputWithTrailing: { paddingRight: space[2] },
});
