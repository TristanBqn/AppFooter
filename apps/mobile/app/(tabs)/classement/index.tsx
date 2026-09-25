import { useEffect, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import type { LeaderboardPeriod } from "@app/contracts";
import {
  AppText,
  EmptyState,
  ErrorState,
  GlassCard,
  LoadingState,
  RankRow,
  SegmentedControl,
  SkeletonRow,
  SkyBackground,
  markTies,
} from "@app/ui";
import { layout, lightColors, radius, shadow } from "@app/ui/tokens";
import { api } from "../../../src/api/endpoints";
import { impactLight } from "../../../src/haptics";
import { formatHeaderDate, formatWeekRange } from "../../../src/home/formatDate";
import { useToast } from "../../../src/hooks/useToast";
import { buildLeaderboardBanner, leaderboardBannerText } from "../../../src/leaderboard/banner";
import { LEADERBOARD_DAILY_QUERY_KEY, LEADERBOARD_WEEKLY_QUERY_KEY } from "../../../src/leaderboard/queryKeys";
import { onGlobalToast } from "../../../src/toastEvents";

// Classement quotidien / hebdomadaire (M6, CA5, CA6, screens.md §5). Toucher une ligne (hors la
// mienne) ouvre la fiche ami (M7, app/(tabs)/classement/[userId].tsx).
const PERIOD_OPTIONS = [
  { value: "daily" as const, label: "Aujourd'hui" },
  { value: "weekly" as const, label: "Cette semaine" },
];

function friendsCountLabel(count: number): string {
  if (count === 0) return "toi seul";
  if (count === 1) return "toi et 1 ami";
  return `toi et ${count} amis`;
}

export default function ClassementScreen() {
  const [period, setPeriod] = useState<LeaderboardPeriod>("daily");
  const { showToast, toastElement } = useToast();

  useEffect(() => onGlobalToast(showToast), [showToast]);

  // Les deux périodes sont préchargées (screens.md §5) : la bascule est instantanée.
  const dailyQuery = useQuery({ queryKey: LEADERBOARD_DAILY_QUERY_KEY, queryFn: api.leaderboards.daily });
  const weeklyQuery = useQuery({ queryKey: LEADERBOARD_WEEKLY_QUERY_KEY, queryFn: api.leaderboards.weekly });
  const query = period === "daily" ? dailyQuery : weeklyQuery;

  async function onRefresh() {
    await Promise.all([dailyQuery.refetch(), weeklyQuery.refetch()]);
  }

  const entries = query.data?.entries ?? [];
  const rows = markTies(entries);
  const friendsCount = Math.max(0, entries.length - 1);
  const banner = query.data && friendsCount > 0 ? buildLeaderboardBanner(entries, period) : null;
  const bannerText = banner ? leaderboardBannerText(banner, period) : null;

  const contextLabel = query.data
    ? period === "daily"
      ? `${formatHeaderDate(query.data.start)} · ${friendsCountLabel(friendsCount)}`
      : formatWeekRange(query.data.start, query.data.end)
    : null;

  return (
    <SkyBackground variant="sky">
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: 20, gap: 16 }}
        refreshControl={<RefreshControl refreshing={query.isFetching} onRefresh={onRefresh} tintColor={lightColors.accent} />}
      >
        <SegmentedControl
          options={PERIOD_OPTIONS}
          value={period}
          onChange={(value) => {
            impactLight();
            setPeriod(value);
          }}
          accessibilityLabel="Période du classement"
        />

        {contextLabel ? (
          <AppText variant="subheadline" color="textSecondary">
            {contextLabel}
          </AppText>
        ) : null}

        {query.isPending ? (
          <GlassCard>
            <LoadingState accessibilityLabel="Chargement du classement">
              <View className="gap-3">
                {Array.from({ length: 5 }, (_, index) => (
                  <SkeletonRow key={index} />
                ))}
              </View>
            </LoadingState>
          </GlassCard>
        ) : null}

        {query.isError && !query.data ? (
          <GlassCard>
            <ErrorState
              message="Le classement n'a pas pu se charger. Vérifie ta connexion puis réessaie."
              onRetry={onRefresh}
              retrying={query.isFetching}
            />
          </GlassCard>
        ) : null}

        {query.data ? (
          <>
            {bannerText ? (
              <View style={styles.banner}>
                <AppText variant="headline" style={{ textAlign: "center" }}>
                  {bannerText}
                </AppText>
              </View>
            ) : null}

            <GlassCard>
              <View className="gap-1">
                {rows.map((row) => (
                  <RankRow
                    key={row.userId}
                    rank={row.rank}
                    tied={row.tied}
                    name={row.username}
                    steps={row.steps}
                    isMe={row.isMe}
                    onPress={
                      row.isMe
                        ? undefined
                        : () => router.push({ pathname: "/(tabs)/classement/[userId]", params: { userId: row.userId, username: row.username } })
                    }
                  />
                ))}
              </View>
            </GlassCard>

            {friendsCount === 0 ? (
              <EmptyState
                illustration="together"
                title="Le classement se remplit avec tes amis"
                message="Ajoute un proche avec son pseudo pour marcher ensemble."
                action={{ label: "Ajouter un ami", onPress: () => router.push({ pathname: "/(tabs)/amis", params: { focus: "1" } }) }}
              />
            ) : null}

            <AppText variant="footnote" color="textSecondary" style={{ textAlign: "center" }}>
              Tire vers le bas pour actualiser.
            </AppText>
          </>
        ) : null}
      </ScrollView>
      {toastElement}
    </SkyBackground>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: lightColors.sunGlow,
    borderRadius: radius.lg,
    padding: layout.cardPadding,
    boxShadow: shadow.soft.css,
  },
});
