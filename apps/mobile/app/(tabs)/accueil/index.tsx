import { useEffect, useRef } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SymbolView } from "expo-symbols";
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
  announce,
  formatKcal,
  formatNumber,
  formatRank,
  formatRankLabel,
  formatSteps,
  progressToNext,
} from "@app/ui";
import { lightColors, radius } from "@app/ui/tokens";
import { useAuth } from "../../../src/auth/AuthProvider";
import { api } from "../../../src/api/endpoints";
import { encouragementText } from "../../../src/encouragements/catalog";
import { RECEIVED_ENCOURAGEMENTS_QUERY_KEY } from "../../../src/encouragements/queryKeys";
import { hasEncouragementOn, sortByMostRecent, type ReceivedEncouragement } from "../../../src/encouragements/receivedView";
import { formatHeaderDate } from "../../../src/home/formatDate";
import { buildNextFriendCard, type NextFriendCard } from "../../../src/home/nextFriendCard";
import { buildRankTileViewModel, type RankTileViewModel } from "../../../src/home/rankTile";
import { TODAY_QUERY_KEY } from "../../../src/home/todayQuery";
import { buildTodayViewModel } from "../../../src/home/todayViewModel";
import { LEADERBOARD_DAILY_QUERY_KEY } from "../../../src/leaderboard/queryKeys";
import { useActivitySync } from "../../../src/sync/useActivitySync";
import { useToast } from "../../../src/hooks/useToast";
import { onGlobalToast } from "../../../src/toastEvents";

// Accueil (M5/M8/M9, CA3/CA9, screens.md §4).

function currentLocalDate(timeZone: string): LocalDate {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(),
  ) as LocalDate;
}

export default function AccueilScreen() {
  const { me } = useAuth();
  const { showToast, toastElement } = useToast();

  // Toast affiché ailleurs (ex. « Pas maintenant » du consentement, M3) : survit à la navigation
  // vers l'Accueil, contrairement à un `useToast` local à l'écran d'origine (démonté entre-temps).
  useEffect(() => onGlobalToast(showToast), [showToast]);

  // `me === undefined` tant que `/me` n'a pas encore répondu (M4) : distinct de « consentement
  // absent », qui ne peut être établi qu'une fois `me` connu.
  const authLoading = me === undefined;
  const hasConsent = Boolean(me?.healthConsentAt);
  const timeZone = me?.timeZone ?? "Europe/Paris";

  const { localToday, syncing, syncError, sync } = useActivitySync({
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

  // Même clé que le Classement (src/leaderboard/queryKeys.ts) : partage le cache TanStack Query
  // au lieu de dupliquer l'appel réseau.
  const leaderboardQuery = useQuery({
    queryKey: LEADERBOARD_DAILY_QUERY_KEY,
    queryFn: api.leaderboards.daily,
    enabled: hasConsent,
  });

  const view = buildTodayViewModel({
    authLoading,
    hasHealthConsent: hasConsent,
    isPending: todayQuery.isPending,
    isError: todayQuery.isError,
    syncError: syncError !== null,
    serverData: todayQuery.data,
    localToday,
  });

  // B1 : ouvre l'écran de consentement dédié, seul point d'envoi de `PUT /me/consents/health`.
  // L'appel direct à HealthKit (sans passer par cet écran) reste réservé au cas « consentement
  // Footer déjà donné, accès HealthKit refusé » (Paramètres > Accès à Apple Santé), pas à ce bouton.
  function onAuthorizeHealth() {
    router.push("/(auth)/consentement");
  }

  async function onRefresh() {
    await sync();
    await Promise.all([todayQuery.refetch(), leaderboardQuery.refetch()]);
  }

  const refreshing = syncing || todayQuery.isFetching;
  const headerDate = formatHeaderDate(todayQuery.data?.date ?? localToday?.date ?? currentLocalDate(timeZone));
  const todayLocalDate = todayQuery.data?.date ?? localToday?.date ?? currentLocalDate(timeZone);
  const receivedItems = receivedQuery.data ? sortByMostRecent(receivedQuery.data.encouragements) : [];
  const showEncouragementsCard = hasEncouragementOn(receivedItems, todayLocalDate, timeZone);
  const nextFriendCard: NextFriendCard = leaderboardQuery.data
    ? buildNextFriendCard(leaderboardQuery.data.entries)
    : { kind: "hidden" };

  return (
    <SkyBackground variant="sky">
      <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
        <ScrollView
          contentContainerStyle={{ padding: 20, gap: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={lightColors.accent} />}
        >
          <View className="flex-row items-start justify-between">
            <View className="gap-1" style={{ flex: 1 }}>
              <AppText variant="subheadline" color="textSecondary">
                {headerDate}
              </AppText>
              {me ? (
                <AppText variant="largeTitle">Bonjour {me.username}</AppText>
              ) : (
                <Skeleton height={34} width="60%" />
              )}
            </View>
            <Pressable
              role="button"
              aria-label="Paramètres"
              onPress={() => router.push("/(tabs)/accueil/parametres")}
              style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
            >
              <SymbolView name="gearshape" size={24} tintColor={lightColors.text} weight="regular" />
            </Pressable>
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
                action={{ label: "Autoriser l'accès", onPress: onAuthorizeHealth }}
              />
            </GlassCard>
          ) : null}

          {view.kind === "error" ? (
            <GlassCard>
              <ErrorState message="Vérifie ta connexion puis tire vers le bas pour réessayer." onRetry={onRefresh} retrying={refreshing} />
            </GlassCard>
          ) : null}

          {view.kind === "data" ? (
            <TodayCard
              steps={view.steps}
              activeCalories={view.activeCalories}
              rankTile={buildRankTileViewModel(leaderboardQuery.data?.entries, {
                rank: view.rank,
                participants: view.participants,
              })}
              degraded={view.degraded}
            />
          ) : null}

          {view.kind === "data" ? <NextFriendCardView card={nextFriendCard} myUsername={me?.username ?? ""} /> : null}

          {showEncouragementsCard ? <EncouragementsReceivedCard items={receivedItems.slice(0, 3)} /> : null}

          <GlassCard>
            <ListRow title="Tes 30 derniers jours" onPress={() => router.push("/(tabs)/accueil/historique")} />
          </GlassCard>
        </ScrollView>
      </SafeAreaView>
      {toastElement}
    </SkyBackground>
  );
}

type TodayCardProps = {
  steps: number;
  activeCalories: number;
  rankTile: RankTileViewModel;
  degraded: boolean;
};

function TodayCard({ steps, activeCalories, rankTile, degraded }: TodayCardProps) {
  const progress = progressToNext(steps, STEP_MILESTONES);

  // Franchissement d'un seuil pendant que l'écran est ouvert (screens.md §4) : annonce VoiceOver
  // systématique (utile même animations réduites) ; le halo visuel est décoratif et volontairement
  // omis ici (voir rapport M5), l'accessibilité ne dépend pas de lui.
  const previousStepsRef = useRef(steps);
  useEffect(() => {
    const previous = previousStepsRef.current;
    if (previous !== steps) {
      const crossed = STEP_MILESTONES.find((milestone) => previous < milestone && steps >= milestone);
      if (crossed !== undefined) announce(`Palier de ${formatSteps(crossed)} franchi`);
      previousStepsRef.current = steps;
    }
  }, [steps]);

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
        <View style={styles.warningBanner}>
          <AppText variant="footnote" color="warning">
            Tes amis verront ce total dès que la connexion revient.
          </AppText>
        </View>
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
          <RankStatTile rankTile={rankTile} />
        </View>
      </GlassCard>
    </View>
  );
}

