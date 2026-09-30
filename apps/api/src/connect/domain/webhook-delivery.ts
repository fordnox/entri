import type {
  WebhookDeliveryStatus,
  WebhookEventType,
  WebhookPayload,
} from "@orbit/shared/connect";
import type { Clock } from "@/kernel/clock.ts";
import { type Id, newId } from "@/kernel/id.ts";
import type { ConnectApplicationId } from "./application.ts";
import type { DomainConnectionId } from "./domain-connection.ts";

export type WebhookDeliveryId = Id<"webhookDelivery">;

/** Delay before attempt n+1, indexed by attempts already made. */
export const WEBHOOK_RETRY_DELAYS_MS = [0, 10_000, 60_000, 5 * 60_000, 30 * 60_000] as const;
export const WEBHOOK_MAX_ATTEMPTS = WEBHOOK_RETRY_DELAYS_MS.length;

export interface WebhookDeliveryProps {
  id: WebhookDeliveryId;
  applicationId: ConnectApplicationId;
  /** No FK: a `domain.disconnected` delivery outlives its connection. */
  connectionId: DomainConnectionId | null;
  eventType: WebhookEventType;
  url: string;
  payload: WebhookPayload;
  status: WebhookDeliveryStatus;
  attempts: number;
  lastStatusCode: number | null;
  lastError: string | null;
  nextAttemptAt: Date | null;
  createdAt: Date;
  deliveredAt: Date | null;
}

/**
 * One event bound for one application's webhook URL, plus its attempt
 * history. The payload is frozen at creation so retries resend the same
 * bytes (and the same `id`, which receivers use for idempotency).
 */
export class WebhookDelivery {
  private constructor(private p: WebhookDeliveryProps) {}

  static create(
    input: {
      applicationId: ConnectApplicationId;
      connectionId: DomainConnectionId | null;
      eventType: WebhookEventType;
      url: string;
      buildPayload: (id: WebhookDeliveryId, createdAt: Date) => WebhookPayload;
    },
    clock: Clock,
  ): WebhookDelivery {
    const id = newId("webhookDelivery");
    const now = clock.now();
    return new WebhookDelivery({
      id,
      applicationId: input.applicationId,
      connectionId: input.connectionId,
      eventType: input.eventType,
      url: input.url,
      payload: input.buildPayload(id, now),
      status: "pending",
      attempts: 0,
      lastStatusCode: null,
      lastError: null,
      nextAttemptAt: now,
      createdAt: now,
      deliveredAt: null,
    });
  }

  static rehydrate(p: WebhookDeliveryProps): WebhookDelivery {
    return new WebhookDelivery({ ...p });
  }

  get id(): WebhookDeliveryId {
    return this.p.id;
  }
  get applicationId(): ConnectApplicationId {
    return this.p.applicationId;
  }
  get url(): string {
    return this.p.url;
  }
  get payload(): WebhookPayload {
    return this.p.payload;
  }
  get status(): WebhookDeliveryStatus {
    return this.p.status;
  }
  get attempts(): number {
    return this.p.attempts;
  }
  get nextAttemptAt(): Date | null {
    return this.p.nextAttemptAt;
  }

  props(): WebhookDeliveryProps {
    return { ...this.p };
  }

  recordAttempt(
    result: { ok: true; statusCode: number } | { ok: false; statusCode: number | null; error: string },
    clock: Clock,
  ): void {
    const now = clock.now();
    this.p.attempts += 1;
    this.p.lastStatusCode = result.statusCode;
    if (result.ok) {
      this.p.status = "succeeded";
      this.p.lastError = null;
      this.p.deliveredAt = now;
      this.p.nextAttemptAt = null;
      return;
    }
    this.p.lastError = result.error.slice(0, 500);
    if (this.p.attempts >= WEBHOOK_MAX_ATTEMPTS) {
      this.p.status = "failed";
      this.p.nextAttemptAt = null;
    } else {
      this.p.nextAttemptAt = new Date(now.getTime() + WEBHOOK_RETRY_DELAYS_MS[this.p.attempts]!);
    }
  }
}
