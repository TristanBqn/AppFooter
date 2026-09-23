import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, View, type LayoutChangeEvent } from "react-native";
import { nativeDriver, useMotionDuration } from "../a11y";
import { layout, lightColors, radius, shadow, space } from "../tokens";
import { AppText } from "./AppText";

export type SegmentOption<T extends string> = { value: T; label: string };

export type SegmentedControlProps<T extends string> = {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Libellé VoiceOver du groupe, ex. « Période du classement ». */
  accessibilityLabel: string;
};

/** Bascule en un geste (ex. Aujourd'hui / Cette semaine). */
export function SegmentedControl<T extends string>({ options, value, onChange, accessibilityLabel }: SegmentedControlProps<T>) {
  const duration = useMotionDuration("fast");
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const segment = options.length > 0 ? width / options.length : 0;
  const x = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(x, { toValue: index * segment, duration, useNativeDriver: nativeDriver }).start();
  }, [x, index, segment, duration]);

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width - PAD * 2);

  return (
    <View role="tablist" aria-label={accessibilityLabel} style={styles.root} onLayout={onLayout}>
      {segment > 0 ? (
        <Animated.View style={[styles.thumb, { width: segment, transform: [{ translateX: x }] }]} />
      ) : null}
      {options.map((o, i) => {
        const selected = i === index;
        return (
          <Pressable
            key={o.value}
            role="tab"
            aria-label={o.label}
            aria-selected={selected}
            accessibilityHint={`${i + 1} sur ${options.length}`}
            onPress={() => !selected && onChange(o.value)}
            style={[styles.segment, selected && segment === 0 ? styles.selectedStatic : null]}
          >
            <AppText variant="headline" color={selected ? "text" : "textSecondary"} maxFontSizeMultiplier={1.8} style={styles.label}>
              {o.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const PAD = space[1];

const styles = StyleSheet.create({
  root: {
    flexDirection: "row",
    padding: PAD,
    borderRadius: radius.full,
    backgroundColor: lightColors.progressTrack,
  },
  thumb: {
    position: "absolute",
    top: PAD,
    bottom: PAD,
    left: PAD,
    borderRadius: radius.full,
    backgroundColor: lightColors.surface,
    boxShadow: shadow.subtle.css,
  },
  segment: {
    flex: 1,
    minHeight: layout.minTouch,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space[3],
  },
  // Avant la mesure (premier rendu, rendu serveur) : fond direct sur le segment choisi.
  selectedStatic: { backgroundColor: lightColors.surface, borderRadius: radius.full, boxShadow: shadow.subtle.css },
  label: { textAlign: "center" },
});
