import Stripe from "stripe";
import {
  InvalidWebhookSignatureError,
  type BillingWebhookReceiver,
  type NormalizedBillingEvent,
} from "../application/billing-webhook-receiver.ts";
import { toProviderSubscription } from "./stripe-billing-provider.ts";

export interface StripeWebhookConfig {
  apiKey: string;
  webhookSecret: string;
}

/**
 * Stripe webhook verifier + normalizer. Only the two subscription
 * lifecycle events we care about are mapped into domain types; all
 * other event types are returned as `"other"` so the application
 * service can still record them in the ledger without side effects.
 */
export class StripeWebhookReceiver implements BillingWebhookReceiver {
  readonly provider = "stripe";
  private readonly client: Stripe;

  constructor(private readonly config: StripeWebhookConfig) {
    this.client = new Stripe(config.apiKey);
  }

  async verifyAndParse(input: {
    rawBody: string;
    headers: Record<string, string>;
  }): Promise<NormalizedBillingEvent> {
    const signature = input.headers["stripe-signature"] ?? "";
    let event: Stripe.Event;
    try {
      event = this.client.webhooks.constructEvent(
        input.rawBody,
        signature,
        this.config.webhookSecret,
      );
    } catch (err) {
      throw new InvalidWebhookSignatureError(
        err instanceof Error ? err.message : undefined,
      );
    }

    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.resumed":
      case "customer.subscription.paused":
      case "customer.subscription.pending_update_applied":
      case "customer.subscription.pending_update_expired": {
        const sub = event.data.object as Stripe.Subscription;
        return {
          type: "subscription.synced",
          providerEventId: event.id,
          providerCustomerId:
            typeof sub.customer === "string" ? sub.customer : sub.customer.id,
          subscription: toProviderSubscription(sub),
        };
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        return {
          type: "subscription.deleted",
          providerEventId: event.id,
          providerCustomerId:
            typeof sub.customer === "string" ? sub.customer : sub.customer.id,
          providerSubscriptionId: sub.id,
        };
      }
      default:
        return {
          type: "other",
          providerEventId: event.id,
          rawType: event.type,
        };
    }
  }
}
