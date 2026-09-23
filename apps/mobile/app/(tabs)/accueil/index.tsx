import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppText, GlassCard, SkyBackground } from "@app/ui";

// Écran d'accueil vide (M1). Contenu réel (anneau de pas, rang, prochain ami...) : M5.
export default function AccueilScreen() {
  return (
    <SkyBackground variant="sky">
      <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
          <AppText variant="largeTitle">Accueil</AppText>
          <GlassCard>
            <AppText variant="body" color="textSecondary">
              Ton activité du jour s'affichera bientôt ici.
            </AppText>
          </GlassCard>
        </ScrollView>
      </SafeAreaView>
    </SkyBackground>
  );
}
