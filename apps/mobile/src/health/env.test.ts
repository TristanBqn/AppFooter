import { describe, expect, it } from "vitest";
import { resolveHealthSourceKind } from "./env";

describe("resolveHealthSourceKind", () => {
  it("choisit healthkit par défaut", () => {
    expect(resolveHealthSourceKind(undefined, null)).toBe("healthkit");
    expect(resolveHealthSourceKind("healthkit", null)).toBe("healthkit");
  });

  it("choisit simulated hors production", () => {
    expect(resolveHealthSourceKind("simulated", null)).toBe("simulated");
    expect(resolveHealthSourceKind("simulated", "development")).toBe("simulated");
  });

  it("refuse simulated en profil EAS production (ADR 002)", () => {
    expect(() => resolveHealthSourceKind("simulated", "production")).toThrow(/production/);
  });

  it("n'empêche pas healthkit en production", () => {
    expect(resolveHealthSourceKind("healthkit", "production")).toBe("healthkit");
    expect(resolveHealthSourceKind(undefined, "production")).toBe("healthkit");
  });
});
