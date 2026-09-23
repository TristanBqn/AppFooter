import { ScrollView } from "react-native";
import { AppText, GlassCard, SkyBackground } from "@app/ui";

// Écran vide (M1). Liste d'amis, demandes et ajout par pseudo réels : M7.
export default function AmisScreen() {
  return (
    <SkyBackground variant="sky">
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 20 }}>
        <GlassCard>
          <AppText variant="body" color="textSecondary">
            Tes amis s'afficheront bientôt ici.
          </AppText>
        </GlassCard>
      </ScrollView>
    </SkyBackground>
  );
}
