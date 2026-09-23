// Session opaque (ADR 001) : jamais en AsyncStorage, toujours dans le trousseau natif via
// expo-secure-store.
import * as SecureStore from "expo-secure-store";
import { SessionSchema, type Session } from "@app/contracts";

const SESSION_KEY = "footer.session";

export async function getSession(): Promise<Session | null> {
  const raw = await SecureStore.getItemAsync(SESSION_KEY);
  if (!raw) return null;
  try {
    return SessionSchema.parse(JSON.parse(raw));
  } catch {
    // Donnée corrompue ou format obsolète (migration) : on efface plutôt que de faire planter l'app.
    await SecureStore.deleteItemAsync(SESSION_KEY);
    return null;
  }
}

export async function setSession(session: Session): Promise<void> {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}

export async function getToken(): Promise<string | null> {
  const session = await getSession();
  return session?.token ?? null;
}
