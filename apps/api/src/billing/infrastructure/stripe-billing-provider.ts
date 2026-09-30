import Stripe from "stripe";
import type {
  BillingProvider,
  ProviderCustomer,
  ProviderSubscription,
} from "../application/billing-provider.ts";
import type { BillingPlan } from "../domain/billing-plan.ts";
import {
  parseSubscriptionStatus,
  type SubscriptionStatus,
} from "../domain/subscription-status.ts";

export interface StripeBillingConfig {
  apiKey: string;
  /** Optional pinned API version. Leave undefined to pick Stripe's default. */
  apiVersion?: ConstructorParameters<typeof Stripe>[1] extends infer C
    ? C extends { apiVersion?: infer V }
      ? V
      : never
    : never;
}

/**
 * Stripe adapter for the `BillingProvider` port. Every outbound call
 * goes through the Stripe SDK; webhook verification lives in the
 * separate `StripeWebhookReceiver`.
 */
export class StripeBillingProvider implements BillingProvider {
  readonly key = "stripe";
  private readonly client: Stripe;

  constructor(
    config: StripeBillingConfig,
    private readonly catalog: () => readonly BillingPlan[],
  ) {
    this.client = new Stripe(config.apiKey, {
      apiVersion: config.apiVersion,
    });
  }

  listPlans(): readonly BillingPlan[] {
    return this.catalog();
  }

  async findCustomer(id: string): Promise<ProviderCustomer | null> {
    try {
      const customer = await this.client.customers.retrieve(id);
      if (customer.deleted) return null;
      return {
        id: customer.id,
        email: customer.email ?? null,
        metadata: customer.metadata ?? {},
      };
    } catch (err) {
      if (err instanceof Stripe.errors.StripeError && err.code === "resource_missing") {
        return null;
      }
      throw err;
    }
  }

  async createCustomer(input: {
    workspaceId: string;
    email: string | null;
    name: string | null;
    metadata?: Record<string, string>;
  }): Promise<ProviderCustomer> {
    const customer = await this.client.customers.create({
      email: input.email ?? undefined,
      name: input.name ?? undefined,
      metadata: {
        workspaceId: input.workspaceId,
        ...input.metadata,
      },
    });
    return {
      id: customer.id,
      email: customer.email ?? null,
      metadata: customer.metadata ?? {},
    };
  }

  async startCheckout(input: {
    workspaceId: string;
    providerCustomerId: string;
    priceId: string;
    quantity?: number;
    successUrl: string;
    cancelUrl: string;
  }): Promise<{ redirectUrl: string; sessionId: string }> {
    const session = await this.client.checkout.sessions.create({
      mode: "subscription",
      customer: input.providerCustomerId,
      line_items: [
        {
          price: input.priceId,
          quantity: input.quantity ?? 1,
        },
      ],
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      metadata: { workspaceId: input.workspaceId },
      subscription_data: {
        metadata: { workspaceId: input.workspaceId },
      },
      allow_promotion_codes: true,
    });
    if (!session.url) {
      throw new Error("stripe checkout session returned no url");
    }
    return { redirectUrl: session.url, sessionId: session.id };
  }

  async openPortal(input: {
    providerCustomerId: string;
    returnUrl: string;
  }): Promise<{ redirectUrl: string }> {
    const session = await this.client.billingPortal.sessions.create({
      customer: input.providerCustomerId,
      return_url: input.returnUrl,
    });
    return { redirectUrl: session.url };
  }

  async cancelSubscription(input: {
    providerSubscriptionId: string;
    atPeriodEnd: boolean;
  }): Promise<void> {
    if (input.atPeriodEnd) {
      await this.client.subscriptions.update(input.providerSubscriptionId, {
        cancel_at_period_end: true,
      });
    } else {
      await this.client.subscriptions.cancel(input.providerSubscriptionId);
    }
  }

  async fetchSubscription(
    providerSubscriptionId: string,
  ): Promise<ProviderSubscription | null> {
    try {
      const sub = await this.client.subscriptions.retrieve(providerSubscriptionId);
      return toProviderSubscription(sub);
    } catch (err) {
      if (err instanceof Stripe.errors.StripeError && err.code === "resource_missing") {
        return null;
      }
      throw err;
    }
  }
}

/**
 * Helper shared with the webhook receiver. Maps a Stripe
 * `Subscription` into our provider-agnostic shape so the domain layer
 * doesn't import from the Stripe SDK.
 */
export function toProviderSubscription(sub: Stripe.Subscription): ProviderSubscription {
  const item = sub.items.data[0];
  const price = item?.price;
  const priceId = price?.id ?? "";
  const quantity = item?.quantity ?? 1;
  const status: SubscriptionStatus = parseSubscriptionStatus(sub.status);
  // Stripe 2025-xx API moved `current_period_start/end` off the top-level
  // Subscription onto each item; we use the first item as canonical.
  const currentPeriodStart = new Date((item?.current_period_start ?? 0) * 1000);
  const currentPeriodEnd = new Date((item?.current_period_end ?? 0) * 1000);
  const canceledAt = sub.canceled_at ? new Date(sub.canceled_at * 1000) : null;
  const trialEndsAt = sub.trial_end ? new Date(sub.trial_end * 1000) : null;
  return {
    id: sub.id,
    customerId: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    sync: {
      status,
      priceId,
      // `planKey` is resolved against our server-side catalog later;
      // Stripe's metadata is a fine escape hatch for tenants that set
      // it explicitly on the price.
      planKey:
        (price?.metadata && typeof price.metadata.planKey === "string"
          ? price.metadata.planKey
          : null) ?? null,
      quantity,
      currentPeriodStart,
      currentPeriodEnd,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      canceledAt,
      trialEndsAt,
    },
  };
}
