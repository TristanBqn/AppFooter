import type { Config } from "tailwindcss";
import nativewindPreset from "nativewind/preset";
import { footerPreset } from "@app/ui/tailwind-preset";

export default {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  presets: [nativewindPreset, footerPreset],
  theme: { extend: {} },
  plugins: [],
} satisfies Config;
