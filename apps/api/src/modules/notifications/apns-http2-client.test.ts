// Timeout de `createNodeHttp2Client` (ADR 004, B12, revue R3) : une session Apple qui ne répond
// jamais (ni `response`, ni `error`) ne doit pas bloquer indéfiniment l'envoi.
import { EventEmitter } from "node:events";
import type { ClientHttp2Session, ClientHttp2Stream } from "node:http2";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { APNS_REQUEST_TIMEOUT_MS, createNodeHttp2Client } from "./apns-http2-client";

class FakeStream extends EventEmitter {
  setEncoding = vi.fn();
  end = vi.fn();
}

class FakeSession extends EventEmitter {
  destroy = vi.fn();
  close = vi.fn();
  stream = new FakeStream();
  request = vi.fn(() => this.stream);
}

describe("createNodeHttp2Client — timeout (revue R3)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("rejette et détruit la session après le délai si Apple ne répond jamais", async () => {
    const session = new FakeSession();
    const connectFn = vi.fn(() => session as unknown as ClientHttp2Session);
    const client = createNodeHttp2Client(connectFn);

    const post = client.post("https://api.push.apple.com", "/3/device/a", {}, "{}");
    const expectation = expect(post).rejects.toThrow(/délai/);

    await vi.advanceTimersByTimeAsync(APNS_REQUEST_TIMEOUT_MS);
    await expectation;

    expect(session.destroy).toHaveBeenCalledTimes(1);
    expect(session.close).not.toHaveBeenCalled();
  });

  it("ne déclenche plus le minuteur une fois la réponse reçue (pas de rejet tardif)", async () => {
    const session = new FakeSession();
    const connectFn = vi.fn(() => session as unknown as ClientHttp2Session);
    const client = createNodeHttp2Client(connectFn);

    const post = client.post("https://api.push.apple.com", "/3/device/a", {}, "{}");
    const stream = session.stream as unknown as ClientHttp2Stream & FakeStream;
    stream.emit("response", { ":status": 200 });
    stream.emit("end");

    const result = await post;
    expect(result.status).toBe(200);
    expect(session.close).toHaveBeenCalledTimes(1);

    // Le minuteur d'origine ne doit plus rien faire : ni rejet, ni second appel à destroy/close.
    await vi.advanceTimersByTimeAsync(APNS_REQUEST_TIMEOUT_MS);
    expect(session.destroy).not.toHaveBeenCalled();
    expect(session.close).toHaveBeenCalledTimes(1);
  });

  it("échec réseau immédiat ('error' de session) : rejet sans attendre le délai", async () => {
    const session = new FakeSession();
    const connectFn = vi.fn(() => session as unknown as ClientHttp2Session);
    const client = createNodeHttp2Client(connectFn);

    const post = client.post("https://api.push.apple.com", "/3/device/a", {}, "{}");
    const expectation = expect(post).rejects.toThrow("ECONNREFUSED");
    session.emit("error", new Error("ECONNREFUSED"));
    await expectation;

    expect(session.destroy).not.toHaveBeenCalled();
  });
});
