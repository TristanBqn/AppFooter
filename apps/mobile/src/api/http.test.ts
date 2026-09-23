import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ApiClientError } from "./errors";

const sessionMock = {
  getToken: vi.fn<() => Promise<string | null>>(),
  clearSession: vi.fn<() => Promise<void>>(),
};
vi.mock("./session", () => sessionMock);

const emitUnauthorized = vi.fn();
vi.mock("./authEvents", () => ({ emitUnauthorized }));

const { apiRequest } = await import("./http");

const ItemSchema = z.object({ ok: z.boolean() });

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

beforeEach(() => {
  sessionMock.getToken.mockReset().mockResolvedValue(null);
  sessionMock.clearSession.mockReset().mockResolvedValue(undefined);
  emitUnauthorized.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("apiRequest", () => {
  it("valide et renvoie une réponse conforme au schéma", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiRequest({ method: "GET", path: "/me/today", responseSchema: ItemSchema });

    expect(result).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:4000/me/today");
    expect(init.headers).not.toHaveProperty("Authorization");
  });

  it("ajoute le jeton Bearer quand une session existe", async () => {
    sessionMock.getToken.mockResolvedValue("le-jeton");
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await apiRequest({ method: "GET", path: "/me", responseSchema: ItemSchema });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer le-jeton");
  });

  it("ne renvoie rien pour une réponse 204", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiRequest({ method: "DELETE", path: "/friends/1" })).resolves.toBeUndefined();
  });

  it("mappe une erreur HTTP en ApiClientError avec message FR", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(409, { error: { code: "USERNAME_TAKEN", message: "taken" } }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiRequest({ method: "PUT", path: "/me/username" })).rejects.toMatchObject({
      code: "USERNAME_TAKEN",
      status: 409,
      userMessage: expect.stringContaining("déjà pris"),
    });
  });

  it("efface la session et prévient l'app sur un 401", async () => {
    sessionMock.getToken.mockResolvedValue("expiré");
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(401, { error: { code: "UNAUTHENTICATED", message: "no" } }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiRequest({ method: "GET", path: "/me", responseSchema: ItemSchema })).rejects.toBeInstanceOf(
      ApiClientError,
    );

    expect(sessionMock.clearSession).toHaveBeenCalledOnce();
    expect(emitUnauthorized).toHaveBeenCalledOnce();
  });

  it("distingue une erreur réseau (hors connexion)", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("Network request failed"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiRequest({ method: "GET", path: "/me/today" })).rejects.toMatchObject({
      kind: "network",
      userMessage: expect.stringContaining("connexion"),
    });
  });

  it("distingue un délai dépassé", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const pending = apiRequest({ method: "GET", path: "/me/today", timeoutMs: 1_000 });
    const assertion = expect(pending).rejects.toMatchObject({ kind: "timeout" });
    await vi.advanceTimersByTimeAsync(1_000);
    await assertion;
  });
});
