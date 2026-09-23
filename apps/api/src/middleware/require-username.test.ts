import { SignInResponseSchema } from "@app/contracts";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { requireUsername } from "./require-username";
import { resetRateLimits } from "./rate-limit";
import { createTestApp, type TestApp } from "../test-support";

async function signInDev(testApp: TestApp, devUserKey: string) {
  const res = await testApp.app.request("/auth/dev", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ devUserKey }),
  });
  return SignInResponseSchema.parse(await res.json());
}

describe("requireUsername", () => {
  let testApp: TestApp;

  beforeEach(() => resetRateLimits());
  afterEach(async () => {
    await testApp?.close();
  });

  it("403 USERNAME_REQUIRED tant que le pseudonyme n'est pas choisi", async () => {
    testApp = await createTestApp();
    testApp.app.get("/scratch-username-guard", requireUsername, (c) => c.text("ok"));
    const signIn = await signInDev(testApp, "alice");

    const res = await testApp.app.request("/scratch-username-guard", {
      headers: { authorization: `Bearer ${signIn.session.token}` },
    });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe("USERNAME_REQUIRED");
  });

  it("laisse passer une fois le pseudonyme choisi", async () => {
    testApp = await createTestApp();
    testApp.app.get("/scratch-username-guard", requireUsername, (c) => c.text("ok"));
    const signIn = await signInDev(testApp, "alice");
    await testApp.app.request("/me/username", {
      method: "PUT",
      headers: { authorization: `Bearer ${signIn.session.token}`, "content-type": "application/json" },
      body: JSON.stringify({ username: "alice" }),
    });

    const res = await testApp.app.request("/scratch-username-guard", {
      headers: { authorization: `Bearer ${signIn.session.token}` },
    });
    expect(res.status).toBe(200);
  });
});
