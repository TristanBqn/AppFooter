import { useEffect, useState } from "react";
import { Linking, ScrollView, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as WebBrowser from "expo-web-browser";
import type { Settings, UpdateSettingsRequest } from "@app/contracts";
import { AppText, Button, ErrorState, GlassCard, ListRow, LoadingState, Skeleton, SkyBackground, SwitchRow } from "@app/ui";
import { useAuth } from "../../../src/auth/AuthProvider";
import { api, PRIVACY_URL } from "../../../src/api/endpoints";
import { formatLocalTime, parseLocalTime } from "../../../src/settings/localTime";
import { mergeSettings } from "../../../src/settings/mergeSettings";
import { BLOCKS_QUERY_KEY, SETTINGS_QUERY_KEY } from "../../../src/settings/queryKeys";
import { useToast } from "../../../src/hooks/useToast";

// Paramètres (M9/M10, CA10/CA11/CA12, screens.md §9).
const SETTINGS_SAVE_ERROR = "Réglage non enregistré. Vérifie ta connexion puis réessaie.";

export default function ParametresScreen() {
  const { me, signOut } = useAuth();
  const { showToast, toastElement } = useToast();
  const queryClient = useQueryClient();
  const [notificationsBlocked, setNotificationsBlocked] = useState(false);

  const settingsQuery = useQuery({ queryKey: SETTINGS_QUERY_KEY, queryFn: api.me.getSettings });
  const blocksQuery = useQuery({ queryKey: BLOCKS_QUERY_KEY, queryFn: api.blocks.list });

  useEffect(() => {
    let active = true;
    Notifications.getPermissionsAsync()
      .then((settings) => {
        if (active) setNotificationsBlocked(!settings.granted);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const updateMutation = useMutation({
    mutationFn: (patch: UpdateSettingsRequest) => api.me.updateSettings(patch),
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: SETTINGS_QUERY_KEY });
      const previous = queryClient.getQueryData<Settings>(SETTINGS_QUERY_KEY);
      if (previous) queryClient.setQueryData<Settings>(SETTINGS_QUERY_KEY, mergeSettings(previous, patch));
      return { previous };
    },
    onError: (_error, _patch, context) => {
      if (context?.previous) queryClient.setQueryData(SETTINGS_QUERY_KEY, context.previous);
      showToast(SETTINGS_SAVE_ERROR);
    },
    onSuccess: (data) => queryClient.setQueryData(SETTINGS_QUERY_KEY, data),
  });

  async function onLogout() {
    try {
      await api.auth.logout();
    } catch {
      // Déconnexion locale malgré tout : la session côté serveur expirera d'elle-même.
    }
    await signOut();
    router.replace("/(auth)/connexion");
  }

  const settings = settingsQuery.data;
  const healthConnected = Boolean(me?.healthConsentAt);

  return (
    <SkyBackground variant="sky">
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 20, gap: 16 }}>
        <GlassCard>
          <View className="gap-1">
            <AppText variant="footnote" color="textSecondary">
              MON COMPTE
            </AppText>
            <ListRow title="Pseudo" value={me?.username ?? ""} />
            <ListRow title="Se déconnecter" titleColor="accentText" onPress={onLogout} />
          </View>
        </GlassCard>

        {settingsQuery.isPending ? (
          <GlassCard>
            <LoadingState accessibilityLabel="Chargement des paramètres">
              <View className="gap-3">
                <Skeleton height={20} />
                <Skeleton height={20} />
                <Skeleton height={20} />
              </View>
            </LoadingState>
          </GlassCard>
        ) : null}

        {settingsQuery.isError && !settings ? (
          <GlassCard>
            <ErrorState message="Vérifie ta connexion puis réessaie." onRetry={settingsQuery.refetch} retrying={settingsQuery.isFetching} />
          </GlassCard>
        ) : null}

        {settings ? (
          <>
            <GlassCard>
              <View className="gap-1">
                <AppText variant="footnote" color="textSecondary">
                  CONFIDENTIALITÉ
                </AppText>
                <SwitchRow
                  title="Afficher mes calories à mes amis"
                  subtitle="Tes amis voient seulement tes pas si c'est désactivé."
                  value={settings.privacy.showCalories}
                  onValueChange={(value) => updateMutation.mutate({ privacy: { showCalories: value } })}
                />
                <SwitchRow
                  title="Accepter les demandes d'amitié"
                  subtitle="Désactivé : personne ne peut t'ajouter."
                  value={settings.privacy.acceptFriendRequests}
                  onValueChange={(value) => updateMutation.mutate({ privacy: { acceptFriendRequests: value } })}
                />
                <SwitchRow
                  title="Partager mes paliers avec mes amis"
                  subtitle="Tes amis sont prévenus quand tu franchis 5 000, 10 000 ou 15 000 pas."
                  value={settings.privacy.shareMilestones}
                  onValueChange={(value) => updateMutation.mutate({ privacy: { shareMilestones: value } })}
                />
                <ListRow
                  title="Politique de confidentialité"
                  onPress={() => WebBrowser.openBrowserAsync(PRIVACY_URL)}
                />
              </View>
            </GlassCard>

            <GlassCard>
              <View className="gap-1">
                <AppText variant="footnote" color="textSecondary">
                  NOTIFICATIONS
                </AppText>
                {notificationsBlocked ? (
                  <View className="gap-2" style={{ paddingVertical: 8 }}>
                    <AppText variant="footnote" color="warning">
                      Les notifications sont désactivées pour Footer.
                    </AppText>
                    <Button label="Ouvrir Réglages" variant="ghost" size="compact" onPress={() => Linking.openSettings()} />
                  </View>
                ) : null}
                <SwitchRow
                  title="Mes paliers de pas"
                  value={settings.notifications.milestones}
                  disabled={notificationsBlocked}
                  onValueChange={(value) => updateMutation.mutate({ notifications: { milestones: value } })}
                />
                <SwitchRow
                  title="Paliers de mes amis"
                  value={settings.notifications.friendMilestones}
                  disabled={notificationsBlocked}
                  onValueChange={(value) => updateMutation.mutate({ notifications: { friendMilestones: value } })}
                />
                <SwitchRow
                  title="Encouragements reçus"
                  value={settings.notifications.encouragements}
                  disabled={notificationsBlocked}
                  onValueChange={(value) => updateMutation.mutate({ notifications: { encouragements: value } })}
                />
                <SwitchRow
                  title="Demandes d'amitié"
                  value={settings.notifications.friendRequests}
                  disabled={notificationsBlocked}
                  onValueChange={(value) => updateMutation.mutate({ notifications: { friendRequests: value } })}
                />
                <SwitchRow
                  title="Heures silencieuses"
                  subtitle="Aucune notification non urgente pendant ces heures."
                  value={settings.quietHours.enabled}
                  disabled={notificationsBlocked}
                  onValueChange={(value) => updateMutation.mutate({ quietHours: { ...settings.quietHours, enabled: value } })}
                />
                {settings.quietHours.enabled ? (
                  <>
                    <QuietHoursRow
                      label="Début"
                      value={settings.quietHours.start}
                      onChange={(start) => updateMutation.mutate({ quietHours: { ...settings.quietHours, start } })}
                    />
                    <QuietHoursRow
                      label="Fin"
                      value={settings.quietHours.end}
                      onChange={(end) => updateMutation.mutate({ quietHours: { ...settings.quietHours, end } })}
                    />
                    <AppText variant="footnote" color="textSecondary">
                      Les notifications retenues arrivent à la fin de la période.
                    </AppText>
                  </>
                ) : null}
              </View>
            </GlassCard>

            <GlassCard>
              <ListRow
                title="Accès à Apple Santé"
                value={healthConnected ? "Connecté" : "Non autorisé"}
                onPress={() => Linking.openSettings()}
              />
            </GlassCard>

            <GlassCard>
              <ListRow
                title="Comptes bloqués"
                value={blocksQuery.data ? String(blocksQuery.data.blocked.length) : "…"}
                onPress={() => router.push("/(tabs)/accueil/comptes-bloques")}
              />
            </GlassCard>

            <GlassCard>
              <ListRow title="Supprimer mon compte" titleColor="danger" onPress={() => router.push("/(tabs)/accueil/supprimer-compte")} />
            </GlassCard>
          </>
        ) : null}
      </ScrollView>
      {toastElement}
    </SkyBackground>
  );
}

function QuietHoursRow({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <View className="flex-row items-center justify-between" style={{ minHeight: 44 }}>
      <AppText variant="body">{`${label} ${value.replace(":", " h ")}`}</AppText>
      <DateTimePicker
        mode="time"
        display="compact"
        value={parseLocalTime(value)}
        accessibilityLabel={`Heure de ${label.toLowerCase()} des heures silencieuses`}
        onChange={(_event, date) => {
          if (date) onChange(formatLocalTime(date));
        }}
      />
    </View>
  );
}
