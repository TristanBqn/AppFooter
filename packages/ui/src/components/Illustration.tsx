import { View } from "react-native";
import Svg, { Circle, G, Path } from "react-native-svg";
import { lightColors } from "../tokens";

/** Nuage principal du logo et des illustrations (repère 1024, voir assets/icon.svg). */
export const LOGO_CLOUD =
  "M232 780a150 150 0 0 1-18-299a190 190 0 0 1 360-86a150 150 0 0 1 250 70a130 130 0 0 1 -14 315z";
/** Petit nuage (160 x 60). */
const PUFF = "M30 60a30 30 0 0 1 0-60c8 0 15 3 20 8a38 38 0 0 1 68 6a24 24 0 0 1 12-3a24 24 0 0 1 0 49z";
/** Empreinte de pied droit, repère 0..22 x -10..40. */
const SOLE =
  "M11 0C17.5 0 21.5 5.5 21.5 13C21.5 19.5 18.5 23.5 18.5 29.5C18.5 35.5 15 40 10 40C5 40 2.5 35.5 2.5 30.5C2.5 24.5 0.5 19.5 0.5 12.5C0.5 5 4.5 0 11 0Z";
const TOES: ReadonlyArray<readonly [number, number, number]> = [
  [4.6, -4.6, 3.4],
  [10.4, -6.6, 2.7],
  [15.2, -5.8, 2.3],
  [19, -3.4, 2],
  [21.8, 0.2, 1.7],
];

export function Foot({ transform, fill = lightColors.accent }: { transform: string; fill?: string }) {
  return (
    <G transform={transform} fill={fill}>
      <Path d={SOLE} />
      {TOES.map(([cx, cy, r]) => (
        <Circle key={cx} cx={cx} cy={cy} r={r} />
      ))}
    </G>
  );
}

/** Symbole Footer : nuage + deux pas (+ soleil). Repère 1024. */
export function LogoMarkShapes({ cloud = lightColors.accentSoft }: { cloud?: string }) {
  return (
    <>
      <Circle cx={760} cy={250} r={92} fill={lightColors.sun} />
      <Path d={LOGO_CLOUD} fill={cloud} />
      <Foot transform="translate(380 585) rotate(-14) scale(-5.6 5.6) translate(-11 -16)" />
      <Foot transform="translate(592 525) rotate(-14) scale(5.6) translate(-11 -16)" />
    </>
  );
}

export type IllustrationKind =
  | "sunrise" // onboarding 1, Santé non connectée
  | "together" // onboarding 2, amis vides
  | "privacy" // consentement
  | "calm" // état vide générique, historique vide
  | "offline" // erreur réseau
  | "farewell"; // suppression du compte

export type IllustrationProps = { kind: IllustrationKind; width?: number };

/** Illustrations douces (ciel, nuages, soleil) des états vides. Décoratives : masquées à VoiceOver. */
export function Illustration({ kind, width = 200 }: IllustrationProps) {
  const height = width * 0.6;
  return (
    <View aria-hidden style={{ width, height }}>
      <Svg width={width} height={height} viewBox="0 0 200 120">
        {SCENES[kind]}
      </Svg>
    </View>
  );
}

const c = lightColors;

const SCENES: Record<IllustrationKind, React.ReactNode> = {
  sunrise: (
    <>
      <Path d="M50 100a50 50 0 0 1 100 0z" fill={c.sunGlow} />
      <Path d="M68 100a32 32 0 0 1 64 0z" fill={c.sun} />
      <Path d={PUFF} fill={c.accentSoft} transform="translate(14 70) scale(0.62)" />
      <Path d={PUFF} fill={c.surface} transform="translate(104 76) scale(0.55)" />
    </>
  ),
  together: (
    <>
      <Circle cx={160} cy={28} r={16} fill={c.sun} />
      <Path d={PUFF} fill={c.accentSoft} transform="translate(18 44) scale(0.72)" />
      <Path d={PUFF} fill={c.cloudShade} transform="translate(92 58) scale(0.62)" />
      <Foot transform="translate(70 62) rotate(-10) scale(-0.9 0.9)" />
      <Foot transform="translate(122 78) rotate(-10) scale(0.8)" />
    </>
  ),
  privacy: (
    <>
      <Path d={PUFF} fill={c.accentSoft} transform="translate(30 36) scale(0.9)" />
      <Path
        d="M100 54c-6-8-20-6-20 5c0 10 14 18 20 24c6-6 20-14 20-24c0-11-14-13-20-5z"
        fill={c.accent}
      />
      <Circle cx={168} cy={22} r={12} fill={c.sun} />
    </>
  ),
  calm: (
    <>
      <Circle cx={150} cy={34} r={20} fill={c.sun} />
      <Path d={PUFF} fill={c.accentSoft} transform="translate(26 44) scale(0.85)" />
      <Path d={PUFF} fill={c.cloudShade} opacity={0.6} transform="translate(120 78) scale(0.35)" />
    </>
  ),
  offline: (
    <>
      <Path d={PUFF} fill={c.accentSoft} transform="translate(30 30) scale(0.9)" />
      <Path
        d="M70 100h60"
        stroke={c.accent}
        strokeWidth={4}
        strokeLinecap="round"
        strokeDasharray="2 10"
      />
    </>
  ),
  farewell: (
    <>
      <Path d={PUFF} fill={c.accentSoft} opacity={0.5} transform="translate(8 60) scale(0.4)" />
      <Path d={PUFF} fill={c.accentSoft} opacity={0.75} transform="translate(56 48) scale(0.55)" />
      <Path d={PUFF} fill={c.accentSoft} transform="translate(100 30) scale(0.6)" />
      <Circle cx={176} cy={20} r={10} fill={c.sun} />
    </>
  ),
};
