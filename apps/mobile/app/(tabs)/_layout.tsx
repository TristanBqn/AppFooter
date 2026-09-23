import { Tabs } from "expo-router";
import { SymbolView } from "expo-symbols";
import { lightColors } from "@app/ui/tokens";
import type { ComponentProps } from "react";
import type { ColorValue } from "react-native";

type TabIconProps = { color: ColorValue; size: number; focused: boolean };

function tabIcon(name: ComponentProps<typeof SymbolView>["name"]) {
  return function TabIcon({ color, size }: TabIconProps) {
    return <SymbolView name={name} tintColor={color} size={size} weight="regular" />;
  };
}

// 3 onglets fixes (DESIGN.md §4/§7) : Accueil, Classement, Amis. Chaque onglet est un Stack
// (voir app/(tabs)/<onglet>/_layout.tsx) pour accueillir les écrans poussés à venir.
export default function TabsLayout() {
  return (
    <Tabs
      initialRouteName="accueil"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: lightColors.accent,
        tabBarInactiveTintColor: lightColors.textSecondary,
      }}
    >
      <Tabs.Screen
        name="accueil"
        options={{
          title: "Accueil",
          tabBarIcon: tabIcon("house.fill"),
          tabBarAccessibilityLabel: "Accueil",
        }}
      />
      <Tabs.Screen
        name="classement"
        options={{
          title: "Classement",
          tabBarIcon: tabIcon("chart.bar.fill"),
          tabBarAccessibilityLabel: "Classement",
        }}
      />
      <Tabs.Screen
        name="amis"
        options={{
          title: "Amis",
          tabBarIcon: tabIcon("person.2.fill"),
          // La pastille numérique (demandes reçues) sera ajoutée avec les données amis (M7).
          tabBarAccessibilityLabel: "Amis",
        }}
      />
    </Tabs>
  );
}
