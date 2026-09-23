import { useRef, useState } from "react";
import { Dimensions, ScrollView, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { router } from "expo-router";
import { AppText, Button, SkyBackground } from "@app/ui";
import { lightColors } from "@app/ui/tokens";

// Onboarding (2 pages, DESIGN.md §1) : la page 3 (consentement santé) est un écran séparé,
// affiché après la connexion Apple et le choix du pseudo (précision du lead).
const PAGES = [
  {
    title: "Marche, tout simplement",
    text: "Footer compte tes pas et te propose une petite compétition amicale avec tes proches.",
  },
  {
    title: "Entre proches, sans pression",
    text: "Tu ne vois que tes amis, et eux ne voient que toi. Pas de classement public.",
  },
] as const;

export default function OnboardingScreen() {
  const [page, setPage] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const { width } = Dimensions.get("window");

  function goToConnexion() {
    router.replace("/(auth)/connexion");
  }

  function next() {
    if (page < PAGES.length - 1) {
      const nextPage = page + 1;
      scrollRef.current?.scrollTo({ x: nextPage * width, animated: true });
      setPage(nextPage);
    } else {
      goToConnexion();
    }
  }

  function onMomentumScrollEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    setPage(Math.round(event.nativeEvent.contentOffset.x / width));
  }

  return (
    <SkyBackground variant="dawn">
      <View className="flex-1 pt-16">
        <View className="flex-row justify-end px-screen">
          <Button label="Passer" variant="ghost" onPress={goToConnexion} accessibilityLabel="Passer l'introduction" />
        </View>

        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onMomentumScrollEnd}
        >
          {PAGES.map((p, index) => (
            <View
              key={p.title}
              style={{ width }}
              className="flex-1 items-center justify-center gap-4 px-8"
              accessible
              accessibilityLabel={`Page ${index + 1} sur ${PAGES.length}. ${p.title}. ${p.text}`}
            >
              <AppText variant="title1" style={{ textAlign: "center" }}>
                {p.title}
              </AppText>
              <AppText variant="callout" color="textSecondary" style={{ textAlign: "center" }}>
                {p.text}
              </AppText>
            </View>
          ))}
        </ScrollView>

        <View className="flex-row justify-center gap-2 mb-4" aria-hidden>
          {PAGES.map((p, index) => (
            <View
              key={p.title}
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: index === page ? lightColors.accent : lightColors.accentSoft }}
            />
          ))}
        </View>

        <View className="px-screen pb-6">
          <Button label="Continuer" onPress={next} />
        </View>
      </View>
    </SkyBackground>
  );
}
