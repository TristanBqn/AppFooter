import { useState } from "react";
import { Linking, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { router } from "expo-router";
import { AppText, Button, GlassCard, Illustration, SkyBackground, SwitchRow } from "@app/ui";
import { useAuth } from "../../src/auth/AuthProvider";
import { api, PRIVACY_URL } from "../../src/api/endpoints";
import { ApiClientError } from "../../src/api/errors";
import { getHealthSource } from "../../src/health";
import { useToast } from "../../src/hooks/useToast";
import { emitGlobalToast } from "../../src/toastEvents";

// Consentement santé (RGPD art. 9), écran dédié et séparé des CGU (DESIGN.md §1, screens.md §1
// page 3). Affiché une seule fois, juste après le choix du pseudo (voir authStage.ts et
// app/(auth)/pseudo.tsx) ; ce n'est pas une porte permanente, l'Accueil (M5) gère l'état « Santé
// non connectée » si l'utilisateur ne consent pas ou refuse l'autorisation HealthKit.
const CONSENT_BULLETS = [
  "Tes pas et tes calories actives de chaque jour, lus dans Apple Santé.",
  "Seulement les totaux quotidiens, jamais le détail de tes mouvements.",
  "Les pas saisis à la main ne comptent pas.",
  "Tes amis acceptés voient tes pas (et tes calories si tu le veux).",
  "Tu peux tout effacer à tout moment depuis les Paramètres.",
] as const;

const CONSENT_SAVE_ERROR = "Impossible d'enregistrer ton accord pour l'instant. Vérifie ta connexion puis réessaie.";
const DECLINE_MESSAGE =
  "Pas de souci. Footer ne lira pas tes pas sans ton accord. Tu peux l'activer quand tu veux.";

type Step = "form" | "refused";

export default function ConsentementScreen() {
  const { refresh } = useAuth();
  const { showToast, toastElement } = useToast();
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<Step>("form");

  function goToAccueil() {
    router.replace("/(tabs)/accueil");
  }

  async function onOpenPrivacy() {
    await WebBrowser.openBrowserAsync(PRIVACY_URL);
  }

  // « Pas maintenant » (screens.md §1) : aucune synchro, aucun appel HealthKit, retour à l'Accueil
  // (pas à l'onboarding, le consentement est affiché après la connexion et le pseudo) avec le
  // toast rassurant exact du document ; l'Accueil s'affiche en état vide « consentement absent ».
  // M3 : `emitGlobalToast` (pas le `useToast` local, démonté par la navigation) — l'Accueil s'y
  // abonne via `onGlobalToast` et affiche le message une fois monté.
  function onDecline() {
    emitGlobalToast(DECLINE_MESSAGE, "info");
    goToAccueil();
  }

  async function onAccept() {
    if (!agreed || busy) return;
    setBusy(true);
    try {
      await api.me.setHealthConsent({ granted: true });
      await refresh();
    } catch (error) {
      setBusy(false);
      showToast(error instanceof ApiClientError ? error.userMessage : CONSENT_SAVE_ERROR);
      return;
    }

    try {
      const source = getHealthSource();
      const available = await source.isAvailable();
      // HealthKit ne révèle jamais côté app si l'utilisateur a refusé une autorisation de lecture
      // (conception vie privée d'Apple) : `requestAuthorization` indique seulement que la demande
      // a abouti, pas que l'accès a été accordé. C'est le signal le plus proche disponible malgré
      // tout ; à confirmer sur appareil réel (apps/mobile/docs/checklist-m11.md).
      const granted = available && (await source.requestAuthorization());
      if (!granted) {
        setStep("refused");
        return;
      }
      goToAccueil();
    } catch {
      setStep("refused");
    } finally {
      setBusy(false);
    }
  }

  function onOpenSettings() {
    Linking.openSettings();
  }

  if (step === "refused") {
    return (
      <SkyBackground variant="dawn">
        <View className="flex-1 items-center justify-center gap-4 px-screen">
          <Illustration kind="privacy" />
          <AppText variant="title1" style={{ textAlign: "center" }}>
            Autorise l'accès à Apple Santé
          </AppText>
          <AppText variant="callout" color="textSecondary" style={{ textAlign: "center" }}>
            {"Footer a besoin de tes pas pour fonctionner. Tu peux l'autoriser dans Réglages > Santé > Accès aux données > Footer."}
          </AppText>
          <View className="w-full gap-2">
            <Button label="Ouvrir Réglages" variant="secondary" onPress={onOpenSettings} />
            <Button label="Plus tard" variant="ghost" onPress={goToAccueil} />
          </View>
        </View>
        {toastElement}
      </SkyBackground>
    );
  }

  return (
    <SkyBackground variant="dawn">
      <View className="flex-1 justify-center gap-6 px-screen">
        <View className="items-center gap-2">
          <Illustration kind="privacy" />
          <AppText variant="title1" style={{ textAlign: "center" }}>
            Ce que Footer utilise
          </AppText>
        </View>

        <GlassCard>
          <View className="gap-3">
            {CONSENT_BULLETS.map((text) => (
              <View key={text} className="flex-row gap-2">
                <AppText color="accentText" aria-hidden>
                  •
                </AppText>
                <AppText variant="callout" color="textSecondary" style={{ flex: 1 }}>
                  {text}
                </AppText>
              </View>
            ))}
          </View>
        </GlassCard>

        <Button label="Lire la politique de confidentialité" variant="ghost" onPress={onOpenPrivacy} />

        <SwitchRow
          title="J'accepte que Footer traite mes données de pas et de calories"
          value={agreed}
          onValueChange={setAgreed}
        />

        <View className="gap-2">
          <Button
            label="J'accepte et je continue"
            onPress={onAccept}
            disabled={!agreed}
            loading={busy}
            accessibilityHint={!agreed ? "Active d'abord l'accord ci-dessus." : undefined}
          />
          <Button label="Pas maintenant" variant="ghost" onPress={onDecline} />
        </View>
      </View>
      {toastElement}
    </SkyBackground>
  );
}
