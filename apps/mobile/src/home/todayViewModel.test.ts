import { describe, expect, it } from "vitest";
import type { TodayResponse } from "@app/contracts";
import { buildTodayViewModel } from "./todayViewModel";

const SERVER: TodayResponse = {
  date: "2026-09-25",
  timeZone: "Europe/Paris",
  steps: 8450,
  activeCalories: 312,
  nextMilestone: 10_000,
  stepsToNextMilestone: 1550,
  rank: 2,
  participants: 5,
  lastSyncAt: "2026-09-25T08:00:00.000Z",
};

const LOCAL = { date: "2026-09-25", steps: 8900, activeCalories: 320 };

describe("buildTodayViewModel", () => {
  it("santé non connectée : consentement absent, peu importe le reste", () => {
    expect(
      buildTodayViewModel({ hasHealthConsent: false, isPending: false, isError: false, serverData: SERVER, localToday: LOCAL }),
    ).toEqual({ kind: "noConsent" });
  });

  it("chargement initial", () => {
    expect(
      buildTodayViewModel({ hasHealthConsent: true, isPending: true, isError: false, serverData: undefined, localToday: null }),
    ).toEqual({ kind: "loading" });
  });

  it("données serveur normales : pas de dégradation", () => {
    expect(
      buildTodayViewModel({ hasHealthConsent: true, isPending: false, isError: false, serverData: SERVER, localToday: null }),
    ).toEqual({
      kind: "data",
      steps: 8450,
      activeCalories: 312,
      rank: 2,
      participants: 5,
      lastSyncAt: "2026-09-25T08:00:00.000Z",
      degraded: false,
    });
  });

  it("erreur de synchro avec cache serveur : préfère la lecture locale pour les pas/calories, garde le rang", () => {
    expect(
      buildTodayViewModel({ hasHealthConsent: true, isPending: false, isError: true, serverData: SERVER, localToday: LOCAL }),
    ).toEqual({
      kind: "data",
      steps: 8900,
      activeCalories: 320,
      rank: 2,
      participants: 5,
      lastSyncAt: "2026-09-25T08:00:00.000Z",
      degraded: true,
    });
  });

  it("erreur de synchro avec cache serveur mais sans lecture locale : garde les données serveur", () => {
    expect(
      buildTodayViewModel({ hasHealthConsent: true, isPending: false, isError: true, serverData: SERVER, localToday: null }),
    ).toEqual({
      kind: "data",
      steps: 8450,
      activeCalories: 312,
      rank: 2,
      participants: 5,
      lastSyncAt: "2026-09-25T08:00:00.000Z",
      degraded: true,
    });
  });

  it("erreur totale sans aucun cache serveur mais lecture locale disponible : repli local, rang inconnu", () => {
    expect(
      buildTodayViewModel({ hasHealthConsent: true, isPending: false, isError: true, serverData: undefined, localToday: LOCAL }),
    ).toEqual({
      kind: "data",
      steps: 8900,
      activeCalories: 320,
      rank: null,
      participants: null,
      lastSyncAt: null,
      degraded: true,
    });
  });

  it("erreur totale sans aucun repli : état d'erreur bloquant", () => {
    expect(
      buildTodayViewModel({ hasHealthConsent: true, isPending: false, isError: true, serverData: undefined, localToday: null }),
    ).toEqual({ kind: "error" });
  });
});
