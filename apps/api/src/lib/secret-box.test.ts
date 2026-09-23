import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "./secret-box";

const key = randomBytes(32).toString("base64");

describe("encryptSecret / decryptSecret (AES-256-GCM)", () => {
  it("chiffre puis déchiffre à l'identique", () => {
    const plaintext = "refresh-token-très-secret";
    const ciphertext = encryptSecret(plaintext, key);
    expect(ciphertext).not.toContain(plaintext);
    expect(decryptSecret(ciphertext, key)).toBe(plaintext);
  });

  it("deux chiffrements du même texte diffèrent (IV aléatoire)", () => {
    const plaintext = "même-secret";
    expect(encryptSecret(plaintext, key)).not.toBe(encryptSecret(plaintext, key));
  });

  it("rejette une clé de mauvaise taille", () => {
    expect(() => encryptSecret("x", Buffer.from("trop-court").toString("base64"))).toThrow();
  });

  it("échoue si le texte chiffré est altéré (intégrité GCM)", () => {
    const ciphertext = encryptSecret("secret", key);
    const tampered = ciphertext.slice(0, -4) + "abcd";
    expect(() => decryptSecret(tampered, key)).toThrow();
  });
});
