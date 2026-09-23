import { Redirect } from "expo-router";
import { View } from "react-native";
import { ErrorState, LoadingState, SkyBackground } from "@app/ui";
import { useAuth } from "../src/auth/AuthProvider";

// Seul point de décision du routage : redirige vers l'onboarding/connexion/pseudo/consentement
// ou l'accueil selon l'état d'authentification (AuthProvider).
export default function Index() {
  const { stage, refresh } = useAuth();

  switch (stage) {
    case "loading":
      return (
        <SkyBackground variant="dawn">
          <View style={{ flex: 1, justifyContent: "center", padding: 20 }}>
            <LoadingState accessibilityLabel="Chargement de Footer" />
          </View>
        </SkyBackground>
      );
    case "error":
      return (
        <SkyBackground variant="dawn">
          <View style={{ flex: 1, justifyContent: "center" }}>
            <ErrorState message="Vérifie ta connexion puis réessaie." onRetry={refresh} />
          </View>
        </SkyBackground>
      );
    case "onboarding":
      return <Redirect href="/(auth)/onboarding" />;
    case "sessionExpired":
      return <Redirect href="/(auth)/connexion" />;
    case "needsUsername":
      return <Redirect href="/(auth)/pseudo" />;
    case "ready":
      return <Redirect href="/(tabs)/accueil" />;
  }
}
