import { RefreshControl, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import {
  AppText,
  EmptyState,
  ErrorState,
  GlassCard,
  ListRow,
  LoadingState,
  ProgressBar,
  Skeleton,
  SkyBackground,
  formatKcal,
  formatSteps,
} from "@app/ui";
import { useAuth } from "../../../src/auth/AuthProvider";
import { api } from "../../../src/api/endpoints";
import { formatDayOfMonth, formatShortDate } from "../../../src/home/formatDate";
import { buildHistoryRows, summarizeHistory, type HistoryRow } from "../../../src/home/historyView";

// Historique des 30 derniers jours (M5, CA3, screens.md §8), poussé depuis l'Accueil.
const HISTORY_QUERY_KEY = ["activityHistory"] as const;

function currentLocalDate(timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(),
  );
}

export default function HistoriqueScreen() {
  const { me } = useAuth();
  const timeZone = me?.timeZone ?? "Europe/Paris";
  const query = useQuery({ queryKey: HISTORY_QUERY_KEY, queryFn: () => api.activity.history() });

  const days = query.data?.days ?? [];
  const rows = buildHistoryRows(days, currentLocalDate(timeZone));
  const summary = summarizeHistory(days);
  const bestSteps = summary.best?.steps ?? 0;

  return (
    <SkyBackground variant="sky">
      <SafeAreaView style={{ flex: 1 }} edges={["left", "right", "bottom"]}>
        <ScrollView
          contentContainerStyle={{ padding: 20, gap: 16 }}
          refreshControl={<RefreshControl refreshing={query.isFetching} onRefresh={query.refetch} tintColor="#1859B0" />}
        >
          {query.isPending ? (
            <GlassCard>
              <LoadingState accessibilityLabel="Chargement de ton historique">
                <View className="gap-3">
                  {Array.from({ length: 8 }, (_, index) => (
                    <Skeleton key={index} height={20} />
                  ))}
                </View>
              </LoadingState>
            </GlassCard>
          ) : null}

          {query.isError && !query.data ? (
            <GlassCard>
              <ErrorState message="Vérifie ta connexion puis réessaie." onRetry={query.refetch} retrying={query.isFetching} />
            </GlassCard>
          ) : null}

          {query.data && days.length === 0 ? (
            <GlassCard>
              <EmptyState illustration="calm" title="Ton historique se construit jour après jour" />
            </GlassCard>
          ) : null}

          {query.data && days.length > 0 ? (
            <>
              <GlassCard>
                <View className="gap-1">
                  <AppText variant="body">Moyenne : {formatSteps(summary.averageSteps)} / jour</AppText>
                  {summary.best ? (
                    <AppText variant="body" color="textSecondary">
                      Meilleur jour : {formatSteps(summary.best.steps)}, {formatDayOfMonth(summary.best.date)}
                    </AppText>
                  ) : null}
                </View>
              </GlassCard>

              <GlassCard>
                <View className="gap-4">
                  {rows.map((row) => (
                    <HistoryRowItem key={row.date} row={row} bestSteps={bestSteps} />
                  ))}
                </View>
              </GlassCard>
            </>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </SkyBackground>
  );
}

function HistoryRowItem({ row, bestSteps }: { row: HistoryRow; bestSteps: number }) {
  const dateLabel = formatShortDate(row.date);

  if (!row.entry) {
    // Jour sans donnée (Santé pas encore connectée ce jour-là) : jamais « 0 pas » (screens.md §8).
    return <ListRow title={dateLabel} value="Pas de données" titleColor="textSecondary" />;
  }

  const { steps, activeCalories } = row.entry;
  // Pastille soleil décorative sur le seuil de 10 000 (screens.md §8) : rendue en texte plutôt
  // qu'en icône graphique, ListRow n'exposant pas d'emplacement pour une puce à côté de la valeur
  // sans perdre l'affichage de celle-ci (voir ListRow.tsx, branche `trailing`).
  const milestoneReached = steps >= 10_000;
  const kcal = formatKcal(activeCalories ?? 0);
  const subtitle = milestoneReached ? `${kcal} · Palier de 10 000 franchi` : kcal;

  return (
    <View className="gap-1">
      <ListRow title={dateLabel} subtitle={subtitle} value={formatSteps(steps)} />
      <ProgressBar
        progress={bestSteps > 0 ? steps / bestSteps : 0}
        accessibilityLabel={`Pas du ${dateLabel}`}
        accessibilityValueText={formatSteps(steps)}
        height={4}
      />
    </View>
  );
}
