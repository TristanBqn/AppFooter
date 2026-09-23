import { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH, USERNAME_PATTERN } from "@app/contracts";
import { AppText, Button, SkyBackground, TextField } from "@app/ui";
import { useAuth } from "../../src/auth/AuthProvider";
import { api } from "../../src/api/endpoints";
import { ApiClientError } from "../../src/api/errors";
import { useToast } from "../../src/hooks/useToast";

const FORMAT_ERROR = "Utilise seulement des lettres minuscules, des chiffres, _ ou . (3 à 20).";

function isValidFormat(value: string): boolean {
  return value.length >= USERNAME_MIN_LENGTH && value.length <= USERNAME_MAX_LENGTH && USERNAME_PATTERN.test(value);
}

export default function PseudoScreen() {
  const { refresh } = useAuth();
  const { showToast, toastElement } = useToast();
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);

  const formatValid = isValidFormat(username);

  async function onSubmit() {
    if (!formatValid) {
      setError(FORMAT_ERROR);
      return;
    }
    setError(undefined);
    setSubmitting(true);
    try {
      await api.me.setUsername({ username });
      await refresh();
      // Consentement santé montré une fois, juste après le pseudo (voir authStage.ts).
      router.replace("/(auth)/consentement");
    } catch (submitError) {
      if (submitError instanceof ApiClientError && submitError.code === "USERNAME_TAKEN") {
        setError("Ce pseudo est déjà pris. Essaie une variante, par exemple tom.marche.");
      } else if (submitError instanceof ApiClientError && submitError.code === "VALIDATION_ERROR") {
        setError(FORMAT_ERROR);
      } else {
        showToast("Impossible de vérifier pour l'instant. Réessaie dans un instant.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SkyBackground variant="dawn">
      <View className="flex-1 justify-center gap-6 px-screen">
        <View className="gap-2">
          <AppText variant="title1">Choisis ton pseudo</AppText>
          <AppText variant="callout" color="textSecondary">
            C'est ce que tes amis taperont pour t'ajouter.
          </AppText>
        </View>

        <TextField
          label="Pseudo"
          value={username}
          onChangeText={(text) => setUsername(text.toLowerCase())}
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="username"
          maxLength={USERNAME_MAX_LENGTH}
          error={error}
          helper={error ? undefined : "3 à 20 caractères : lettres minuscules, chiffres, _ et ."}
          returnKeyType="go"
          onSubmitEditing={onSubmit}
        />

        <Button label="C'est parti" onPress={onSubmit} disabled={!formatValid} loading={submitting} />
      </View>
      {toastElement}
    </SkyBackground>
  );
}
