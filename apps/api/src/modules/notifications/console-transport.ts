// Transport de développement/test (ADR 004) : journalise et garde une boîte d'envoi en mémoire
// inspectable par les tests, à la place d'un vrai envoi APNs.
import type { OutboundNotification, PushDevice, PushTransport } from "./transport";

export interface SentNotification {
  device: PushDevice;
  notification: OutboundNotification;
}

export class ConsoleTransport implements PushTransport {
  readonly outbox: SentNotification[] = [];

  async send(device: PushDevice, notification: OutboundNotification): Promise<void> {
    this.outbox.push({ device, notification });
    console.log(
      JSON.stringify({
        level: "info",
        event: "push_sent",
        recipientId: notification.recipientId,
        type: notification.type,
        environment: device.environment,
      }),
    );
  }
}
