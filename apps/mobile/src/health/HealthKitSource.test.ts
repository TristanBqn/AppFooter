import { beforeEach, describe, expect, it, vi } from "vitest";

// `notEqualTo` doit correspondre à `ComparisonPredicateOperator.notEqualTo` du vrai module
// (NSComparisonPredicate.Operator.notEqualTo = 5) : seule la valeur numérique traverse le pont
// natif, voir le compte rendu du spike M3.
const ComparisonPredicateOperator = { notEqualTo: 5 };
const isHealthDataAvailableAsync = vi.fn();
const requestAuthorizationMock = vi.fn();
const queryStatisticsCollectionForQuantity = vi.fn();

vi.mock("@kingstinct/react-native-healthkit", () => ({
  ComparisonPredicateOperator,
  isHealthDataAvailableAsync,
  requestAuthorization: requestAuthorizationMock,
  queryStatisticsCollectionForQuantity,
}));

const { HealthKitSource, EXCLUDE_USER_ENTERED_FILTER } = await import("./HealthKitSource");

beforeEach(() => {
  isHealthDataAvailableAsync.mockReset().mockResolvedValue(true);
  requestAuthorizationMock.mockReset().mockResolvedValue(true);
  queryStatisticsCollectionForQuantity.mockReset().mockResolvedValue([]);
});

describe("HealthKitSource", () => {
  it("expose le prédicat d'exclusion des saisies manuelles (CA4)", () => {
    expect(EXCLUDE_USER_ENTERED_FILTER).toEqual({
      withMetadataKey: "HKWasUserEntered",
      operatorType: ComparisonPredicateOperator.notEqualTo,
      value: true,
    });
  });

  it("isAvailable relaie isHealthDataAvailableAsync", async () => {
    isHealthDataAvailableAsync.mockResolvedValue(false);
    expect(await new HealthKitSource().isAvailable()).toBe(false);
  });

  it("demande l'autorisation de lecture des pas et calories actives, jamais l'écriture", async () => {
    await new HealthKitSource().requestAuthorization();
    expect(requestAuthorizationMock).toHaveBeenCalledWith({
      toRead: ["HKQuantityTypeIdentifierStepCount", "HKQuantityTypeIdentifierActiveEnergyBurned"],
    });
  });

  it("interroge les pas et les calories en excluant HKWasUserEntered=true, jour par jour", async () => {
    await new HealthKitSource().getDailyTotals("2026-01-01", "2026-01-02", "Europe/Paris");

    expect(queryStatisticsCollectionForQuantity).toHaveBeenCalledTimes(2);

    const [stepsCall, caloriesCall] = queryStatisticsCollectionForQuantity.mock.calls as [
      [string, string[], Date, { day: number }, { unit: string; filter: { metadata: unknown; date: { startDate: Date; endDate: Date } } }],
      [string, string[], Date, { day: number }, { unit: string; filter: { metadata: unknown; date: { startDate: Date; endDate: Date } } }],
    ];

    expect(stepsCall[0]).toBe("HKQuantityTypeIdentifierStepCount");
    expect(stepsCall[1]).toEqual(["cumulativeSum"]);
    expect(stepsCall[3]).toEqual({ day: 1 });
    expect(stepsCall[4].unit).toBe("count");
    expect(stepsCall[4].filter.metadata).toEqual(EXCLUDE_USER_ENTERED_FILTER);
    expect(stepsCall[4].filter.date.startDate).toEqual(new Date(2026, 0, 1));
    expect(stepsCall[4].filter.date.endDate).toEqual(new Date(2026, 0, 3)); // lendemain du dernier jour (borne exclusive)

    expect(caloriesCall[0]).toBe("HKQuantityTypeIdentifierActiveEnergyBurned");
    expect(caloriesCall[4].unit).toBe("kcal");
    expect(caloriesCall[4].filter.metadata).toEqual(EXCLUDE_USER_ENTERED_FILTER);
  });

  it("agrège la réponse native en DailyTotal", async () => {
    queryStatisticsCollectionForQuantity
      .mockResolvedValueOnce([{ startDate: new Date(2026, 0, 1), sumQuantity: { quantity: 8450 } }])
      .mockResolvedValueOnce([{ startDate: new Date(2026, 0, 1), sumQuantity: { quantity: 312 } }]);

    const days = await new HealthKitSource().getDailyTotals("2026-01-01", "2026-01-01", "Europe/Paris");

    expect(days).toEqual([{ date: "2026-01-01", steps: 8450, activeCalories: 312 }]);
  });
});
