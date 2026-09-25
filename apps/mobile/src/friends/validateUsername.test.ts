import { describe, expect, it } from "vitest";
import { FRIEND_USERNAME_FORMAT_ERROR, validateFriendUsernameLocally } from "./validateUsername";

const BASE = { myUsername: "tom", friendUsernames: ["lea"], outgoingUsernames: ["sam.b"] };

describe("validateFriendUsernameLocally", () => {
  it("accepte un pseudo valide et inconnu", () => {
    expect(validateFriendUsernameLocally({ username: "marc_d", ...BASE })).toBeNull();
  });

  it("rejette un format invalide", () => {
    expect(validateFriendUsernameLocally({ username: "M", ...BASE })).toBe(FRIEND_USERNAME_FORMAT_ERROR);
    expect(validateFriendUsernameLocally({ username: "Marc-D", ...BASE })).toBe(FRIEND_USERNAME_FORMAT_ERROR);
  });

  it("rejette son propre pseudo", () => {
    expect(validateFriendUsernameLocally({ username: "tom", ...BASE })).toBe("C'est ton propre pseudo.");
  });

  it("rejette un ami déjà présent", () => {
    expect(validateFriendUsernameLocally({ username: "lea", ...BASE })).toBe("lea fait déjà partie de tes amis.");
  });

  it("rejette une demande déjà en attente", () => {
    expect(validateFriendUsernameLocally({ username: "sam.b", ...BASE })).toBe(
      "Ta demande à sam.b est déjà en attente.",
    );
  });

  it("myUsername null (pseudo pas encore chargé) : pas de faux positif", () => {
    expect(
      validateFriendUsernameLocally({ username: "marc_d", myUsername: null, friendUsernames: [], outgoingUsernames: [] }),
    ).toBeNull();
  });
});
