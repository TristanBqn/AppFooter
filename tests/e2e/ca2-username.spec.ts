// CA2 : pseudonyme 3–20 caractères [a-z0-9_.], refusé si déjà pris (insensible à la casse).
import { expect, test } from "@playwright/test";
import { authHeader, devSignIn, randomDevUserKey, randomUsername } from "./support/api";

test.describe("CA2 : pseudonyme", () => {
  test("connexion de dev : needsUsername vrai avant le choix du pseudonyme", async ({ request }) => {
    const signIn = await devSignIn(request, randomDevUserKey("ca2new"));
    expect(signIn.needsUsername).toBe(true);
    expect(signIn.username).toBeNull();
  });

  test("format refusé (hors [a-z0-9_.] ou hors 3–20 caractères) ⇒ 400 VALIDATION_ERROR", async ({ request }) => {
    const signIn = await devSignIn(request, randomDevUserKey("ca2fmt"));
    const headers = authHeader(signIn.session.token);

    const tooShort = await request.put("/me/username", { headers, data: { username: "ab" } });
    expect(tooShort.status()).toBe(400);
    expect((await tooShort.json()).error.code).toBe("VALIDATION_ERROR");

    const badChars = await request.put("/me/username", { headers, data: { username: "invalide!" } });
    expect(badChars.status()).toBe(400);
    expect((await badChars.json()).error.code).toBe("VALIDATION_ERROR");
  });

  test("pseudonyme valide accepté une seule fois (409 USERNAME_ALREADY_SET ensuite)", async ({ request }) => {
    const signIn = await devSignIn(request, randomDevUserKey("ca2once"));
    const headers = authHeader(signIn.session.token);
    const username = randomUsername("ca2once");

    const first = await request.put("/me/username", { headers, data: { username } });
    expect(first.status()).toBe(200);
    const me = await first.json();
    expect(me.username).toBe(username);

    const second = await request.put("/me/username", { headers, data: { username: randomUsername("autre") } });
    expect(second.status()).toBe(409);
    expect((await second.json()).error.code).toBe("USERNAME_ALREADY_SET");
  });

  test("pseudonyme déjà pris refusé, y compris avec une casse différente ⇒ 409 USERNAME_TAKEN", async ({
    request,
  }) => {
    const ownerSignIn = await devSignIn(request, randomDevUserKey("ca2owner"));
    const username = randomUsername("ca2taken");
    const taken = await request.put("/me/username", {
      headers: authHeader(ownerSignIn.session.token),
      data: { username },
    });
    expect(taken.status()).toBe(200);

    const challengerSignIn = await devSignIn(request, randomDevUserKey("ca2chal"));
    const res = await request.put("/me/username", {
      headers: authHeader(challengerSignIn.session.token),
      data: { username: username.toUpperCase() },
    });
    expect(res.status()).toBe(409);
    expect((await res.json()).error.code).toBe("USERNAME_TAKEN");
  });
});
