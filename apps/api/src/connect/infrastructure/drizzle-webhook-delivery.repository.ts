import { and, asc, desc, eq, lte } from "drizzle-orm";
import type {
  WebhookDeliveryStatus,
  WebhookEventType,
  WebhookPayload,
} from "@orbit/shared/connect";
import { webhookDeliveries } from "@/db/drizzle/schema.ts";
import type { Drizzle } from "@/infrastructure/drizzle.ts";
import type { ConnectApplicationId } from "../domain/application.ts";
import type { DomainConnectionId } from "../domain/domain-connection.ts";
import type { WebhookDeliveryRepository } from "../domain/repositories.ts";
import { WebhookDelivery, type WebhookDeliveryId } from "../domain/webhook-delivery.ts";

type Row = typeof webhookDeliveries.$inferSelect;

function toDomain(row: Row): WebhookDelivery {
  return WebhookDelivery.rehydrate({
    id: row.id as WebhookDeliveryId,
    applicationId: row.applicationId as ConnectApplicationId,
    connectionId: row.connectionId as DomainConnectionId | null,
    eventType: row.eventType as WebhookEventType,
    url: row.url,
    payload: row.payload as WebhookPayload,
    status: row.status as WebhookDeliveryStatus,
    attempts: row.attempts,
    lastStatusCode: row.lastStatusCode,
    lastError: row.lastError,
    nextAttemptAt: row.nextAttemptAt,
    createdAt: row.createdAt,
    deliveredAt: row.deliveredAt,
  });
}

export class DrizzleWebhookDeliveryRepository implements WebhookDeliveryRepository {
  constructor(private readonly db: Drizzle) {}

  async findById(id: WebhookDeliveryId): Promise<WebhookDelivery | null> {
    const rows = await this.db
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.id, id))
      .limit(1);
    return rows[0] ? toDomain(rows[0]) : null;
  }

  async listForApplication(id: ConnectApplicationId, limit: number): Promise<WebhookDelivery[]> {
    const rows = await this.db
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.applicationId, id))
      .orderBy(desc(webhookDeliveries.createdAt))
      .limit(limit);
    return rows.map(toDomain);
  }

  async listDue(before: Date, limit: number): Promise<WebhookDelivery[]> {
    const rows = await this.db
      .select()
      .from(webhookDeliveries)
      .where(
        and(eq(webhookDeliveries.status, "pending"), lte(webhookDeliveries.nextAttemptAt, before)),
      )
      .orderBy(asc(webhookDeliveries.nextAttemptAt))
      .limit(limit);
    return rows.map(toDomain);
  }

  async save(delivery: WebhookDelivery): Promise<void> {
    const p = delivery.props();
    const mutable = {
      status: p.status,
      attempts: p.attempts,
      lastStatusCode: p.lastStatusCode,
      lastError: p.lastError,
      nextAttemptAt: p.nextAttemptAt,
      deliveredAt: p.deliveredAt,
    };
    await this.db
      .insert(webhookDeliveries)
      .values({
        id: p.id,
        applicationId: p.applicationId,
        connectionId: p.connectionId,
        eventType: p.eventType,
        url: p.url,
        payload: p.payload,
        createdAt: p.createdAt,
        ...mutable,
      })
      .onConflictDoUpdate({ target: webhookDeliveries.id, set: mutable });
  }
}
