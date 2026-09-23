import { ScrollView } from "react-native";
import { AppText, GlassCard, SkyBackground } from "@app/ui";

// Écran vide (M1). Classement quotidien / hebdomadaire réel : M6.
export default function ClassementScreen() {
  return (
    <SkyBackground variant="sky">
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 20 }}>
        <GlassCard>
          <AppText variant="body" color="textSecondary">
            Le classement de tes amis s'affichera bientôt ici.
          </AppText>
        </GlassCard>
      </ScrollView>
    </SkyBackground>
  );
}
