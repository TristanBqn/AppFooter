import { Redirect, Stack, useSegments } from "expo-router";
import { useAuth } from "../../src/auth/AuthProvider";

export default function AuthLayout() {
  const { stage } = useAuth();
  const segments = useSegments();
  // Le consentement est montré une fois, juste après le choix du pseudo (authStage.ts) : ce n'est
  // pas un état de la machine d'authentification, donc `stage` passe déjà à "ready" dès que le
  // pseudo est choisi (avant même que l'écran de consentement ne s'affiche). Sans cette exception,
  // le filet de sécurité ci-dessous court-circuiterait systématiquement la navigation vers
  // "/(auth)/consentement" faite par app/(auth)/pseudo.tsx.
  const showingConsent = segments[segments.length - 1] === "consentement";

  // Filet de sécurité : si on est déjà pleinement connecté (retour arrière, lien profond...),
  // on ne montre pas la connexion/le pseudo une seconde fois.
  if (stage === "ready" && !showingConsent) {
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
