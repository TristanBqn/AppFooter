import { afterEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, string>();

vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn(async (key: string) => store.get(key) ?? null),
  setItemAsync: vi.fn(async (key: string, value: string) => {
    store.set(key, value);
  }),
  deleteItemAsync: vi.fn(async (key: string) => {
    store.delete(key);
  }),
}));

const { getSession, setSession, clearSession, getToken } = await import("./session");

afterEach(() => {
  store.clear();
});

describe("session (expo-secure-store)", () => {
  it("renvoie null sans session enregistrée", async () => {
    expect(await getSession()).toBeNull();
    expect(await getToken()).toBeNull();
  });

  it("enregistre puis relit une session", async () => {
    await setSession({ token: "a".repeat(40), expiresAt: "2026-01-01T00:00:00.000Z" });
    const session = await getSession();
    expect(session?.token).toBe("a".repeat(40));
    expect(await getToken()).toBe("a".repeat(40));
  });

  it("efface la session", async () => {
    await setSession({ token: "b".repeat(40), expiresAt: "2026-01-01T00:00:00.000Z" });
    await clearSession();
    expect(await getSession()).toBeNull();
  });

  it("efface une donnée corrompue au lieu de faire planter l'app", async () => {
    store.set("footer.session", "{ pas du json valide");
    expect(await getSession()).toBeNull();
    expect(store.has("footer.session")).toBe(false);
  });
});
