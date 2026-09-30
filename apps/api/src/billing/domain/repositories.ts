import type { WorkspaceId } from "@/workspaces/domain/workspace.ts";
import type { BillingCustomer, BillingCustomerId } from "./billing-customer.ts";
import type { BillingEventRow } from "./billing-event.ts";
import type { Subscription, SubscriptionId } from "./subscription.ts";

export interface BillingCustomerRepository {
  findByWorkspaceId(workspaceId: WorkspaceId): Promise<BillingCustomer | null>;
  findByProviderCustomerId(
    provider: string,
    providerCustomerId: string,
  ): Promise<BillingCustomer | null>;
  findById(id: BillingCustomerId): Promise<BillingCustomer | null>;
  save(customer: BillingCustomer): Promise<void>;
}

export interface SubscriptionRepository {
  findById(id: SubscriptionId): Promise<Subscription | null>;
  findByWorkspaceId(workspaceId: WorkspaceId): Promise<Subscription | null>;
  findByProviderSubscriptionId(
    provider: string,
    providerSubscriptionId: string,
  ): Promise<Subscription | null>;
  save(subscription: Subscription): Promise<void>;
  delete(id: SubscriptionId): Promise<void>;
}

export interface BillingEventRepository {
  findByProviderEventId(
    provider: string,
    providerEventId: string,
  ): Promise<BillingEventRow | null>;
  /** Record a webhook event. Returns `false` if the event was already recorded (duplicate). */
  record(event: BillingEventRow): Promise<boolean>;
}
