import { useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { STEP_MILESTONES, type LocalDate } from "@app/contracts";
import {
  AppText,
  EmptyState,
  ErrorState,
  GlassCard,
  ListRow,
  LoadingState,
  Monogram,
  Skeleton,
  SkyBackground,
  StatTile,
  StepRing,
  formatKcal,
  formatNumber,
  formatRank,
  formatSteps,
  progressToNext,
} from "@app/ui";
import { useAuth } from "../../../src/auth/AuthProvider";
import { api } from "../../../src/api/endpoints";
import { ApiClientError } from "../../../src/api/errors";
import { encouragementText } from "../../../src/encouragements/catalog";
import { RECEIVED_ENCOURAGEMENTS_QUERY_KEY } from "../../../src/encouragements/queryKeys";
import { hasEncouragementOn, sortByMostRecent, type ReceivedEncouragement } from "../../../src/encouragements/receivedView";
import { getHealthSource } from "../../../src/health";
import { formatHeaderDate } from "../../../src/home/formatDate";
import { TODAY_QUERY_KEY } from "../../../src/home/todayQuery";
import { buildTodayViewModel } from "../../../src/home/todayViewModel";
import { useActivitySync } from "../../../src/sync/useActivitySync";
import { useToast } from "../../../src/hooks/useToast";

// Accueil (M5/M8, CA3/CA9, screens.md §4). La carte « prochain ami » dépend des amis (hors
// périmètre, cf. rapport M5). Le bouton engrenage (Paramètres) arrive avec l'écran Paramètres
// lui-même (M9).
const AUTHORIZE_ERROR = "Impossible d'activer Apple Santé pour l'instant. Vérifie ta connexion puis réessaie.";

function currentLocalDate(timeZone: string): LocalDate {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(),
  ) as LocalDate;
}

