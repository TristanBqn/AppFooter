import { Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { formatRankLabel, formatSteps, rankAccessibilityLabel } from "../format";
import { layout, lightColors, radius, space } from "../tokens";
import { AppText } from "./AppText";
import { Monogram } from "./Monogram";
import { LARGE_TEXT_SCALE } from "./StepRing";

export type RankRowProps = {
  /** Rang fourni par l'API (égalités : 1, 2, 2, 4). */
  rank: number;
  /** Vrai si un autre participant partage ce rang (voir `markTies`). */
  tied: boolean;
  name: string;
  steps: number;
  isMe?: boolean;
  /** Ouvre le profil de l'ami. Absent pour sa propre ligne. */
  onPress?: () => void;
};

/**
 * Ligne de classement. Aucun traitement visuel négatif pour les derniers rangs ;
 * le 1er rang reçoit seulement une pastille « soleil » discrète. « ex æquo » s'affiche sous le rang.
 */
export function RankRow({ rank, tied, name, steps, isMe = false, onPress }: RankRowProps) {
  const { fontScale } = useWindowDimensions();
  const stacked = fontScale >= LARGE_TEXT_SCALE;
  const label = rankAccessibilityLabel({ rank, tied, name, steps, isMe });

  return (
    <Pressable
      accessible
      role={onPress ? "button" : undefined}
      aria-label={label}
      accessibilityHint={onPress ? "Ouvre son activité" : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.row, isMe && styles.me, pressed && styles.pressed]}
    >
      <View style={styles.rankColumn}>
        <View style={[styles.badge, rank === 1 && styles.badgeFirst]}>
          <AppText variant="subheadline" style={styles.badgeText} maxFontSizeMultiplier={1.6}>
            {formatRankLabel(rank, false)}
          </AppText>
        </View>
        {tied ? (
          <AppText variant="caption" color="textSecondary" maxFontSizeMultiplier={1.6}>
            ex æquo
          </AppText>
        ) : null}
      </View>
      <Monogram name={name} tone={isMe ? "surface" : "soft"} />
      <View style={[styles.body, stacked && styles.bodyStacked]}>
        <View style={styles.nameLine}>
          <AppText variant="headline" numberOfLines={stacked ? undefined : 1} style={styles.name}>
            {name}
          </AppText>
          {isMe ? <Tag text="toi" /> : null}
        </View>
        <AppText variant="number" color={isMe ? "accentText" : "text"}>
          {formatSteps(steps)}
        </AppText>
      </View>
    </Pressable>
  );
}

function Tag({ text }: { text: string }) {
  return (
    <View style={styles.tag}>
      <AppText variant="caption" color="accentText">
        {text}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[3],
    minHeight: layout.minTouch + space[4],
    paddingVertical: space[3],
    paddingHorizontal: space[4],
    borderRadius: radius.md,
  },
  me: { backgroundColor: lightColors.highlight },
  pressed: { backgroundColor: lightColors.highlight },
  rankColumn: { minWidth: 56, alignItems: "center" },
  badge: {
    minWidth: 40,
    paddingHorizontal: space[2],
    paddingVertical: space[1],
    borderRadius: radius.full,
    alignItems: "center",
  },
  badgeFirst: { backgroundColor: lightColors.sun },
  badgeText: { fontWeight: "600" },
  body: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space[2] },
  bodyStacked: { flexDirection: "column", alignItems: "flex-start" },
  nameLine: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: space[2], flexShrink: 1 },
  name: { flexShrink: 1 },
  tag: {
    backgroundColor: lightColors.surface,
    borderRadius: radius.full,
    paddingHorizontal: space[2],
    paddingVertical: space[1] / 2,
  },
});
