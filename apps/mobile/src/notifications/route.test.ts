import { describe, expect, it } from "vitest";
import type { PushPayload } from "@app/contracts";
import { parsePushPayload, resolvePushRoute } from "./route";

const from = { fromUserId: "00000000-0000-0000-0000-000000000001", fromUsername: "lea" };

describe("resolvePushRoute", () => {
  it("milestone_self -> Accueil", () => {
    expect(resolvePushRoute({ type: "milestone_self", date: "2026-09-25", milestone: 10_000 })).toEqual({
      pathname: "/(tabs)/accueil",
    });
  });

  it("encouragement_received -> Accueil", () => {
    const payload: PushPayload = { type: "encouragement_received", ...from, messageId: "bravo" };
    expect(resolvePushRoute(payload)).toEqual({ pathname: "/(tabs)/accueil" });
  });

  it("friend_request_received -> Amis", () => {
    const payload: PushPayload = { type: "friend_request_received", ...from };
    expect(resolvePushRoute(payload)).toEqual({ pathname: "/(tabs)/amis" });
  });

  it("milestone_friend et friend_request_accepted -> fiche de l'ami", () => {
    const milestone: PushPayload = { type: "milestone_friend", ...from, milestone: 5_000 };
    const accepted: PushPayload = { type: "friend_request_accepted", ...from };
    const expected = { pathname: "/(tabs)/amis/[userId]", params: { userId: from.fromUserId, username: from.fromUsername } };
    expect(resolvePushRoute(milestone)).toEqual(expected);
    expect(resolvePushRoute(accepted)).toEqual(expected);
  });
});

describe("parsePushPayload", () => {
  it("lit une charge valide sous la clé footer", () => {
    const payload: PushPayload = { type: "milestone_self", date: "2026-09-25", milestone: 10_000 };
    expect(parsePushPayload({ footer: payload })).toEqual(payload);
  });

  it("renvoie null sans clé footer ou avec une charge invalide", () => {
    expect(parsePushPayload({})).toBeNull();
    expect(parsePushPayload({ footer: { type: "inconnu" } })).toBeNull();
    expect(parsePushPayload(null)).toBeNull();
    expect(parsePushPayload("texte")).toBeNull();
  });
});
