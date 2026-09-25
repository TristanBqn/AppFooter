import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const secureStoreState = new Map<string, string>();

vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn(async (key: string) => secureStoreState.get(key) ?? null),
  setItemAsync: vi.fn(async (key: string, value: string) => {
    secureStoreState.set(key, value);
  }),
  deleteItemAsync: vi.fn(async (key: string) => {
    secureStoreState.delete(key);
  }),
}));

afterEach(() => {
  secureStoreState.clear();
});

// `react-native` est aliasé vers `react-native-web` par vitest.config.ts, dont `Platform.OS` vaut
// toujours "web" : on force explicitement "ios" pour ce bloc afin d'exercer la vraie branche
// SecureStore (celle utilisée en production, iPhone uniquement).
describe("session sur iOS (expo-secure-store)", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doMock("react-native", () => ({ Platform: { OS: "ios" } }));
  });

  async function loadSession() {
    return import("./session");
  }

  it("renvoie null sans session enregistrée", async () => {
    const { getSession, getToken } = await loadSession();
    expect(await getSession()).toBeNull();
    expect(await getToken()).toBeNull();
  });

  it("enregistre puis relit une session", async () => {
    const { setSession, getSession, getToken } = await loadSession();
    await setSession({ token: "a".repeat(40), expiresAt: "2026-01-01T00:00:00.000Z" });
    const session = await getSession();
    expect(session?.token).toBe("a".repeat(40));
    expect(await getToken()).toBe("a".repeat(40));
  });

  it("efface la session", async () => {
    const { setSession, clearSession, getSession } = await loadSession();
    await setSession({ token: "b".repeat(40), expiresAt: "2026-01-01T00:00:00.000Z" });
    await clearSession();
    expect(await getSession()).toBeNull();
  });

  it("efface une donnée corrompue au lieu de faire planter l'app", async () => {
    const { getSession } = await loadSession();
    secureStoreState.set("footer.session", "{ pas du json valide");
    expect(await getSession()).toBeNull();
    expect(secureStoreState.has("footer.session")).toBe(false);
  });
});

// Repli web (aperçu Expo, rendu visuel uniquement) : demande explicite du lead. `expo-secure-store`
// ne doit jamais être sollicité sur cette plateforme, sous peine d'exception (module natif absent).
describe("session sur web (repli en mémoire)", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doMock("react-native", () => ({ Platform: { OS: "web" } }));
  });

  async function loadSession() {
    return import("./session");
  }

  it("enregistre puis relit une session sans appeler expo-secure-store", async () => {
    const secureStore = await import("expo-secure-store");
    const { setSession, getSession, getToken } = await loadSession();

    await setSession({ token: "c".repeat(40), expiresAt: "2026-01-01T00:00:00.000Z" });

    expect(await getSession()).toEqual({ token: "c".repeat(40), expiresAt: "2026-01-01T00:00:00.000Z" });
    expect(await getToken()).toBe("c".repeat(40));
    expect(secureStore.setItemAsync).not.toHaveBeenCalled();
    expect(secureStore.getItemAsync).not.toHaveBeenCalled();
  });

  it("efface la session", async () => {
    const { setSession, clearSession, getSession } = await loadSession();
    await setSession({ token: "d".repeat(40), expiresAt: "2026-01-01T00:00:00.000Z" });
    await clearSession();
    expect(await getSession()).toBeNull();
  });

  it("renvoie null sans session enregistrée", async () => {
    const { getSession } = await loadSession();
    expect(await getSession()).toBeNull();
  });
});
