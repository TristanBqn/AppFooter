import { describe, expect, it } from "vitest";
import { resolvePushEnvironment } from "./environment";

describe("resolvePushEnvironment", () => {
  it("production seulement en profil EAS production", () => {
    expect(resolvePushEnvironment("production")).toBe("production");
  });

  it("sandbox partout ailleurs (dev build, preview, local)", () => {
    expect(resolvePushEnvironment(null)).toBe("sandbox");
    expect(resolvePushEnvironment("development")).toBe("sandbox");
    expect(resolvePushEnvironment("preview")).toBe("sandbox");
  });
});
