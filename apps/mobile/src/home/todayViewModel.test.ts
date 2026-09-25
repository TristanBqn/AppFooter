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

const BASE = { authLoading: false, isPending: false, isError: false, syncError: false, localToday: null };

describe("buildTodayViewModel", () => {
  it("M4 : /me pas encore chargé, peu importe le reste", () => {
    expect(
      buildTodayViewModel({ ...BASE, authLoading: true, hasHealthConsent: false, serverData: SERVER }),
    ).toEqual({ kind: "loading" });
  });

  it("santé non connectée : consentement absent, peu importe le reste", () => {
    expect(
      buildTodayViewModel({ ...BASE, hasHealthConsent: false, serverData: SERVER, localToday: LOCAL }),
    ).toEqual({ kind: "noConsent" });
  });

  it("chargement initial", () => {
    expect(
      buildTodayViewModel({ ...BASE, hasHealthConsent: true, isPending: true, serverData: undefined }),
    ).toEqual({ kind: "loading" });
  });

  it("données serveur normales : pas de dégradation", () => {
    expect(buildTodayViewModel({ ...BASE, hasHealthConsent: true, serverData: SERVER })).toEqual({
      kind: "data",
      steps: 8450,
      activeCalories: 312,
      rank: 2,
      participants: 5,
      lastSyncAt: "2026-09-25T08:00:00.000Z",
      degraded: false,
    });
  });

  it("erreur de lecture avec cache serveur : préfère la lecture locale pour les pas/calories, garde le rang", () => {
    expect(
      buildTodayViewModel({ ...BASE, hasHealthConsent: true, isError: true, serverData: SERVER, localToday: LOCAL }),
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

  it("erreur de lecture avec cache serveur mais sans lecture locale : garde les données serveur", () => {
    expect(buildTodayViewModel({ ...BASE, hasHealthConsent: true, isError: true, serverData: SERVER })).toEqual({
      kind: "data",
      steps: 8450,
      activeCalories: 312,
      rank: 2,
      participants: 5,
      lastSyncAt: "2026-09-25T08:00:00.000Z",
      degraded: true,
    });
  });

  it("M5 : erreur de synchro (PUT /me/activity) seule, avec cache serveur et lecture locale : dégradé", () => {
    expect(
      buildTodayViewModel({ ...BASE, hasHealthConsent: true, syncError: true, serverData: SERVER, localToday: LOCAL }),
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

  it("erreur totale sans aucun cache serveur mais lecture locale disponible : repli local, rang inconnu", () => {
    expect(
      buildTodayViewModel({ ...BASE, hasHealthConsent: true, isError: true, serverData: undefined, localToday: LOCAL }),
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
    expect(buildTodayViewModel({ ...BASE, hasHealthConsent: true, isError: true, serverData: undefined })).toEqual({
      kind: "error",
    });
  });
});
