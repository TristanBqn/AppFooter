import { StyleSheet, View } from "react-native";
import Svg from "react-native-svg";
import { space } from "../tokens";
import { AppText } from "./AppText";
import { LogoMarkShapes } from "./Illustration";

export type LogoProps = {
  /** Côté du symbole en pt. */
  size?: number;
  /** Affiche « Footer » sous le symbole. */
  withWordmark?: boolean;
};

/** Logo Footer (nuage + deux pas). Lu « Footer » par VoiceOver. */
export function Logo({ size = 120, withWordmark = true }: LogoProps) {
  return (
    <View role="img" aria-label="Footer" style={styles.root}>
      <Svg width={size} height={(size * LOGO_VIEWBOX_H) / LOGO_VIEWBOX_W} viewBox={`40 130 ${LOGO_VIEWBOX_W} ${LOGO_VIEWBOX_H}`} aria-hidden>
        <LogoMarkShapes />
      </Svg>
      {withWordmark ? (
        <AppText variant="largeTitle" role="none" aria-hidden>
          Footer
        </AppText>
      ) : null}
    </View>
  );
}

// Cadrage serré sur le nuage et le soleil (le repère 1024 garde des marges pour l'icône).
const LOGO_VIEWBOX_W = 940;
const LOGO_VIEWBOX_H = 680;

const styles = StyleSheet.create({
  root: { alignItems: "center", gap: space[2] },
});
