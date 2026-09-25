import { RefreshControl, ScrollView, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { STEP_MILESTONES } from "@app/contracts";
import {
  AppText,
  ErrorState,
  GlassCard,
  LoadingState,
  Monogram,
  ProgressBar,
  Skeleton,
  SkyBackground,
  StepRing,
  formatKcal,
  formatSteps,
  progressToNext,
} from "@app/ui";
import { lightColors } from "@app/ui/tokens";
import { api } from "../api/endpoints";
import { formatShortDate } from "../home/formatDate";
import { friendActivityQueryKey } from "./queryKeys";

// Fiche d'un ami (M7, CA8, screens.md §7). Poussée depuis Classement ET Amis : deux fichiers
// route minces (app/(tabs)/classement/[userId].tsx, app/(tabs)/amis/[userId].tsx) rendent ce même
// composant, chaque onglet ayant sa propre pile de navigation (expo-router).
// « Encourager » (M8) et « Retirer/Bloquer » (M9, avec Paramètres > Comptes bloqués) : à ajouter
// dans ces tâches, hors périmètre M7 (CA7/CA8 uniquement).
export function FriendProfileScreen() {
  const { userId, username: usernameParam } = useLocalSearchParams<{ userId: string; username?: string }>();
  const query = useQuery({
    queryKey: friendActivityQueryKey(userId),
    queryFn: () => api.friends.activity(userId),
    enabled: Boolean(userId),
  });

  const username = query.data?.user.username ?? usernameParam ?? "";
  const steps = query.data?.today.steps ?? 0;
  const activeCalories = query.data?.today.activeCalories ?? null;
  const history = query.data?.history ?? [];
  const bestSteps = history.reduce((max, day) => Math.max(max, day.steps), 0);
  const progress = progressToNext(steps, STEP_MILESTONES);

  return (
    <SkyBackground variant="sky">
      <Stack.Screen options={{ title: username }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: 20, gap: 16 }}
        refreshControl={<RefreshControl refreshing={query.isFetching} onRefresh={query.refetch} tintColor={lightColors.accent} />}
      >
        {query.isPending ? (
          <GlassCard>
            <LoadingState accessibilityLabel={`Chargement de l'activité de ${username}`}>
              <View className="items-center gap-4">
                <Skeleton height={160} width={160} rounded />
                <Skeleton height={20} width="60%" />
              </View>
            </LoadingState>
          </GlassCard>
        ) : null}

        {query.isError ? (
          <GlassCard>
            <ErrorState message="Vérifie ta connexion puis réessaie." onRetry={query.refetch} retrying={query.isFetching} />
          </GlassCard>
        ) : null}

        {query.data ? (
          <>
            <GlassCard>
              <View className="items-center gap-2">
                <Monogram name={username} size={64} />
                <AppText variant="title2">{username}</AppText>
                <StepRing
                  size={160}
                  progress={progress.fraction}
                  accessibilityLabel={`Progression de ${username} vers ${progress.next ? formatSteps(progress.next) : "tous les paliers"}`}
                  accessibilityValueText={formatSteps(steps)}
                >
                  {steps === 0 ? (
                    <AppText variant="body" color="textSecondary" style={{ textAlign: "center" }}>
                      Pas encore de pas aujourd'hui
                    </AppText>
                  ) : (
                    <>
                      <AppText variant="title1">{formatSteps(steps)}</AppText>
                      <AppText variant="footnote" color="textSecondary">
                        aujourd'hui
                      </AppText>
                    </>
                  )}
                </StepRing>
                {activeCalories !== null ? (
                  <AppText variant="body" color="textSecondary">
                    {formatKcal(activeCalories)}
                  </AppText>
                ) : null}
              </View>
            </GlassCard>

            {history.length > 0 ? (
              <GlassCard>
                <View className="gap-3">
                  {history.map((day) => (
                    <View key={day.date} className="gap-1">
                      <AppText variant="footnote" color="textSecondary">
                        {formatShortDate(day.date)} · {formatSteps(day.steps)}
                      </AppText>
                      <ProgressBar
                        progress={bestSteps > 0 ? day.steps / bestSteps : 0}
                        accessibilityLabel={`Pas du ${formatShortDate(day.date)}`}
                        accessibilityValueText={formatSteps(day.steps)}
                        height={6}
                      />
                    </View>
                  ))}
                </View>
              </GlassCard>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </SkyBackground>
  );
}
