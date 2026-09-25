import { useEffect, useState } from "react";
import { ScrollView, Share, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { FriendRequestsResponse, FriendsResponse } from "@app/contracts";
import {
  AppText,
  Button,
  EmptyState,
  ErrorState,
  GlassCard,
  ListRow,
  LoadingState,
  Monogram,
  Skeleton,
  SkyBackground,
  TextField,
  announce,
  formatSteps,
} from "@app/ui";
import { useAuth } from "../../../src/auth/AuthProvider";
import { api } from "../../../src/api/endpoints";
import { ApiClientError } from "../../../src/api/errors";
import { impactLight } from "../../../src/haptics";
import { FRIENDS_QUERY_KEY, FRIEND_REQUESTS_QUERY_KEY } from "../../../src/friends/queryKeys";
import { validateFriendUsernameLocally } from "../../../src/friends/validateUsername";
import { useToast } from "../../../src/hooks/useToast";
import { onGlobalToast } from "../../../src/toastEvents";

// Amis (M7/M9, CA7, CA8, CA11, screens.md §6). Le retrait et le blocage se font depuis la fiche
// ami (M9) ; le message de confirmation arrive ici via `onGlobalToast` au retour sur cet écran.
export default function AmisScreen() {
  const { me } = useAuth();
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  const { showToast, toastElement } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => onGlobalToast(showToast), [showToast]);

  const [username, setUsername] = useState("");
  const [fieldError, setFieldError] = useState<string | undefined>(undefined);

  const friendsQuery = useQuery({ queryKey: FRIENDS_QUERY_KEY, queryFn: api.friends.list });
  const requestsQuery = useQuery({ queryKey: FRIEND_REQUESTS_QUERY_KEY, queryFn: api.friendRequests.list });

  const friends = friendsQuery.data?.friends ?? [];
  const incoming = requestsQuery.data?.incoming ?? [];
  const outgoing = requestsQuery.data?.outgoing ?? [];

  const addMutation = useMutation({
    mutationFn: (value: string) => api.friendRequests.create({ username: value }),
    onSuccess: () => {
      setUsername("");
      setFieldError(undefined);
      showToast("Demande envoyée si ce pseudo existe", "success");
      void queryClient.invalidateQueries({ queryKey: FRIEND_REQUESTS_QUERY_KEY });
    },
    onError: (error, value) => {
      if (error instanceof ApiClientError && error.code === "TARGET_BLOCKED") {
        setFieldError(`Tu as bloqué ${value}. Débloque ce compte dans Paramètres > Comptes bloqués pour l'ajouter.`);
      } else if (error instanceof ApiClientError && error.code === "RATE_LIMITED") {
        setFieldError("Tu as envoyé beaucoup de demandes aujourd'hui. Réessaie demain.");
      } else if (error instanceof ApiClientError) {
        setFieldError(error.userMessage);
      } else {
        setFieldError("Impossible d'envoyer la demande pour l'instant. Vérifie ta connexion puis réessaie.");
      }
    },
  });

  const acceptMutation = useMutation({
    mutationFn: (id: string) => api.friendRequests.accept(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: FRIEND_REQUESTS_QUERY_KEY });
      const previous = queryClient.getQueryData<FriendRequestsResponse>(FRIEND_REQUESTS_QUERY_KEY);
      if (previous) {
        queryClient.setQueryData<FriendRequestsResponse>(FRIEND_REQUESTS_QUERY_KEY, {
          ...previous,
          incoming: previous.incoming.filter((request) => request.id !== id),
        });
      }
      return { previous };
    },
    onError: (_error, _id, context) => {
      if (context?.previous) queryClient.setQueryData(FRIEND_REQUESTS_QUERY_KEY, context.previous);
      showToast("Impossible d'accepter cette demande pour l'instant. Vérifie ta connexion puis réessaie.");
    },
    onSuccess: (data) => {
      impactLight();
      queryClient.setQueryData<FriendsResponse>(FRIENDS_QUERY_KEY, (old) => {
        const rest = (old?.friends ?? []).filter((friend) => friend.userId !== data.friend.userId);
        return { friends: [...rest, data.friend].sort((a, b) => a.username.localeCompare(b.username)) };
      });
      showToast(`${data.friend.username} fait maintenant partie de tes amis`, "success");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: FRIEND_REQUESTS_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: FRIENDS_QUERY_KEY });
    },
  });

  const declineMutation = useMutation({
    mutationFn: (id: string) => api.friendRequests.decline(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: FRIEND_REQUESTS_QUERY_KEY });
      const previous = queryClient.getQueryData<FriendRequestsResponse>(FRIEND_REQUESTS_QUERY_KEY);
      if (previous) {
        queryClient.setQueryData<FriendRequestsResponse>(FRIEND_REQUESTS_QUERY_KEY, {
          ...previous,
          incoming: previous.incoming.filter((request) => request.id !== id),
        });
      }
      return { previous };
    },
    onError: (_error, _id, context) => {
      if (context?.previous) queryClient.setQueryData(FRIEND_REQUESTS_QUERY_KEY, context.previous);
      showToast("Impossible de refuser cette demande pour l'instant. Vérifie ta connexion puis réessaie.");
    },
    onSuccess: () => announce("Demande refusée"),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: FRIEND_REQUESTS_QUERY_KEY }),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.friendRequests.cancel(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: FRIEND_REQUESTS_QUERY_KEY });
      const previous = queryClient.getQueryData<FriendRequestsResponse>(FRIEND_REQUESTS_QUERY_KEY);
      if (previous) {
        queryClient.setQueryData<FriendRequestsResponse>(FRIEND_REQUESTS_QUERY_KEY, {
          ...previous,
          outgoing: previous.outgoing.filter((request) => request.id !== id),
        });
      }
      return { previous };
    },
    onError: (_error, _id, context) => {
      if (context?.previous) queryClient.setQueryData(FRIEND_REQUESTS_QUERY_KEY, context.previous);
      showToast("Impossible d'annuler cette demande pour l'instant. Vérifie ta connexion puis réessaie.");
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: FRIEND_REQUESTS_QUERY_KEY }),
  });

  function onSubmit() {
    const value = username.trim();
    const error = validateFriendUsernameLocally({
      username: value,
      myUsername: me?.username ?? null,
      friendUsernames: friends.map((friend) => friend.username),
      outgoingUsernames: outgoing.map((request) => request.to.username),
    });
    if (error) {
      setFieldError(error);
      return;
    }
    setFieldError(undefined);
    addMutation.mutate(value);
  }

  async function onShareUsername() {
    if (!me?.username) return;
    try {
      await Share.share({ message: `Ajoute-moi sur Footer : ${me.username}` });
    } catch {
      // Feuille de partage annulée ou indisponible : rien à signaler, aucune donnée perdue.
    }
  }

  const loading = friendsQuery.isPending || requestsQuery.isPending;
  const hasError = (friendsQuery.isError && !friendsQuery.data) || (requestsQuery.isError && !requestsQuery.data);
  const isEmpty = !loading && !hasError && friends.length === 0 && incoming.length === 0 && outgoing.length === 0;

  return (
    <SkyBackground variant="sky">
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 20, gap: 16 }}>
        <GlassCard>
          <View className="gap-2">
            <TextField
              label="Pseudo de ton ami"
              value={username}
              onChangeText={(text) => setUsername(text.toLowerCase())}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus={focus === "1"}
              error={fieldError}
              helper={fieldError ? undefined : "Tape son pseudo exact."}
              returnKeyType="go"
              onSubmitEditing={onSubmit}
              trailing={<Button label="Ajouter" size="compact" onPress={onSubmit} loading={addMutation.isPending} />}
            />
          </View>
        </GlassCard>

        {loading ? (
          <GlassCard>
            <LoadingState accessibilityLabel="Chargement de tes amis">
              <View className="gap-3">
                <Skeleton height={56} />
                <Skeleton height={56} />
                <Skeleton height={56} />
              </View>
            </LoadingState>
          </GlassCard>
        ) : null}

        {hasError ? (
          <GlassCard>
            <ErrorState
              message="Vérifie ta connexion puis réessaie."
              onRetry={() => {
                void friendsQuery.refetch();
                void requestsQuery.refetch();
              }}
              retrying={friendsQuery.isFetching || requestsQuery.isFetching}
            />
          </GlassCard>
        ) : null}

        {isEmpty ? (
          <EmptyState
            illustration="sunrise"
            title="Marcher, c'est mieux à plusieurs"
            message={`Demande à un proche son pseudo Footer et ajoute-le ci-dessus. Ton pseudo : ${me?.username ?? ""}`}
            action={{ label: "Partager mon pseudo", onPress: onShareUsername }}
          />
        ) : null}

        {incoming.length > 0 ? (
          <GlassCard>
            <View className="gap-1">
              <AppText variant="footnote" color="textSecondary">
                DEMANDES REÇUES
              </AppText>
              {incoming.map((request) => (
                <ListRow
                  key={request.id}
                  title={request.from.username}
                  leading={<Monogram name={request.from.username} />}
                  trailing={
                    <>
                      <Button
                        label="Accepter"
                        variant="secondary"
                        size="compact"
                        onPress={() => acceptMutation.mutate(request.id)}
                        loading={acceptMutation.isPending && acceptMutation.variables === request.id}
                        accessibilityLabel={`Accepter la demande de ${request.from.username}`}
                      />
                      <Button
                        label="Refuser"
                        variant="ghost"
                        size="compact"
                        onPress={() => declineMutation.mutate(request.id)}
                        loading={declineMutation.isPending && declineMutation.variables === request.id}
                        accessibilityLabel={`Refuser la demande de ${request.from.username}`}
                      />
                    </>
                  }
                />
              ))}
            </View>
          </GlassCard>
        ) : null}

        {outgoing.length > 0 ? (
          <GlassCard>
            <View className="gap-1">
              <AppText variant="footnote" color="textSecondary">
                DEMANDES ENVOYÉES
              </AppText>
              {outgoing.map((request) => (
                <ListRow
                  key={request.id}
                  title={request.to.username}
                  subtitle="En attente"
                  trailing={
                    <Button
                      label="Annuler"
                      variant="ghost"
                      size="compact"
                      onPress={() => cancelMutation.mutate(request.id)}
                      loading={cancelMutation.isPending && cancelMutation.variables === request.id}
                      accessibilityLabel={`Annuler la demande envoyée à ${request.to.username}`}
                    />
                  }
                />
              ))}
            </View>
          </GlassCard>
        ) : null}

        {friends.length > 0 ? (
          <GlassCard>
            <View className="gap-1">
              <AppText variant="footnote" color="textSecondary">
                MES AMIS
              </AppText>
              {friends.map((friend) => (
                <ListRow
                  key={friend.userId}
                  title={friend.username}
                  subtitle={`${formatSteps(friend.todaySteps)} aujourd'hui`}
                  leading={<Monogram name={friend.username} />}
                  onPress={() =>
                    router.push({ pathname: "/(tabs)/amis/[userId]", params: { userId: friend.userId, username: friend.username } })
                  }
                />
              ))}
            </View>
          </GlassCard>
        ) : null}
      </ScrollView>
      {toastElement}
    </SkyBackground>
  );
}
