// Composition du transport push à partir de l'environnement (ADR 004). `ApnsTransport` est posé
// en B12 ; en attendant, `PUSH_TRANSPORT=apns` échoue proprement à l'envoi plutôt qu'au démarrage
// (même logique que `modules/auth/apple/factory.ts` pour Apple non configuré).
import type { Env } from "../../env";
import { ConsoleTransport } from "./console-transport";
import type { PushTransport } from "./transport";

function notImplementedTransport(): PushTransport {
  return {
    async send() {
      throw new Error("ApnsTransport non implémenté (B12)");
    },
  };
}

export function createPushTransport(env: Env): PushTransport {
  if (env.pushTransport === "console") return new ConsoleTransport();
  return notImplementedTransport();
}
