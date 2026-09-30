import type { DomainConnectionStatus } from "@orbit/shared/connect";
import type { WorkspaceId } from "@/workspaces/domain/workspace.ts";
import type { ConnectApplication, ConnectApplicationId } from "./application.ts";
import type { DomainConnection, DomainConnectionId } from "./domain-connection.ts";
import type { WebhookDelivery, WebhookDeliveryId } from "./webhook-delivery.ts";

export interface ApplicationWithDomainCount {
  application: ConnectApplication;
  domainCount: number;
}

export interface ConnectApplicationRepository {
  findById(id: ConnectApplicationId): Promise<ConnectApplication | null>;
  listForWorkspace(workspaceId: WorkspaceId): Promise<ApplicationWithDomainCount[]>;
  countDomains(id: ConnectApplicationId): Promise<number>;
  save(app: ConnectApplication): Promise<void>;
  delete(id: ConnectApplicationId): Promise<void>;
}

export interface DomainConnectionQuery {
  workspaceId: WorkspaceId;
  applicationId?: ConnectApplicationId;
  status?: DomainConnectionStatus;
  /** Case-insensitive substring match on domain or userId. */
  q?: string;
  cursor?: { createdAt: Date; id: DomainConnectionId };
  limit: number;
}

export interface DomainConnectionRepository {
  findById(id: DomainConnectionId): Promise<DomainConnection | null>;
  /** Newest first; returns up to `limit` rows. */
  list(query: DomainConnectionQuery): Promise<DomainConnection[]>;
  save(conn: DomainConnection): Promise<void>;
  delete(id: DomainConnectionId): Promise<void>;
}

export interface WebhookDeliveryRepository {
  findById(id: WebhookDeliveryId): Promise<WebhookDelivery | null>;
  listForApplication(id: ConnectApplicationId, limit: number): Promise<WebhookDelivery[]>;
  /** Pending deliveries whose next attempt is due at or before `before`. */
  listDue(before: Date, limit: number): Promise<WebhookDelivery[]>;
  save(delivery: WebhookDelivery): Promise<void>;
}
