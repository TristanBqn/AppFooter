import { RefreshControl, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { AppText, EmptyState, ErrorState, GlassCard, ListRow, LoadingState, Monogram, Skeleton, SkyBackground } from "@app/ui";
import { lightColors } from "@app/ui/tokens";
import { api } from "../../../src/api/endpoints";
import { encouragementText } from "../../../src/encouragements/catalog";
import { RECEIVED_ENCOURAGEMENTS_QUERY_KEY } from "../../../src/encouragements/queryKeys";
import { RECEIVED_ENCOURAGEMENTS_WINDOW_DAYS, withinLastDays } from "../../../src/encouragements/receivedView";

// « Tout voir » (M8, CA9, screens.md §4) : encouragements reçus des 7 derniers jours.
export default function EncouragementsRecuesScreen() {
  const query = useQuery({ queryKey: RECEIVED_ENCOURAGEMENTS_QUERY_KEY, queryFn: api.encouragements.received });
  const items = query.data ? withinLastDays(query.data.encouragements, RECEIVED_ENCOURAGEMENTS_WINDOW_DAYS, new Date()) : [];

  return (
    <SkyBackground variant="sky">
      <SafeAreaView style={{ flex: 1 }} edges={["left", "right", "bottom"]}>
        <ScrollView
          contentContainerStyle={{ padding: 20, gap: 16 }}
          refreshControl={<RefreshControl refreshing={query.isFetching} onRefresh={query.refetch} tintColor={lightColors.accent} />}
        >
          {query.isPending ? (
            <GlassCard>
              <LoadingState accessibilityLabel="Chargement de tes encouragements">
                <View className="gap-3">
                  <Skeleton height={56} />
                  <Skeleton height={56} />
                  <Skeleton height={56} />
                </View>
              </LoadingState>
            </GlassCard>
          ) : null}

          {query.isError && !query.data ? (
            <GlassCard>
              <ErrorState message="Vérifie ta connexion puis réessaie." onRetry={query.refetch} retrying={query.isFetching} />
            </GlassCard>
          ) : null}

          {query.data && items.length === 0 ? (
            <EmptyState illustration="calm" title="Aucun encouragement pour l'instant. Et si tu en envoyais un ?" />
          ) : null}

          {query.data && items.length > 0 ? (
            <GlassCard>
              <View className="gap-1">
                {items.map((item) => (
                  <ListRow
                    key={item.id}
                    title={item.from.username}
                    subtitle={encouragementText(item.messageId)}
                    leading={<Monogram name={item.from.username} />}
                  />
                ))}
              </View>
            </GlassCard>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </SkyBackground>
  );
}
