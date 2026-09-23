import { describe, expect, it } from "vitest";
import { composite, contrastRatio, parseColor, toRgbaString } from "./color";
import { footerPreset } from "./tailwind-preset";
import { gradients, layout, lightColors, motion, radius, skyStops, space, typography, type ColorToken } from "./tokens";

const AA_TEXT = 4.5;
const AA_GRAPHIC = 3;

/** Toutes les surfaces sur lesquelles du texte peut être posé, verre composité sur chaque teinte du ciel. */
const textSurfaces: Array<[string, string]> = [
  ...skyStops.map((s): [string, string] => [`ciel ${s}`, s]),
  ...skyStops.map((s): [string, string] => [`verre sur ${s}`, toRgbaString(composite(lightColors.glass, s))]),
  ...skyStops.map((s): [string, string] => [`verre fort sur ${s}`, toRgbaString(composite(lightColors.glassStrong, s))]),
  ["surface", lightColors.surface],
  ["surface opaque", lightColors.surfaceOpaque],
  ["surlignage « moi » sur verre", toRgbaString(composite(lightColors.highlight, toRgbaString(composite(lightColors.glass, skyStops[0]))))],
];

const textTokens: ColorToken[] = ["text", "textSecondary", "accentText", "success", "danger", "warning"];

describe("color utils", () => {
  it("calcule les ratios de référence WCAG", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
    expect(contrastRatio("#FFFFFF", "#FFFFFF")).toBeCloseTo(1, 5);
  });
  it("compose une couleur translucide", () => {
    expect(composite("rgba(255, 255, 255, 0.5)", "#000000")).toEqual({ r: 128, g: 128, b: 128, a: 1 });
    expect(parseColor("rgba(1, 2, 3, 0.4)").a).toBe(0.4);
  });
});

describe("contrastes AA", () => {
  for (const token of textTokens) {
    for (const [name, bg] of textSurfaces) {
      it(`${token} sur ${name} >= 4,5:1`, () => {
        expect(contrastRatio(lightColors[token], bg)).toBeGreaterThanOrEqual(AA_TEXT);
      });
    }
  }

  const pairs: Array<[string, string, string]> = [
    ["texte blanc sur accent", lightColors.textOnAccent, lightColors.accent],
    ["texte blanc sur accent pressé", lightColors.textOnAccent, lightColors.accentPressed],
    ["accentText sur accentSoft (bouton secondaire)", lightColors.accentText, lightColors.accentSoft],
    ["accentText sur accentSoftPressed", lightColors.accentText, lightColors.accentSoftPressed],
    ["textSecondary sur accentSoft (bouton désactivé)", lightColors.textSecondary, lightColors.accentSoft],
    ["danger sur dangerSoft (bouton destructif)", lightColors.danger, lightColors.dangerSoft],
    ["danger sur dangerSoftPressed", lightColors.danger, lightColors.dangerSoftPressed],
    ["success sur successSoft (toast)", lightColors.success, lightColors.successSoft],
    ["warning sur warningSoft", lightColors.warning, lightColors.warningSoft],
    ["texte sur pastille soleil (1er rang)", lightColors.text, lightColors.sun],
    ["texte blanc sur puce sélectionnée", lightColors.textOnAccent, lightColors.accent],
  ];
  for (const [name, fg, bg] of pairs) {
    it(`${name} >= 4,5:1`, () => {
      expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(AA_TEXT);
    });
  }

  const glassOnSky = skyStops.map((s) => toRgbaString(composite(lightColors.glass, s)));
  for (const token of ["progressStart", "progressEnd", "borderStrong", "focus"] as const) {
    it(`${token} (graphique) >= 3:1 sur verre et surface`, () => {
      for (const bg of [...glassOnSky, lightColors.surface]) {
        expect(contrastRatio(lightColors[token], bg)).toBeGreaterThanOrEqual(AA_GRAPHIC);
      }
    });
  }
});

describe("échelles", () => {
  it("espacements en base 4", () => {
    for (const v of Object.values(space)) expect(v % 4).toBe(0);
  });
  it("zones tactiles >= 44", () => {
    expect(layout.minTouch).toBeGreaterThanOrEqual(44);
    expect(layout.buttonHeight).toBeGreaterThanOrEqual(44);
  });
  it("coins très arrondis (cartes >= 24)", () => {
    expect(radius.lg).toBeGreaterThanOrEqual(24);
  });
  it("corps de texte >= 17 (taille iOS par défaut) et interlignage > taille", () => {
    expect(typography.body.fontSize).toBeGreaterThanOrEqual(17);
    for (const t of Object.values(typography)) expect(t.lineHeight).toBeGreaterThan(t.fontSize);
  });
  it("seuls les très grands textes plafonnent Dynamic Type", () => {
    for (const t of Object.values(typography)) {
      if ("maxScale" in t) expect(t.fontSize).toBeGreaterThanOrEqual(28);
    }
  });
  it("les durées réduites ne dépassent jamais les durées normales", () => {
    for (const k of Object.keys(motion.duration) as Array<keyof typeof motion.duration>) {
      expect(motion.reduced[k]).toBeLessThanOrEqual(motion.duration[k]);
      expect(motion.reduced[k]).toBeLessThanOrEqual(120);
    }
  });
  it("dégradés : autant de positions que de couleurs", () => {
    for (const g of Object.values(gradients)) expect(g.locations.length).toBe(g.colors.length);
  });
});

describe("preset NativeWind", () => {
  it("expose couleurs, tailles et rayons des tokens", () => {
    const ext = footerPreset.theme.extend;
    expect(ext.colors.accent).toBe(lightColors.accent);
    expect(ext.fontSize.body).toEqual(["17px", { lineHeight: "22px", fontWeight: "400" }]);
    expect(ext.borderRadius.lg).toBe(`${radius.lg}px`);
    expect(ext.spacing.touch).toBe("44px");
  });
});
