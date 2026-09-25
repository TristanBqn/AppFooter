import { Tabs } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useQuery } from "@tanstack/react-query";
import { lightColors } from "@app/ui/tokens";
import type { ComponentProps } from "react";
import type { ColorValue } from "react-native";
import { api } from "../../src/api/endpoints";
import { FRIEND_REQUESTS_QUERY_KEY } from "../../src/friends/queryKeys";

type TabIconProps = { color: ColorValue; size: number; focused: boolean };

function tabIcon(name: ComponentProps<typeof SymbolView>["name"]) {
  return function TabIcon({ color, size }: TabIconProps) {
    return <SymbolView name={name} tintColor={color} size={size} weight="regular" />;
  };
}

// 3 onglets fixes (DESIGN.md §4/§7) : Accueil, Classement, Amis. Chaque onglet est un Stack
// (voir app/(tabs)/<onglet>/_layout.tsx) pour accueillir les écrans poussés à venir.
export default function TabsLayout() {
  // M8 : pastille numérique sur l'onglet Amis (demandes reçues), même clé/requête que l'écran Amis
  // (src/friends/queryKeys.ts) : pas d'appel réseau dupliqué grâce au cache TanStack Query.
  const requestsQuery = useQuery({ queryKey: FRIEND_REQUESTS_QUERY_KEY, queryFn: api.friendRequests.list });
  const incomingCount = requestsQuery.data?.incoming.length ?? 0;

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
          tabBarBadge: incomingCount || undefined,
          tabBarBadgeStyle: { backgroundColor: lightColors.accent, color: lightColors.textOnAccent },
          tabBarAccessibilityLabel:
            incomingCount > 0 ? `Amis, ${incomingCount === 1 ? "1 demande" : `${incomingCount} demandes`}` : "Amis",
        }}
      />
    </Tabs>
  );
}
