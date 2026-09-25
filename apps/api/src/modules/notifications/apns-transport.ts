// ApnsTransport (ADR 004, B12) : envoi réel des notifications push. Jeton fournisseur JWT ES256
// (`jose`), régénéré avant expiration ; hôte sandbox/production selon l'appareil ; suppression du
// jeton en base sur 410 Gone / 400 BadDeviceToken (appareil désinstallé ou jeton périmé).
import { ENCOURAGEMENT_CATALOG } from "@app/contracts";
import type { Db } from "@app/db";
import { schema } from "@app/db";
import { eq } from "drizzle-orm";
import { SignJWT, importPKCS8 } from "jose";
import type { ApnsHttp2Client } from "./apns-http2-client";
import type { OutboundNotification, PushDevice, PushTransport } from "./transport";

const PRODUCTION_ORIGIN = "https://api.push.apple.com";
const SANDBOX_ORIGIN = "https://api.sandbox.push.apple.com";
/** Apple autorise jusqu'à 1 h de validité ; on régénère un peu avant pour rester large. */
const PROVIDER_TOKEN_TTL_MS = 50 * 60_000;

export interface ApnsTransportOptions {
  db: Db;
  http2Client: ApnsHttp2Client;
  teamId: string;
  keyId: string;
  /** Clé privée PKCS8 PEM (`.p8`) de la clé APNs (distincte de la clé Sign in with Apple). */
  privateKeyPem: string;
  /** `apns-topic` : identifiant de bundle iOS. */
  bundleId: string;
  /** Horloge injectable (tests). */
  now?: () => Date;
}

function alertTextFor(notification: OutboundNotification): string {
  const payload = notification.payload;
  switch (payload.type) {
    case "milestone_self":
      return `Bravo, tu as atteint ${payload.milestone.toLocaleString("fr-FR")} pas aujourd'hui !`;
    case "milestone_friend":
      return `${payload.fromUsername} a atteint ${payload.milestone.toLocaleString("fr-FR")} pas !`;
    case "encouragement_received": {
      const message = ENCOURAGEMENT_CATALOG.find((m) => m.id === payload.messageId);
      return `${payload.fromUsername} t'encourage : ${message?.text ?? "continue comme ça !"}`;
    }
    case "friend_request_received":
      return `${payload.fromUsername} veut devenir ton ami sur Footer`;
    case "friend_request_accepted":
      return `${payload.fromUsername} a accepté ta demande d'amitié`;
  }
}

/** `true` si le jeton doit être considéré invalide et supprimé (ADR 004). */
function isInvalidDeviceToken(res: { status: number; body: string }): boolean {
  if (res.status === 410) return true; // Unregistered.
  if (res.status === 400) {
    try {
      return (JSON.parse(res.body) as { reason?: string }).reason === "BadDeviceToken";
    } catch {
      return false;
    }
  }
  return false;
}

export function createApnsTransport(options: ApnsTransportOptions): PushTransport {
  const now = options.now ?? (() => new Date());
  const keyPromise = importPKCS8(options.privateKeyPem, "ES256");
  let cachedToken: { value: string; issuedAt: number } | undefined;

  async function providerToken(): Promise<string> {
    if (cachedToken && now().getTime() - cachedToken.issuedAt < PROVIDER_TOKEN_TTL_MS) {
      return cachedToken.value;
    }
    const value = await new SignJWT({})
      .setProtectedHeader({ alg: "ES256", kid: options.keyId })
      .setIssuer(options.teamId)
      .setIssuedAt()
      .sign(await keyPromise);
    cachedToken = { value, issuedAt: now().getTime() };
    return value;
  }

  return {
    async send(device: PushDevice, notification: OutboundNotification): Promise<void> {
      const origin = device.environment === "production" ? PRODUCTION_ORIGIN : SANDBOX_ORIGIN;
      const token = await providerToken();
      const body = JSON.stringify({
        aps: { alert: alertTextFor(notification), sound: "default" },
        footer: notification.payload,
      });

      const res = await options.http2Client.post(
        origin,
        `/3/device/${device.apnsToken}`,
        {
          authorization: `bearer ${token}`,
          "apns-topic": options.bundleId,
          "apns-push-type": "alert",
          "content-type": "application/json",
        },
        body,
      );

      if (isInvalidDeviceToken(res)) {
        await options.db.delete(schema.pushDevices).where(eq(schema.pushDevices.apnsToken, device.apnsToken));
      }
    },
  };
}
