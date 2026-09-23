import type { ReactNode } from "react";
import { Platform, Text, type TextProps, type TextStyle } from "react-native";
import { fontFamily, fontFamilyWeb, lightColors, typography, type ColorToken, type TypographyToken } from "../tokens";

export function textStyle(variant: TypographyToken, color: ColorToken = "text"): TextStyle {
  const t = typography[variant];
  return {
    fontFamily: (Platform.OS === "web" ? fontFamilyWeb : fontFamily)[t.family],
    fontSize: t.fontSize,
    lineHeight: t.lineHeight,
    fontWeight: t.fontWeight,
    color: lightColors[color],
    ...("tabular" in t && t.tabular ? { fontVariant: ["tabular-nums"] } : null),
  };
}

export type AppTextProps = TextProps & {
  variant?: TypographyToken;
  color?: ColorToken;
  children?: ReactNode;
};

/** Texte Footer : style de texte iOS + Dynamic Type (plafonné seulement pour les très grands chiffres). */
export function AppText({ variant = "body", color = "text", style, maxFontSizeMultiplier, ...rest }: AppTextProps) {
  const t = typography[variant];
  const cap = "maxScale" in t ? t.maxScale : undefined;
  const isHeading = variant === "largeTitle" || variant === "title1" || variant === "title2";
  return (
    <Text
      role={isHeading ? "heading" : undefined}
      maxFontSizeMultiplier={maxFontSizeMultiplier ?? cap}
      style={[textStyle(variant, color), style]}
      {...rest}
    />
  );
}
