import type { ProviderSubscription } from "./billing-provider.ts";

/**
 * Normalized webhook event after the provider-specific receiver has
 * verified the signature, parsed the payload, and mapped it into the
 * two lifecycle events we care about. Unknown event types surface as
 * `type: "other"` so we can still record them in the ledger for
 * debugging without an opinion on their semantics.
 */
export type NormalizedBillingEvent =
  | {
      type: "subscription.synced";
      providerEventId: string;
      providerCustomerId: string;
      subscription: ProviderSubscription;
    }
  | {
      type: "subscription.deleted";
      providerEventId: string;
      providerCustomerId: string;
      providerSubscriptionId: string;
    }
  | {
      type: "other";
      providerEventId: string;
      rawType: string;
    };

/**
 * Port: provider-specific verification + parsing logic. Implementations
 * must VERIFY the signature before returning anything — the application
 * service trusts that a returned event is authentic.
 */
export interface BillingWebhookReceiver {
  readonly provider: string;

  /**
   * Verify + parse a raw webhook request. The body is passed as the
   * exact bytes the HTTP layer received (no re-serialization!) because
   * most providers sign the raw bytes.
   *
   * `headers` carries all inbound request headers (lowercased keys)
   * so adapters can pick their own signature header — e.g. Stripe reads
   * `stripe-signature`, Polar/Dodo read the Standard Webhooks trio of
   * `webhook-id`, `webhook-timestamp`, `webhook-signature`.
   */
  verifyAndParse(input: {
    rawBody: string;
    headers: Record<string, string>;
  }): Promise<NormalizedBillingEvent>;
}

export class InvalidWebhookSignatureError extends Error {
  readonly code = "billing.webhook.invalid_signature";
  constructor(message = "invalid webhook signature") {
    super(message);
    this.name = "InvalidWebhookSignatureError";
  }
}
