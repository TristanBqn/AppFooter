// Session opaque (ADR 001) : jamais en AsyncStorage, toujours dans le trousseau natif via
// expo-secure-store sur iOS (seule cible de production, CLAUDE.md).
//
// `expo-secure-store` n'a pas d'implémentation native sur web (module vide, voir
// ExpoSecureStore.web.ts de la lib) : le moindre appel y lève une exception. Comme l'aperçu web
// Expo est utilisé pour le rendu visuel (docs/avancement.md), on bascule sur un repli en mémoire,
// réservé au web, jamais persistant et jamais utilisé en production (iPhone uniquement).
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { SessionSchema, type Session } from "@app/contracts";

const SESSION_KEY = "footer.session";

let webSessionMemory: string | null = null;

const webStore = {
  async getItemAsync(_key: string): Promise<string | null> {
    return webSessionMemory;
  },
  async setItemAsync(_key: string, value: string): Promise<void> {
    webSessionMemory = value;
  },
  async deleteItemAsync(_key: string): Promise<void> {
    webSessionMemory = null;
  },
};

function store() {
  return Platform.OS === "web" ? webStore : SecureStore;
}

export async function getSession(): Promise<Session | null> {
  const raw = await store().getItemAsync(SESSION_KEY);
  if (!raw) return null;
  try {
    return SessionSchema.parse(JSON.parse(raw));
  } catch {
    // Donnée corrompue ou format obsolète (migration) : on efface plutôt que de faire planter l'app.
    await store().deleteItemAsync(SESSION_KEY);
    return null;
  }
}

export async function setSession(session: Session): Promise<void> {
  await store().setItemAsync(SESSION_KEY, JSON.stringify(session));
}

export async function clearSession(): Promise<void> {
  await store().deleteItemAsync(SESSION_KEY);
}

export async function getToken(): Promise<string | null> {
  const session = await getSession();
  return session?.token ?? null;
}
