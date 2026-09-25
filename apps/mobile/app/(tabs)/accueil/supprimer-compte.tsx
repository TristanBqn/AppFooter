import { useState } from "react";
import { View } from "react-native";
import { router, Stack } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { AppText, Button, ConfirmSheet, Illustration, SkyBackground } from "@app/ui";
import { useAuth } from "../../../src/auth/AuthProvider";
import { api } from "../../../src/api/endpoints";
import { useToast } from "../../../src/hooks/useToast";

// Suppression du compte (M9, CA12, CA14, screens.md §10) : irréversible, confirmation obligatoire.
export default function SupprimerCompteScreen() {
  const { signOut } = useAuth();
  const { showToast, toastElement } = useToast();
  const [confirmVisible, setConfirmVisible] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: () => api.me.deleteAccount(),
    onSuccess: async () => {
      await signOut();
      router.replace({ pathname: "/(auth)/connexion", params: { deleted: "1" } });
    },
    onError: () => {
      setConfirmVisible(false);
      showToast("La suppression n'a pas abouti. Rien n'a été effacé ; réessaie dans un instant.");
    },
  });

  return (
    <SkyBackground variant="dawn">
      {/* Retour arrière désactivé pendant la suppression : action irréversible en cours. */}
      <Stack.Screen options={{ gestureEnabled: !deleteMutation.isPending }} />
      <View className="flex-1 items-center justify-center gap-4 px-screen">
        <Illustration kind="farewell" />
        <AppText variant="callout" color="textSecondary" style={{ textAlign: "center" }}>
          Nous allons effacer définitivement ton compte, ton pseudo, ton historique, tes amis et
          tes encouragements. Ta connexion Apple sera révoquée. Tes données dans Apple Santé ne
          sont pas touchées.
        </AppText>
        <Button
          label="Supprimer mon compte"
          variant="destructive"
          onPress={() => setConfirmVisible(true)}
          loading={deleteMutation.isPending}
        />
      </View>

      <ConfirmSheet
        visible={confirmVisible}
        title="Tout effacer définitivement ?"
        message="Cette action est irréversible."
        confirmLabel="Supprimer définitivement"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
        onCancel={() => setConfirmVisible(false)}
      />
      {toastElement}
    </SkyBackground>
  );
}
