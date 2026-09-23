import { describe, expect, it } from "vitest";
import {
  API_ROUTES,
  ApiErrorSchema,
  CreateFriendRequestSchema,
  ENCOURAGEMENT_CATALOG,
  ERROR_STATUS,
  PUBLIC_ROUTES,
  SendEncouragementRequestSchema,
  STEP_MILESTONES,
  SetUsernameRequestSchema,
  SyncActivityRequestSchema,
  UpdateSettingsRequestSchema,
} from "./index";

describe("pseudonyme (CA2)", () => {
  it("normalise en minuscules et accepte [a-z0-9_.]", () => {
    expect(SetUsernameRequestSchema.parse({ username: "  Lea.M_42 " }).username).toBe("lea.m_42");
  });
  it.each(["ab", "a".repeat(21), "léa", "lea-m", "lea m"])("refuse %j", (username) => {
    expect(SetUsernameRequestSchema.safeParse({ username }).success).toBe(false);
  });
  it("l'ajout d'ami exige un pseudonyme au format exact", () => {
    expect(CreateFriendRequestSchema.safeParse({ username: "le" }).success).toBe(false);
  });
});

describe("synchronisation (CA3)", () => {
  const day = { date: "2026-09-21", steps: 8000, activeCalories: 310 };
  it("accepte des totaux quotidiens avec fuseau IANA", () => {
    expect(SyncActivityRequestSchema.safeParse({ timeZone: "Europe/Paris", days: [day] }).success).toBe(true);
  });
  it("refuse fuseau invalide, date invalide, dates en double, valeurs négatives", () => {
    const bad = [
      { timeZone: "Mars/Olympus", days: [day] },
      { timeZone: "Europe/Paris", days: [{ ...day, date: "2026-02-30" }] },
      { timeZone: "Europe/Paris", days: [day, day] },
      { timeZone: "Europe/Paris", days: [{ ...day, steps: -1 }] },
      { timeZone: "Europe/Paris", days: [] },
    ];
    for (const body of bad) expect(SyncActivityRequestSchema.safeParse(body).success).toBe(false);
  });
});

describe("encouragements (CA9)", () => {
  const toUserId = "7d0f7a4e-4a4b-4b8e-9d7b-2f3c1a2b3c4d";
  it("catalogue fermé d'environ 6 messages, identifiants uniques", () => {
    const ids = ENCOURAGEMENT_CATALOG.map((m) => m.id);
    expect(ids.length).toBe(6);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("refuse tout texte libre ou identifiant hors catalogue", () => {
    expect(SendEncouragementRequestSchema.safeParse({ toUserId, messageId: "bravo" }).success).toBe(true);
    expect(SendEncouragementRequestSchema.safeParse({ toUserId, messageId: "bravo", text: "yo" }).success).toBe(false);
    expect(SendEncouragementRequestSchema.safeParse({ toUserId, messageId: "custom" }).success).toBe(false);
  });
});

describe("paramètres et constantes", () => {
  it("heures silencieuses : format HH:MM, bornes distinctes", () => {
    expect(UpdateSettingsRequestSchema.safeParse({ quietHours: { enabled: true, start: "22:00", end: "08:00" } }).success).toBe(true);
    expect(UpdateSettingsRequestSchema.safeParse({ quietHours: { enabled: true, start: "24:00", end: "08:00" } }).success).toBe(false);
    expect(UpdateSettingsRequestSchema.safeParse({ quietHours: { enabled: true, start: "08:00", end: "08:00" } }).success).toBe(false);
  });
  it("seuils croissants 5k/10k/15k", () => {
    expect([...STEP_MILESTONES]).toEqual([5000, 10000, 15000]);
  });
  it("enveloppe d'erreur et statuts cohérents", () => {
    expect(ApiErrorSchema.safeParse({ error: { code: "ENCOURAGEMENT_LIMIT", message: "x" } }).success).toBe(true);
    expect(ERROR_STATUS.ENCOURAGEMENT_LIMIT).toBe(429);
    expect(ERROR_STATUS.UNAUTHENTICATED).toBe(401);
  });
  it("routes publiques limitées à /health, /privacy et /auth/* hors logout (CA1)", () => {
    for (const name of PUBLIC_ROUTES) {
      expect(API_ROUTES[name]).toMatch(/^(GET \/health|GET \/privacy|POST \/auth\/(apple|dev))$/);
    }
  });
});
