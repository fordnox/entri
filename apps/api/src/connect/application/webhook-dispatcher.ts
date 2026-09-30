import { createHmac } from "node:crypto";
import { log } from "evlog";
import type { WebhookEventType } from "@orbit/shared/connect";
import type { Clock } from "@/kernel/clock.ts";
import type { DomainEvent, EventBus } from "@/kernel/events.ts";
import type { UnitOfWork } from "@/kernel/uow.ts";
import type { ConnectApplication } from "../domain/application.ts";
import type { ProviderCatalog } from "../domain/dns-provider.ts";
import {
  DomainConnected,
  DomainDisconnected,
  DomainSetupFailed,
  type DomainConnectionSnapshot,
} from "../domain/domain-connection.ts";
import { WebhookDelivery } from "../domain/webhook-delivery.ts";
import { connectionToDTO } from "./dto.ts";
import type { WebhookSender } from "./ports.ts";

const SWEEP_INTERVAL_MS = 15_000;
const SWEEP_BATCH = 25;

export const SIGNATURE_HEADER = "Connect-Signature";

/** `t=<unix seconds>,v1=<hex HMAC-SHA256(secret, "<t>.<body>")>` */
export function signWebhook(secret: string, body: string, at: Date): string {
  const t = Math.floor(at.getTime() / 1000);
  const v1 = createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
  return `t=${t},v1=${v1}`;
}

const EVENT_TYPES: Record<string, WebhookEventType> = {
  "connect.domain.connected": "domain.connected",
  "connect.domain.setup_failed": "domain.setup_failed",
  "connect.domain.disconnected": "domain.disconnected",
};

/**
 * Post-commit projector turning connection events into signed webhook
 * deliveries. Delivery rows are written first, then attempted
 * out-of-band so a slow receiver never holds up the request that
 * triggered it. A periodic sweep retries due deliveries (backoff in
 * `WEBHOOK_RETRY_DELAYS_MS`) and picks up anything left pending by a
 * restart.
 *
 * With several API processes a delivery can occasionally be attempted
 * twice; receivers should dedupe on the payload `id` (documented).
 */
export class ConnectWebhookDispatcher {
  private readonly inFlight = new Set<string>();
  private sweepTimer: ReturnType<typeof setInterval> | null = null;
  private unsubscribe: (() => void) | null = null;

  constructor(
    private readonly bus: EventBus,
    private readonly uow: UnitOfWork,
    private readonly clock: Clock,
    private readonly sender: WebhookSender,
    private readonly catalog: ProviderCatalog,
  ) {}

  start(): void {
    this.unsubscribe = this.bus.subscribeAll(async (event) => {
      const type = EVENT_TYPES[event.type];
      if (!type) return;
      try {
        const delivery = await this.enqueueForEvent(event, type);
        if (delivery) void this.attempt(delivery.id);
      } catch (err) {
        log.error({
          action: "connect.webhook.enqueue_failed",
          event: event.type,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    });
    this.sweepTimer = setInterval(() => void this.sweep(), SWEEP_INTERVAL_MS);
    this.sweepTimer.unref?.();
  }

  stop(): void {
    this.unsubscribe?.();
    if (this.sweepTimer) clearInterval(this.sweepTimer);
  }

  /** Dashboard "Send test webhook": enqueued and attempted synchronously. */
  async sendTest(app: ConnectApplication): Promise<WebhookDelivery> {
    const delivery = await this.uow.run(async (tx) => {
      const d = WebhookDelivery.create(
        {
          applicationId: app.id,
          connectionId: null,
          eventType: "webhook.test",
          url: app.webhookUrl ?? "",
          buildPayload: (id, at) => ({
            id,
            type: "webhook.test",
            createdAt: at.toISOString(),
            data: { connection: null },
          }),
        },
        this.clock,
      );
      await tx.webhookDeliveries.save(d);
      return d;
    });
    return (await this.attempt(delivery.id)) ?? delivery;
  }

  private async enqueueForEvent(
    event: DomainEvent,
    type: WebhookEventType,
  ): Promise<WebhookDelivery | null> {
    const e = event as DomainConnected | DomainSetupFailed | DomainDisconnected;
    return this.uow.run(async (tx) => {
      const app = await tx.connectApplications.findById(e.applicationId);
      if (!app?.webhookUrl) return null;
      let snapshot: DomainConnectionSnapshot | null;
      if (e instanceof DomainDisconnected) {
        snapshot = e.snapshot;
      } else {
        snapshot = (await tx.domainConnections.findById(e.connectionId))?.snapshot() ?? null;
      }
      if (!snapshot) return null;
      const connection = connectionToDTO(snapshot, this.catalog);
      const d = WebhookDelivery.create(
        {
          applicationId: app.id,
          connectionId: e.connectionId,
          eventType: type,
          url: app.webhookUrl,
          buildPayload: (id, at) => ({
            id,
            type,
            createdAt: at.toISOString(),
            data: { connection },
          }),
        },
        this.clock,
      );
      await tx.webhookDeliveries.save(d);
      return d;
    });
  }

  private async sweep(): Promise<void> {
    try {
      const due = await this.uow.read((tx) =>
        tx.webhookDeliveries.listDue(this.clock.now(), SWEEP_BATCH),
      );
      for (const d of due) await this.attempt(d.id);
    } catch (err) {
      log.error({
        action: "connect.webhook.sweep_failed",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private async attempt(id: WebhookDelivery["id"]): Promise<WebhookDelivery | null> {
    if (this.inFlight.has(id)) return null;
    this.inFlight.add(id);
    try {
      const loaded = await this.uow.read(async (tx) => {
        const delivery = await tx.webhookDeliveries.findById(id);
        const app = delivery ? await tx.connectApplications.findById(delivery.applicationId) : null;
        return { delivery, app };
      });
      const { delivery, app } = loaded;
      if (!delivery || delivery.status !== "pending") return delivery;

      let result;
      if (!app || !delivery.url) {
        result = { ok: false as const, statusCode: null, error: "no webhook URL configured" };
      } else {
        const body = JSON.stringify(delivery.payload);
        const sent = await this.sender.send(delivery.url, body, {
          "content-type": "application/json",
          "user-agent": "Connect-Webhooks/1.0",
          [SIGNATURE_HEADER]: signWebhook(app.webhookSecret, body, this.clock.now()),
          "Connect-Event": delivery.payload.type,
          "Connect-Delivery": delivery.id,
        });
        result = sent.ok
          ? { ok: true as const, statusCode: sent.statusCode ?? 200 }
          : { ok: false as const, statusCode: sent.statusCode, error: sent.error ?? "delivery failed" };
      }
      delivery.recordAttempt(result, this.clock);
      await this.uow.run((tx) => tx.webhookDeliveries.save(delivery));
      return delivery;
    } catch (err) {
      log.error({
        action: "connect.webhook.attempt_failed",
        deliveryId: id,
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    } finally {
      this.inFlight.delete(id);
    }
  }
}
