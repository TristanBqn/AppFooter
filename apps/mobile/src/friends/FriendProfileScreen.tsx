import { useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ENCOURAGEMENT_CATALOG, STEP_MILESTONES, type EncouragementMessageId } from "@app/contracts";
import {
  AppText,
  Button,
  Chip,
  ConfirmSheet,
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
import { ApiClientError } from "../api/errors";
import { formatShortDate } from "../home/formatDate";
import { impactLight } from "../haptics";
import { useToast } from "../hooks/useToast";
import { emitGlobalToast } from "../toastEvents";
import { FRIENDS_QUERY_KEY, friendActivityQueryKey } from "./queryKeys";

// Fiche d'un ami (M7/M8/M9, CA8/CA9/CA11/CA14, screens.md §7). Poussée depuis Classement ET Amis :
// deux fichiers route minces (app/(tabs)/classement/[userId].tsx, app/(tabs)/amis/[userId].tsx)
// rendent ce même composant, chaque onglet ayant sa propre pile de navigation (expo-router).
type SensitiveAction = "remove" | "block" | null;

export function FriendProfileScreen() {
  const { userId, username: usernameParam } = useLocalSearchParams<{ userId: string; username?: string }>();
  const queryClient = useQueryClient();
  const { showToast, toastElement } = useToast();
  const [sensitiveAction, setSensitiveAction] = useState<SensitiveAction>(null);
  const query = useQuery({
    queryKey: friendActivityQueryKey(userId),
    queryFn: () => api.friends.activity(userId),
    enabled: Boolean(userId),
  });
  // Sert uniquement à lire `encouragedToday` (absent de `FriendActivityResponse`) : déjà en cache
  // si on vient de l'onglet Amis, sinon chargé ici (mis en cache pour l'onglet Amis à son tour).
  const friendsQuery = useQuery({ queryKey: FRIENDS_QUERY_KEY, queryFn: api.friends.list });

  const username = query.data?.user.username ?? usernameParam ?? "";
  const steps = query.data?.today.steps ?? 0;
  const activeCalories = query.data?.today.activeCalories ?? null;
  const history = query.data?.history ?? [];
  const bestSteps = history.reduce((max, day) => Math.max(max, day.steps), 0);
  const progress = progressToNext(steps, STEP_MILESTONES);

  const friendEntry = friendsQuery.data?.friends.find((friend) => friend.userId === userId);
  // Deux origines pour « déjà encouragé aujourd'hui » (screens.md §7) : connu au chargement
  // (`encouragedToday`, message envoyé inconnu) ou un envoi réussi dans cette session
  // (`sentMessageId`, ce message précis reste visible comme « selected »).
  const [sentMessageId, setSentMessageId] = useState<EncouragementMessageId | null>(null);
  const [blockedByQuota, setBlockedByQuota] = useState(false);
  const alreadySentToday = Boolean(friendEntry?.encouragedToday) || sentMessageId !== null || blockedByQuota;

  const sendMutation = useMutation({
    mutationFn: (messageId: EncouragementMessageId) => api.encouragements.send({ toUserId: userId, messageId }),
    onSuccess: (_response, messageId) => {
      setSentMessageId(messageId);
      impactLight();
      showToast(`Encouragement envoyé à ${username}`, "success");
      void queryClient.invalidateQueries({ queryKey: FRIENDS_QUERY_KEY });
    },
    onError: (error) => {
      if (error instanceof ApiClientError && error.code === "ENCOURAGEMENT_LIMIT") {
        // Déjà envoyé aujourd'hui (autre session) : même état que `encouragedToday`, pas de ton
        // d'erreur (screens.md §7). On ignore volontairement quel message a réellement été envoyé.
        setBlockedByQuota(true);
        return;
      }
      showToast(
        error instanceof ApiClientError
          ? error.userMessage
          : "Impossible d'envoyer l'encouragement pour l'instant. Vérifie ta connexion puis réessaie.",
      );
    },
  });

  const removeMutation = useMutation({
    mutationFn: () => api.friends.remove(userId),
    onSuccess: () => {
      setSensitiveAction(null);
      void queryClient.invalidateQueries({ queryKey: FRIENDS_QUERY_KEY });
      emitGlobalToast(`${username} ne fait plus partie de tes amis`);
      router.back();
    },
    onError: (error) => {
      setSensitiveAction(null);
      showToast(
        error instanceof ApiClientError
          ? error.userMessage
          : "Impossible de retirer cet ami pour l'instant. Vérifie ta connexion puis réessaie.",
      );
    },
  });

  const blockMutation = useMutation({
    mutationFn: () => api.blocks.block({ userId }),
    onSuccess: () => {
      setSensitiveAction(null);
      void queryClient.invalidateQueries({ queryKey: FRIENDS_QUERY_KEY });
      emitGlobalToast(`Blocage effectué pour ${username}`);
      router.back();
    },
    onError: (error) => {
      setSensitiveAction(null);
      showToast(
        error instanceof ApiClientError
          ? error.userMessage
          : "Impossible de bloquer ce compte pour l'instant. Vérifie ta connexion puis réessaie.",
      );
    },
  });

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

            <GlassCard>
              <View className="gap-3">
                <AppText variant="headline">Envoie-lui un mot</AppText>
                <View className="flex-row flex-wrap gap-2">
                  {ENCOURAGEMENT_CATALOG.map((message) => (
                    <Chip
                      key={message.id}
                      label={message.text}
                      selected={sentMessageId === message.id}
                      disabled={alreadySentToday && sentMessageId !== message.id}
                      accessibilityLabel={`Envoyer à ${username} : ${message.text}`}
                      onPress={() => sendMutation.mutate(message.id)}
                    />
                  ))}
                </View>
                {alreadySentToday ? (
                  <AppText variant="footnote" color="textSecondary">
                    Envoyé aujourd'hui. Tu pourras l'encourager à nouveau demain.
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

            <View className="gap-2">
              <Button label="Retirer de mes amis" variant="ghost" onPress={() => setSensitiveAction("remove")} />
              <Button label="Bloquer" variant="destructive" onPress={() => setSensitiveAction("block")} accessibilityLabel={`Bloquer ${username}`} />
            </View>
          </>
        ) : null}
      </ScrollView>

      <ConfirmSheet
        visible={sensitiveAction === "remove"}
        title={`Retirer ${username} de tes amis ?`}
        message="Vous ne verrez plus vos activités respectives. Tu pourras l'ajouter à nouveau plus tard."
        confirmLabel="Retirer"
        loading={removeMutation.isPending}
        onConfirm={() => removeMutation.mutate()}
        onCancel={() => setSensitiveAction(null)}
      />
      <ConfirmSheet
        visible={sensitiveAction === "block"}
        title={`Bloquer ${username} ?`}
        message={`${username} ne pourra plus te trouver, t'envoyer de demande ni voir ton activité. Aucune notification ne lui sera envoyée.`}
        confirmLabel="Bloquer"
        loading={blockMutation.isPending}
        onConfirm={() => blockMutation.mutate()}
        onCancel={() => setSensitiveAction(null)}
      />

      {toastElement}
    </SkyBackground>
  );
}
