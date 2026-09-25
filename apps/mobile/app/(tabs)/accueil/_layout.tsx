import { Stack } from "expo-router";

// L'Accueil a son propre en-tête (date + salutation + engrenage Paramètres, voir M5/M9) :
// le header natif du Stack reste masqué sur l'écran d'index.
export default function AccueilLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="historique" options={{ title: "Ton historique" }} />
      <Stack.Screen name="encouragements" options={{ title: "Encouragements reçus" }} />
      <Stack.Screen name="parametres" options={{ title: "Paramètres" }} />
      <Stack.Screen name="comptes-bloques" options={{ title: "Comptes bloqués" }} />
      <Stack.Screen name="supprimer-compte" options={{ title: "Supprimer mon compte" }} />
    </Stack>
  );
}