/**
 * Tuile « Rang du jour » (M6/M7) : « Amis » / « Ajoute un ami » sans ami, non pressable si le rang
 * est vraiment inconnu (classement et /me/today tous deux en échec), « ex æquo » via `rankTile.tied`.
 */
function RankStatTile({ rankTile }: { rankTile: RankTileViewModel }) {
  if (rankTile.kind === "noFriends") {
    return (
      <StatTile label="Amis" value="Ajoute un ami" onPress={() => router.push("/(tabs)/amis")} accessibilityHint="Ouvre tes amis" />
    );
  }

  if (rankTile.kind === "unknown") {
    return <StatTile label="Rang du jour" value="—" />;
  }

  const { rank, tied, participants } = rankTile;
  const value = tied ? formatRankLabel(rank, true) : `${formatRank(rank)} sur ${participants}`;
  const accessibilityLabel = tied
    ? `Rang du jour, ${formatRankLabel(rank, true)}`
    : `Rang du jour, ${formatRank(rank)} sur ${participants} participants`;
  return (
    <StatTile
      label="Rang du jour"
      value={value}
      accessibilityLabel={accessibilityLabel}
      onPress={() => router.push("/(tabs)/classement")}
      accessibilityHint="Ouvre le classement"
    />
  );
}

type NextFriendCardViewProps = { card: NextFriendCard; myUsername: string };

/** Carte « prochain ami » de l'Accueil (screens.md §4) : masquée sans ami (`card.kind === "hidden"`). */
function NextFriendCardView({ card, myUsername }: NextFriendCardViewProps) {
  if (card.kind === "hidden") return null;
  const monogramName = card.kind === "leading" ? myUsername : card.username;
  return (
    <GlassCard>
      <ListRow
        title={card.title}
        subtitle={"subtitle" in card ? card.subtitle : undefined}
        leading={<Monogram name={monogramName} />}
        onPress={() => router.push("/(tabs)/classement")}
        accessibilityHint="Ouvre le classement"
      />
    </GlassCard>
  );
}

function EncouragementsReceivedCard({ items }: { items: readonly ReceivedEncouragement[] }) {
  return (
    <GlassCard>
      <View className="gap-2">
        <AppText variant="headline">Encouragements reçus</AppText>
        <View className="gap-1">
          {items.map((item) => (
            <ListRow key={item.id} title={item.from.username} subtitle={encouragementText(item.messageId)} leading={<Monogram name={item.from.username} />} />
          ))}
          <ListRow
            title="Tout voir"
            titleColor="accentText"
            onPress={() => router.push("/(tabs)/accueil/encouragements")}
            accessibilityHint="Affiche tes encouragements reçus des 7 derniers jours"
          />
        </View>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  warningBanner: { backgroundColor: lightColors.warningSoft, borderRadius: radius.md, padding: 12 },
});
