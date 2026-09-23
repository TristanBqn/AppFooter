// Connexion avec Apple (ADR 001) : nonce brut -> SHA-256 hex transmis à Apple ; jeton, code et
// nonce brut transmis à l'API, qui revérifie le nonce sur le JWT reçu d'Apple.
// Minimisation RGPD : aucune portée demandée (pas de nom, pas d'e-mail).
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import type { SignInResponse } from "@app/contracts";
import { api } from "../api/endpoints";
import { bytesToHex } from "./nonce";

export class AppleSignInCancelledError extends Error {
  constructor() {
    super("Connexion Apple annulée par l'utilisateur");
    this.name = "AppleSignInCancelledError";
  }
}

function isCancelled(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ERR_REQUEST_CANCELED");
}

async function createNonce(): Promise<{ raw: string; hashed: string }> {
  const bytes = await Crypto.getRandomBytesAsync(16);
  const raw = bytesToHex(bytes);
  const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, raw);
  return { raw, hashed };
}

export async function signInWithApple(): Promise<SignInResponse> {
  const { raw, hashed } = await createNonce();

  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({ nonce: hashed });
  } catch (error) {
    if (isCancelled(error)) throw new AppleSignInCancelledError();
    throw error;
  }

  if (!credential.identityToken || !credential.authorizationCode) {
    throw new Error("Réponse Apple incomplète : identityToken ou authorizationCode manquant.");
  }

  return api.auth.signInApple({
    identityToken: credential.identityToken,
    authorizationCode: credential.authorizationCode,
    nonce: raw,
  });
}
