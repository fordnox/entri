// +feature:billing
import { eq } from "drizzle-orm";
import { subscriptions } from "@/db/drizzle/schema.ts";
import type { Drizzle } from "@/infrastructure/drizzle.ts";
import type { WorkspaceId } from "@/workspaces/domain/workspace.ts";
import type { BillingCustomerId } from "../domain/billing-customer.ts";
import type { SubscriptionRepository } from "../domain/repositories.ts";
import { parseSubscriptionStatus } from "../domain/subscription-status.ts";
import { Subscription, type SubscriptionId } from "../domain/subscription.ts";

type Row = {
  id: string;
  workspaceId: string;
  billingCustomerId: string;
  provider: string;
  providerSubscriptionId: string;
  status: string;
  priceId: string;
  planKey: string | null;
  quantity: number;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  canceledAt: Date | null;
  trialEndsAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function toDomain(row: Row): Subscription {
  return Subscription.rehydrate({
    id: row.id as SubscriptionId,
    workspaceId: row.workspaceId as WorkspaceId,
    billingCustomerId: row.billingCustomerId as BillingCustomerId,
    provider: row.provider,
    providerSubscriptionId: row.providerSubscriptionId,
    status: parseSubscriptionStatus(row.status),
    priceId: row.priceId,
    planKey: row.planKey,
    quantity: row.quantity,
    currentPeriodStart: row.currentPeriodStart,
    currentPeriodEnd: row.currentPeriodEnd,
    cancelAtPeriodEnd: row.cancelAtPeriodEnd,
    canceledAt: row.canceledAt,
    trialEndsAt: row.trialEndsAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

export class DrizzleSubscriptionRepository implements SubscriptionRepository {
  constructor(private readonly db: Drizzle) {}

  async findById(id: SubscriptionId): Promise<Subscription | null> {
    const [row] = await this.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.id, id))
      .limit(1);
    return row ? toDomain(row) : null;
  }

  async findByWorkspaceId(
    workspaceId: WorkspaceId,
  ): Promise<Subscription | null> {
    const [row] = await this.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.workspaceId, workspaceId))
      .limit(1);
    return row ? toDomain(row) : null;
  }

  async findByProviderSubscriptionId(
    _provider: string,
    providerSubscriptionId: string,
  ): Promise<Subscription | null> {
    const [row] = await this.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.providerSubscriptionId, providerSubscriptionId))
      .limit(1);
    return row ? toDomain(row) : null;
  }

  async save(subscription: Subscription): Promise<void> {
    await this.db
      .insert(subscriptions)
      .values({
        id: subscription.id,
        workspaceId: subscription.workspaceId,
        billingCustomerId: subscription.billingCustomerId,
        provider: subscription.provider,
        providerSubscriptionId: subscription.providerSubscriptionId,
        status: subscription.status,
        priceId: subscription.priceId,
        planKey: subscription.planKey,
        quantity: subscription.quantity,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        canceledAt: subscription.canceledAt,
        trialEndsAt: subscription.trialEndsAt,
        createdAt: subscription.updatedAt,
        updatedAt: subscription.updatedAt,
      })
      .onConflictDoUpdate({
        target: subscriptions.id,
        set: {
          status: subscription.status,
          priceId: subscription.priceId,
          planKey: subscription.planKey,
          quantity: subscription.quantity,
          currentPeriodStart: subscription.currentPeriodStart,
          currentPeriodEnd: subscription.currentPeriodEnd,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          canceledAt: subscription.canceledAt,
          trialEndsAt: subscription.trialEndsAt,
          updatedAt: subscription.updatedAt,
        },
      });
  }

  async delete(id: SubscriptionId): Promise<void> {
    await this.db.delete(subscriptions).where(eq(subscriptions.id, id));
  }
}
// -feature:billing
