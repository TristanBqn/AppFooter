import { describe, expect, it } from "vitest";
import { ERROR_CODES } from "@app/contracts";
import { ApiClientError, apiClientErrorFromResponse, ERROR_MESSAGES_FR, UNEXPECTED_RESPONSE_MESSAGE_FR } from "./errors";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("ERROR_MESSAGES_FR", () => {
  it("couvre tous les codes d'erreur du contrat, en français, sans ton culpabilisant", () => {
    for (const code of ERROR_CODES) {
      const message = ERROR_MESSAGES_FR[code];
      expect(message, `message manquant pour ${code}`).toBeTruthy();
      expect(message.toLowerCase()).not.toContain("dernier");
    }
  });
});

describe("apiClientErrorFromResponse", () => {
  it("mappe une enveloppe d'erreur du contrat vers le message FR correspondant", async () => {
    const response = jsonResponse(409, { error: { code: "USERNAME_TAKEN", message: "username taken" } });
    const error = await apiClientErrorFromResponse(response);
    expect(error).toBeInstanceOf(ApiClientError);
    expect(error.kind).toBe("http");
    expect(error.code).toBe("USERNAME_TAKEN");
    expect(error.status).toBe(409);
    expect(error.userMessage).toBe(ERROR_MESSAGES_FR.USERNAME_TAKEN);
  });

  it("transmet les détails de validation (issues)", async () => {
    const response = jsonResponse(400, {
      error: { code: "VALIDATION_ERROR", message: "invalid", issues: [{ path: "username", message: "format" }] },
    });
    const error = await apiClientErrorFromResponse(response);
    expect(error.issues).toEqual([{ path: "username", message: "format" }]);
  });

  it("retombe sur un message générique si l'enveloppe est illisible", async () => {
    const response = new Response("<html>erreur serveur</html>", { status: 502 });
    const error = await apiClientErrorFromResponse(response);
    expect(error.kind).toBe("parse");
    expect(error.userMessage).toBe(UNEXPECTED_RESPONSE_MESSAGE_FR);
  });
});
