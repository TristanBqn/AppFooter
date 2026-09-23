import { exportPKCS8, generateKeyPair } from "jose";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createAppleTokenClient } from "./token-client";

describe("createAppleTokenClient", () => {
  let privateKeyPem: string;

  beforeAll(async () => {
    const { privateKey } = await generateKeyPair("ES256", { extractable: true });
    privateKeyPem = await exportPKCS8(privateKey);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function client() {
    return createAppleTokenClient({ bundleId: "com.footer.app", teamId: "TEAM123", keyId: "KEY123", privateKeyPem });
  }

  it("exchangeCode renvoie le refresh_token si Apple répond 200", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ refresh_token: "rt-123" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(client().exchangeCode("code-abc")).resolves.toBe("rt-123");
    expect(fetchMock).toHaveBeenCalledWith("https://appleid.apple.com/auth/token", expect.objectContaining({ method: "POST" }));
  });

  it("exchangeCode renvoie null si Apple répond une erreur HTTP (best effort, ADR 001)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("erreur", { status: 400 })));
    await expect(client().exchangeCode("code-abc")).resolves.toBeNull();
  });

  it("exchangeCode renvoie null si Apple est injoignable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("réseau indisponible")));
    await expect(client().exchangeCode("code-abc")).resolves.toBeNull();
  });

  it("revoke ne lève jamais, même en cas d'échec réseau (ADR 006 : suppression malgré tout)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("réseau indisponible")));
    await expect(client().revoke("rt-123")).resolves.toBeUndefined();
  });
});
