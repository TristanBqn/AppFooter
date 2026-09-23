import { beforeEach, describe, expect, it, vi } from "vitest";

const apiRequest = vi.fn().mockResolvedValue({ ok: true });
vi.mock("./http", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./http")>();
  return { ...actual, apiRequest };
});

const { api } = await import("./endpoints");

beforeEach(() => {
  apiRequest.mockClear();
});

describe("api (client typé)", () => {
  it("n'authentifie pas les routes publiques", async () => {
    await api.auth.signInApple({ identityToken: "t", authorizationCode: "c", nonce: "n".repeat(16) });
    expect(apiRequest).toHaveBeenCalledWith(expect.objectContaining({ method: "POST", path: "/auth/apple", auth: false }));
  });

  it("authentifie les routes protégées", async () => {
    await api.today();
    expect(apiRequest).toHaveBeenCalledWith(expect.objectContaining({ method: "GET", path: "/me/today", auth: true }));
  });

  it("substitue les paramètres de chemin", async () => {
    await api.friends.activity("11111111-1111-1111-1111-111111111111");
    expect(apiRequest).toHaveBeenCalledWith(
      expect.objectContaining({ method: "GET", path: "/friends/11111111-1111-1111-1111-111111111111/activity" }),
    );

    await api.friendRequests.accept("req-1");
    expect(apiRequest).toHaveBeenCalledWith(
      expect.objectContaining({ method: "POST", path: "/friend-requests/req-1/accept" }),
    );
  });

  it("transmet les paramètres de requête", async () => {
    await api.activity.history({ days: 7 });
    expect(apiRequest).toHaveBeenCalledWith(
      expect.objectContaining({ method: "GET", path: "/me/activity", query: { days: 7 } }),
    );
  });

  it("transmet le corps des requêtes de mutation", async () => {
    await api.encouragements.send({ toUserId: "11111111-1111-1111-1111-111111111111", messageId: "bravo" });
    expect(apiRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        path: "/encouragements",
        body: { toUserId: "11111111-1111-1111-1111-111111111111", messageId: "bravo" },
      }),
    );
  });
});
