// Composition des clients Apple à partir de l'environnement (ADR 001). Sans configuration
// (dev sans clés Apple : on utilise `/auth/dev`), des implémentations neutres évitent un crash
// au démarrage tout en refusant clairement toute tentative de connexion Apple.
import type { Env } from "../../../env";
import { AppError } from "../../../errors";
import { createAppleIdentityVerifier, type AppleIdentityVerifier } from "./identity-verifier";
import { createAppleTokenClient, type AppleTokenClient } from "./token-client";

export interface AppleClients {
  appleIdentityVerifier: AppleIdentityVerifier;
  appleTokenClient: AppleTokenClient;
}

function notConfiguredClients(): AppleClients {
  return {
    appleIdentityVerifier: {
      async verify() {
        throw new AppError("APPLE_TOKEN_INVALID", "Connexion Apple non configurée dans cet environnement");
      },
    },
    appleTokenClient: {
      async exchangeCode() {
        return null;
      },
      async revoke() {
        // Rien à révoquer si Apple n'est pas configuré.
      },
    },
  };
}

export function createAppleClients(env: Env): AppleClients {
  if (!env.appleBundleId || !env.appleTeamId || !env.appleSignInKeyId || !env.appleSignInPrivateKey) {
    return notConfiguredClients();
  }
  return {
    appleIdentityVerifier: createAppleIdentityVerifier({ bundleId: env.appleBundleId }),
    appleTokenClient: createAppleTokenClient({
      bundleId: env.appleBundleId,
      teamId: env.appleTeamId,
      keyId: env.appleSignInKeyId,
      privateKeyPem: env.appleSignInPrivateKey,
    }),
  };
}
