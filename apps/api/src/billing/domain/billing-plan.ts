/**
 * A catalog entry describing a purchasable plan. The catalog is
 * configured in environment/config — the DB doesn't store the list
 * since pricing is owned by the billing provider. We keep a server-
 * side copy so the web client can render a plan picker without
 * round-tripping through the provider's public API.
 */
export interface BillingPlan {
  /** Stable, human-readable key (e.g. "pro"). Persisted on Subscription.planKey. */
  key: string;
  name: string;
  description: string | null;
  /** Provider price id (e.g. Stripe `price_123`). */
  priceId: string;
  unitAmount: number;
  currency: string;
  interval: "day" | "week" | "month" | "year";
  intervalCount: number;
  features: string[];
}
