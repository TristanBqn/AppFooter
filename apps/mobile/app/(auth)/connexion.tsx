import { useEffect, useState } from "react";
import { View } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import { router, useLocalSearchParams } from "expo-router";
import { AppText, Button, SkyBackground } from "@app/ui";
import { useAuth } from "../../src/auth/AuthProvider";
import { AppleSignInCancelledError, signInWithApple } from "../../src/auth/appleSignIn";
import { api } from "../../src/api/endpoints";
import { ApiClientError } from "../../src/api/errors";
import { isProductionBuild } from "../../src/env";
import { useToast } from "../../src/hooks/useToast";

const DEV_USER_KEY = "dev";

export default function ConnexionScreen() {
  const { signIn } = useAuth();
  const { showToast, toastElement } = useToast();
  const { deleted } = useLocalSearchParams<{ deleted?: string }>();
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [busy, setBusy] = useState<"apple" | "dev" | null>(null);

  useEffect(() => {
    let active = true;
    AppleAuthentication.isAvailableAsync().then((available) => {
      if (active) setAppleAvailable(available);
    });
    return () => {
      active = false;
    };
  }, []);

  // Retour après suppression du compte (M9, screens.md §10) : message ponctuel, pas d'erreur.
  useEffect(() => {
    if (deleted === "1") {
      showToast("Ton compte a été supprimé. Merci d'avoir marché avec nous.", "info");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deleted]);

  async function afterSignIn(session: { token: string; expiresAt: string }) {
    await signIn(session);
    router.replace("/");
  }

  async function onApplePress() {
    setBusy("apple");
    try {
      const response = await signInWithApple();
      await afterSignIn(response.session);
    } catch (error) {
      if (error instanceof AppleSignInCancelledError) {
        // Annulation par l'utilisateur : aucun message (DESIGN.md §2).
      } else if (error instanceof ApiClientError) {
        showToast(error.userMessage);
      } else {
        showToast("Connexion impossible pour l'instant. Vérifie ta connexion puis réessaie.");
      }
    } finally {
      setBusy(null);
    }
  }

  async function onDevPress() {
    setBusy("dev");
    try {
      const response = await api.auth.signInDev({ devUserKey: DEV_USER_KEY });
      await afterSignIn(response.session);
    } catch (error) {
      showToast(error instanceof ApiClientError ? error.userMessage : "Connexion de développement impossible.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <SkyBackground variant="dawn">
      <View className="flex-1 items-center justify-center gap-2 px-screen">
        <AppText variant="largeTitle">Footer</AppText>
        <AppText variant="callout" color="textSecondary" style={{ textAlign: "center", marginBottom: 32 }}>
          Marche un peu plus, ensemble.
        </AppText>

        {appleAvailable ? (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE_OUTLINE}
            cornerRadius={26}
            style={{ width: "100%", height: 52 }}
            onPress={onApplePress}
          />
        ) : (
          <Button
            label="Connexion avec Apple"
            onPress={onApplePress}
            loading={busy === "apple"}
            accessibilityHint="Sign in with Apple n'est pas disponible sur cet aperçu"
          />
        )}

        <AppText variant="footnote" color="textSecondary" style={{ textAlign: "center", marginTop: 16 }}>
          En continuant, tu acceptes les conditions d'utilisation et la politique de confidentialité.
        </AppText>

        {!isProductionBuild() ? (
          <View className="mt-8 items-center gap-2">
            <View style={{ height: 1, width: "100%", backgroundColor: "rgba(11,37,69,0.1)" }} />
            <Button
              label="DEV — Connexion de développement"
              variant="ghost"
              onPress={onDevPress}
              loading={busy === "dev"}
            />
          </View>
        ) : null}
      </View>
      {toastElement}
    </SkyBackground>
  );
}
