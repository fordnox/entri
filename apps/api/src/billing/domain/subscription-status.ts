import { ValidationError } from "@/kernel/errors.ts";

/**
 * Stripe-compatible superset of statuses. Adapters for other providers
 * normalize their own vocabulary into this set.
 */
export const SUBSCRIPTION_STATUSES = [
  "trialing",
  "active",
  "past_due",
  "canceled",
  "unpaid",
  "incomplete",
  "incomplete_expired",
  "paused",
] as const;

export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export function isSubscriptionStatus(value: string): value is SubscriptionStatus {
  return (SUBSCRIPTION_STATUSES as readonly string[]).includes(value);
}

export function parseSubscriptionStatus(value: string): SubscriptionStatus {
  if (!isSubscriptionStatus(value)) {
    throw new ValidationError(
      "subscription.invalid_status",
      `unknown subscription status: ${value}`,
    );
  }
  return value;
}

/** Access-gating helper — is the subscription considered "good"? */
export function isEntitledStatus(status: SubscriptionStatus): boolean {
  return status === "active" || status === "trialing";
}
