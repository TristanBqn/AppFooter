// Preset Tailwind pour NativeWind (v4, Tailwind 3.x). Pur TypeScript, sans React Native.
// Usage dans apps/mobile/tailwind.config.ts :
//   import { footerPreset } from "@app/ui/tailwind-preset";
//   export default { presets: [require("nativewind/preset"), footerPreset], content: [...] };
import { fontFamily, layout, lightColors, radius, shadow, space, typography } from "./tokens";

const fontSize = Object.fromEntries(
  Object.entries(typography).map(([name, t]) => [
    name,
    [`${t.fontSize}px`, { lineHeight: `${t.lineHeight}px`, fontWeight: t.fontWeight }],
  ]),
);

const px = (record: Record<string | number, number>) =>
  Object.fromEntries(Object.entries(record).map(([k, v]) => [k, `${v}px`]));

export const footerPreset = {
  theme: {
    extend: {
      colors: { ...lightColors },
      fontFamily: { sans: [fontFamily.text], rounded: [fontFamily.rounded] },
      fontSize,
      spacing: {
        ...px(space),
        screen: `${layout.screenPadding}px`,
        card: `${layout.cardPadding}px`,
        touch: `${layout.minTouch}px`,
      },
      borderRadius: px(radius),
      minHeight: { touch: `${layout.minTouch}px` },
      minWidth: { touch: `${layout.minTouch}px` },
      boxShadow: {
        subtle: shadow.subtle.css,
        soft: shadow.soft.css,
        float: shadow.float.css,
      },
    },
  },
};

export default footerPreset;
