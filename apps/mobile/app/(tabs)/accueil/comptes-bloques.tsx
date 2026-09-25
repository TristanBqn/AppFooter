import { ScrollView, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { BlocksResponse } from "@app/contracts";
import { Button, EmptyState, ErrorState, GlassCard, ListRow, LoadingState, Skeleton, SkyBackground } from "@app/ui";
import { api } from "../../../src/api/endpoints";
import { ApiClientError } from "../../../src/api/errors";
import { BLOCKS_QUERY_KEY } from "../../../src/settings/queryKeys";
import { useToast } from "../../../src/hooks/useToast";

// Comptes bloqués (M9, CA11, screens.md §9). Déblocage sans confirmation (réversible).
export default function ComptesBloquesScreen() {
  const { showToast, toastElement } = useToast();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: BLOCKS_QUERY_KEY, queryFn: api.blocks.list });

  const unblockMutation = useMutation({
    mutationFn: (userId: string) => api.blocks.unblock(userId),
    onMutate: async (userId) => {
      await queryClient.cancelQueries({ queryKey: BLOCKS_QUERY_KEY });
      const previous = queryClient.getQueryData<BlocksResponse>(BLOCKS_QUERY_KEY);
      if (previous) {
        queryClient.setQueryData<BlocksResponse>(BLOCKS_QUERY_KEY, {
          blocked: previous.blocked.filter((entry) => entry.userId !== userId),
        });
      }
      return { previous };
    },
    onSuccess: (_data, userId, context) => {
      const username = context?.previous?.blocked.find((entry) => entry.userId === userId)?.username;
      if (username) showToast(`${username} est débloqué. Tu peux de nouveau l'ajouter.`, "success");
    },
    onError: (error, _userId, context) => {
      if (context?.previous) queryClient.setQueryData(BLOCKS_QUERY_KEY, context.previous);
      showToast(error instanceof ApiClientError ? error.userMessage : "Impossible de débloquer ce compte pour l'instant. Vérifie ta connexion puis réessaie.");
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: BLOCKS_QUERY_KEY }),
  });

  const blocked = query.data?.blocked ?? [];

  return (
    <SkyBackground variant="sky">
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 20, gap: 16 }}>
        {query.isPending ? (
          <GlassCard>
            <LoadingState accessibilityLabel="Chargement des comptes bloqués">
              <View className="gap-3">
                <Skeleton height={20} />
                <Skeleton height={20} />
              </View>
            </LoadingState>
          </GlassCard>
        ) : null}

        {query.isError && !query.data ? (
          <GlassCard>
            <ErrorState message="Vérifie ta connexion puis réessaie." onRetry={query.refetch} retrying={query.isFetching} />
          </GlassCard>
        ) : null}

        {query.data && blocked.length === 0 ? <EmptyState illustration="calm" title="Tu n'as bloqué personne." /> : null}

        {blocked.length > 0 ? (
          <GlassCard>
            <View className="gap-1">
              {blocked.map((entry) => (
                <ListRow
                  key={entry.userId}
                  title={entry.username}
                  trailing={
                    <Button
                      label="Débloquer"
                      variant="ghost"
                      size="compact"
                      onPress={() => unblockMutation.mutate(entry.userId)}
                      loading={unblockMutation.isPending && unblockMutation.variables === entry.userId}
                      accessibilityLabel={`Débloquer ${entry.username}`}
                    />
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
