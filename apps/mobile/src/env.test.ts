import { describe, expect, it, vi } from "vitest";

describe("getEasBuildProfile / isProductionBuild", () => {
  it("renvoie null hors build EAS", async () => {
    vi.doMock("expo-constants", () => ({ default: { expoConfig: { extra: {} } } }));
    const { getEasBuildProfile, isProductionBuild } = await import("./env");
    expect(getEasBuildProfile()).toBeNull();
    expect(isProductionBuild()).toBe(false);
    vi.doUnmock("expo-constants");
    vi.resetModules();
  });

  it("lit extra.easBuildProfile injecté par app.config.ts", async () => {
    vi.resetModules();
    vi.doMock("expo-constants", () => ({ default: { expoConfig: { extra: { easBuildProfile: "production" } } } }));
    const { getEasBuildProfile, isProductionBuild } = await import("./env");
    expect(getEasBuildProfile()).toBe("production");
    expect(isProductionBuild()).toBe(true);
    vi.doUnmock("expo-constants");
    vi.resetModules();
  });
});
