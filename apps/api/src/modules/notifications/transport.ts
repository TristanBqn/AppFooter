// Interface `PushTransport` (ADR 004) : `ConsoleTransport` (dev/test, ce fichier) ;
// `ApnsTransport` en production (B12).
import type { NotificationType, PushPayload } from "@app/contracts";

export interface PushDevice {
  apnsToken: string;
  environment: "sandbox" | "production";
}

export interface OutboundNotification {
  recipientId: string;
  type: NotificationType;
  payload: PushPayload;
}

export interface PushTransport {
  send(device: PushDevice, notification: OutboundNotification): Promise<void>;
}
