import { Stack } from "expo-router";

// Titre d'onglet en grand titre iOS natif, rétréci au défilement (DESIGN.md §0).
export default function ClassementLayout() {
  return (
    <Stack
      screenOptions={{
        headerLargeTitle: true,
        headerTransparent: true,
        headerBlurEffect: "systemChromeMaterialLight",
      }}
    >
      <Stack.Screen name="index" options={{ title: "Classement" }} />
    </Stack>
  );
}
