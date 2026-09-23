import { beforeEach, describe, expect, it, vi } from "vitest";

const resolveHealthSourceKind = vi.fn();
vi.mock("./env", () => ({ resolveHealthSourceKind }));

vi.mock("@kingstinct/react-native-healthkit", () => ({
  ComparisonPredicateOperator: { notEqualTo: 5 },
  isHealthDataAvailableAsync: vi.fn(),
  requestAuthorization: vi.fn(),
  queryStatisticsCollectionForQuantity: vi.fn(),
}));

const { getHealthSource, resetHealthSourceForTests } = await import("./index");
const { SimulatedHealthSource } = await import("./SimulatedHealthSource");
const { HealthKitSource } = await import("./HealthKitSource");

beforeEach(() => {
  resolveHealthSourceKind.mockReset();
  resetHealthSourceForTests();
});

describe("getHealthSource", () => {
  it("choisit SimulatedHealthSource quand demandé", () => {
    resolveHealthSourceKind.mockReturnValue("simulated");
    expect(getHealthSource()).toBeInstanceOf(SimulatedHealthSource);
  });

  it("choisit HealthKitSource par défaut", () => {
    resolveHealthSourceKind.mockReturnValue("healthkit");
    expect(getHealthSource()).toBeInstanceOf(HealthKitSource);
  });

  it("ne choisit qu'une fois (cache)", () => {
    resolveHealthSourceKind.mockReturnValue("simulated");
    const first = getHealthSource();
    const second = getHealthSource();
    expect(first).toBe(second);
    expect(resolveHealthSourceKind).toHaveBeenCalledOnce();
  });
});