export default function AccueilScreen() {
  const { me, refresh } = useAuth();
  const { showToast, toastElement } = useToast();
  const [authorizing, setAuthorizing] = useState(false);

  const hasConsent = Boolean(me?.healthConsentAt);
  const timeZone = me?.timeZone ?? "Europe/Paris";

  const { localToday, syncing, sync } = useActivitySync({
    enabled: hasConsent,
    timeZone,
    lastSyncAt: me?.lastSyncAt ?? null,
  });

  const todayQuery = useQuery({
    queryKey: TODAY_QUERY_KEY,
    queryFn: api.today,
    enabled: hasConsent,
  });

  const receivedQuery = useQuery({
    queryKey: RECEIVED_ENCOURAGEMENTS_QUERY_KEY,
    queryFn: api.encouragements.received,
  });

  const view = buildTodayViewModel({
    hasHealthConsent: hasConsent,
    isPending: todayQuery.isPending,
    isError: todayQuery.isError,
    serverData: todayQuery.data,
    localToday,
  });

  async function onAuthorizeHealth() {
    setAuthorizing(true);
    try {
      await api.me.setHealthConsent({ granted: true });
      await refresh();
      const source = getHealthSource();
      if (await source.isAvailable()) {
        await source.requestAuthorization();
      }
      await sync();
    } catch (error) {
      showToast(error instanceof ApiClientError ? error.userMessage : AUTHORIZE_ERROR);
    } finally {
      setAuthorizing(false);
    }
  }

  async function onRefresh() {
    await sync();
    await todayQuery.refetch();
  }

  const refreshing = syncing || todayQuery.isFetching;
  const headerDate = formatHeaderDate(todayQuery.data?.date ?? localToday?.date ?? currentLocalDate(timeZone));
  const todayLocalDate = todayQuery.data?.date ?? localToday?.date ?? currentLocalDate(timeZone);
  const receivedItems = receivedQuery.data ? sortByMostRecent(receivedQuery.data.encouragements) : [];
  const showEncouragementsCard = hasEncouragementOn(receivedItems, todayLocalDate, timeZone);

  return (
    <SkyBackground variant="sky">
      <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
        <ScrollView
          contentContainerStyle={{ padding: 20, gap: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1859B0" />}
        >
          <View className="gap-1">
            <AppText variant="subheadline" color="textSecondary">
              {headerDate}
            </AppText>
            <AppText variant="largeTitle">Bonjour {me?.username ?? ""}</AppText>
          </View>

          {view.kind === "loading" ? (
            <GlassCard>
              <LoadingState accessibilityLabel="Chargement de ton activité">
                <View className="items-center gap-4">
                  <Skeleton height={240} width={240} rounded />
                  <View className="w-full flex-row gap-3">
                    <Skeleton height={56} />
                    <Skeleton height={56} />
                  </View>
                </View>
              </LoadingState>
            </GlassCard>
          ) : null}

          {view.kind === "noConsent" ? (
            <GlassCard>
              <EmptyState
                illustration="sunrise"
                title="Connecte Apple Santé pour voir tes pas"
                message="Footer a besoin de ton accord pour compter tes pas et tes calories."
                action={{ label: "Autoriser l'accès", onPress: onAuthorizeHealth, loading: authorizing }}
              />
            </GlassCard>
          ) : null}

          {view.kind === "error" ? (
            <GlassCard>
              <ErrorState message="Vérifie ta connexion puis tire vers le bas pour réessayer." onRetry={onRefresh} retrying={refreshing} />
            </GlassCard>
          ) : null}

          {view.kind === "data" ? (
            <TodayCard steps={view.steps} activeCalories={view.activeCalories} rank={view.rank} participants={view.participants} degraded={view.degraded} />
          ) : null}

          {showEncouragementsCard ? <EncouragementsReceivedCard items={receivedItems.slice(0, 3)} /> : null}

          <ListRow title="Tes 30 derniers jours" onPress={() => router.push("/(tabs)/accueil/historique")} />
        </ScrollView>
      </SafeAreaView>
      {toastElement}
    </SkyBackground>
  );
}

type TodayCardProps = {
  steps: number;
  activeCalories: number;
  rank: number | null;
  participants: number | null;
  degraded: boolean;
};

function TodayCard({ steps, activeCalories, rank, participants, degraded }: TodayCardProps) {
  const progress = progressToNext(steps, STEP_MILESTONES);
  const ringLabel = `Progression vers ${progress.next ? formatSteps(progress.next) : "tous les paliers"}`;
  const ringValue = progress.next ? `${formatSteps(steps)} sur ${formatSteps(progress.next)}` : formatSteps(steps);
  const headline =
    progress.next === null
      ? "Tous les paliers du jour sont franchis. Bravo !"
      : steps === 0
        ? "Ta journée commence. Chaque pas compte."
        : `Encore ${formatSteps(progress.remaining)} pour ${formatNumber(progress.next)}`;

  return (
    <View className="gap-4">
      {degraded ? (
        <GlassCard tone="strong">
          <AppText variant="footnote" color="warning">
            Tes amis verront ce total dès que la connexion revient.
          </AppText>
        </GlassCard>
      ) : null}

      <GlassCard>
        <View className="items-center gap-2">
          <StepRing progress={progress.fraction} accessibilityLabel={ringLabel} accessibilityValueText={ringValue}>
            <AppText variant="hero" style={{ textAlign: "center" }}>
              {formatNumber(steps)}
            </AppText>
            <AppText variant="body" color="textSecondary">
              pas aujourd'hui
            </AppText>
          </StepRing>
          <AppText variant="headline" style={{ textAlign: "center" }}>
            {headline}
          </AppText>
        </View>
      </GlassCard>

      <GlassCard>
        <View className="flex-row gap-4">
          <StatTile label="Calories actives" value={formatKcal(activeCalories)} />
          {rank !== null && participants !== null && participants > 1 ? (
            <StatTile
              label="Rang du jour"
              value={`${formatRank(rank)} sur ${participants}`}
              accessibilityLabel={`Rang du jour, ${formatRank(rank)} sur ${participants} participants`}
            />
          ) : (
            <StatTile label="Amis" value="Ajoute un ami" />
          )}
        </View>
      </GlassCard>
    </View>
  );
}

function EncouragementsReceivedCard({ items }: { items: readonly ReceivedEncouragement[] }) {
  return (
    <GlassCard>
      <View className="gap-1">
        {items.map((item) => (
          <ListRow key={item.id} title={item.from.username} subtitle={encouragementText(item.messageId)} leading={<Monogram name={item.from.username} />} />
        ))}
        <ListRow title="Tout voir" titleColor="accentText" onPress={() => router.push("/(tabs)/accueil/encouragements")} />
      </View>
    </GlassCard>
  );
}
