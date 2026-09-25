import { Stack } from "expo-router";

// Titre d'onglet en grand titre iOS natif, rétréci au défilement (DESIGN.md §0).
export default function AmisLayout() {
  return (
    <Stack
      screenOptions={{
        headerLargeTitle: true,
        headerTransparent: true,
        headerBlurEffect: "systemChromeMaterialLight",
      }}
    >
      <Stack.Screen name="index" options={{ title: "Amis" }} />
      <Stack.Screen name="[userId]" options={{ headerLargeTitle: false }} />
    </Stack>
  );
}
