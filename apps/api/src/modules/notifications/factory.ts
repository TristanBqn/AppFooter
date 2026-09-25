// Composition du transport push à partir de l'environnement (ADR 004, B12). Sans configuration
// APNs complète malgré `PUSH_TRANSPORT=apns` (ne devrait pas arriver : `env.ts` l'exige en
// production), une implémentation neutre évite un crash au démarrage plutôt que d'envoyer
// silencieusement (même logique que `modules/auth/apple/factory.ts`).
import type { Db } from "@app/db";
import type { Env } from "../../env";
import { createNodeHttp2Client } from "./apns-http2-client";
import { createApnsTransport } from "./apns-transport";
import { ConsoleTransport } from "./console-transport";
import type { PushTransport } from "./transport";

function notConfiguredTransport(): PushTransport {
  return {
    async send() {
      throw new Error("APNs non configuré dans cet environnement (PUSH_TRANSPORT=apns sans clé complète)");
    },
  };
}

export function createPushTransport(env: Env, db: Db): PushTransport {
  if (env.pushTransport === "console") return new ConsoleTransport();
  if (!env.apnsKeyId || !env.apnsPrivateKey || !env.appleTeamId || !env.appleBundleId) {
    return notConfiguredTransport();
  }
  return createApnsTransport({
    db,
    http2Client: createNodeHttp2Client(),
    teamId: env.appleTeamId,
    keyId: env.apnsKeyId,
    privateKeyPem: env.apnsPrivateKey,
    bundleId: env.appleBundleId,
  });
}
