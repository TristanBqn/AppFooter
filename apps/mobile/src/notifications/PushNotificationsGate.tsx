import { useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useAuth } from "../auth/AuthProvider";
import { api } from "../api/endpoints";
import { resolvePushEnvironment } from "./environment";
import { parsePushPayload, resolvePushRoute } from "./route";

/**
 * Permission, jeton APNs -> `PUT /me/devices`, routage au toucher d'une notification (M10, CA10).
 * Composant sans rendu, monté une fois à la racine (app/_layout.tsx) sous `AuthProvider`.
 * Best effort partout : les push ne sont pas critiques au fonctionnement de l'app (dégradation
 * silencieuse acceptée ici, contrairement au reste de l'app, faute d'action utilisateur possible).
 */
export function PushNotificationsGate(): null {
  const { stage } = useAuth();
  const registeredRef = useRef(false);

  useEffect(() => {
    if (stage !== "ready" || registeredRef.current) return;
    registeredRef.current = true;
    void registerForPushNotifications();
  }, [stage]);

  useEffect(() => {
    function handleResponse(response: Notifications.NotificationResponse) {
      const payload = parsePushPayload(response.notification.request.content.data);
      if (payload) router.push(resolvePushRoute(payload));
    }

    let subscription: { remove: () => void } | undefined;
    try {
      subscription = Notifications.addNotificationResponseReceivedListener(handleResponse);
      void Notifications.getLastNotificationResponseAsync().then((response) => {
        if (response) handleResponse(response);
      });
    } catch {
      // Écouteur natif indisponible (web, environnement de test) : aucune conséquence, pas de push ici.
    }
    return () => subscription?.remove();
  }, []);

  return null;
}

async function registerForPushNotifications(): Promise<void> {
  try {
    const current = await Notifications.getPermissionsAsync();
    let granted = current.granted;
    if (!granted && current.canAskAgain) {
      granted = (await Notifications.requestPermissionsAsync()).granted;
    }
    if (!granted) return;

    const token = await Notifications.getDevicePushTokenAsync();
    if (typeof token.data !== "string") return; // web/simulateur : pas de jeton APNs réel.

    await api.me.registerDevice({ apnsToken: token.data.toLowerCase(), environment: resolvePushEnvironment() });
  } catch {
    // Best effort (voir commentaire de tête) : rien à afficher à l'utilisateur.
  }
}
