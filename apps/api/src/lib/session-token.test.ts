import { describe, expect, it } from "vitest";
import { extractBearerToken, generateSessionToken, hashSessionToken } from "./session-token";

describe("generateSessionToken / hashSessionToken", () => {
  it("génère des jetons uniques et suffisamment longs", () => {
    const a = generateSessionToken();
    const b = generateSessionToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(32);
  });

  it("le hachage est déterministe et sans lien évident avec le jeton", () => {
    const token = generateSessionToken();
    expect(hashSessionToken(token)).toBe(hashSessionToken(token));
    expect(hashSessionToken(token)).not.toContain(token);
    expect(hashSessionToken(token)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("extractBearerToken", () => {
  it("extrait le jeton d'un en-tête Bearer valide", () => {
    expect(extractBearerToken("Bearer abc123")).toBe("abc123");
  });
  it("insensible à la casse du schéma", () => {
    expect(extractBearerToken("bearer abc123")).toBe("abc123");
  });
  it.each([undefined, "", "abc123", "Basic abc123", "Bearer"])("renvoie null pour %j", (header) => {
    expect(extractBearerToken(header)).toBeNull();
  });
});
