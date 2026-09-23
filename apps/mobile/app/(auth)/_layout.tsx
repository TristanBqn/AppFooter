import { Redirect, Stack } from "expo-router";
import { useAuth } from "../../src/auth/AuthProvider";

export default function AuthLayout() {
  const { stage } = useAuth();
  // Filet de sécurité : si on est déjà pleinement connecté (retour arrière, lien profond...),
  // on ne montre pas la connexion/le pseudo/le consentement une seconde fois.
  if (stage === "ready") {
    return <Redirect href="/(tabs)/accueil" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="connexion" />
      <Stack.Screen name="pseudo" />
      <Stack.Screen name="consentement" />
    </Stack>
  );
}
