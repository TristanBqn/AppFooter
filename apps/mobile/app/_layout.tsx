import "../global.css";

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "../src/api/queryClient";

// Racine de la navigation : un seul Stack qui héberge les 3 onglets.
// Chaque onglet gère ensuite ses propres écrans poussés (fiche ami, paramètres...).
// Le retour à l'écran de connexion sur session expirée (authEvents.onUnauthorized) sera câblé
// avec les écrans de connexion (M4).
export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
        </Stack>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
