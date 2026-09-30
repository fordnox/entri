import type { WorkspaceId } from "@/workspaces/domain/workspace.ts";
import type { BillingPlan } from "../domain/billing-plan.ts";
import type { SubscriptionSyncInput } from "../domain/subscription.ts";

/**
 * Port describing the outbound capabilities we need from a billing
 * provider. Implementations live in `infrastructure/` — today that's
 * Stripe. `NoopBillingProvider` fills in when no provider is wired so
 * the kit still boots and `GET /billing` reports `enabled: false`.
 *
 * Read-through, not stateful: the provider is expected to be the
 * source of truth for prices, checkouts, and customer portals. The
 * webhook path is what turns provider state into our
 * `Subscription` aggregate.
 */
export interface BillingProvider {
  /** Stable id used in the DB `provider` column (e.g. "stripe"). */
  readonly key: string;

  /** Return the catalog the UI should render as purchasable plans. */
  listPlans(): readonly BillingPlan[];

  /** Find an existing customer by provider id. Returns null if missing. */
  findCustomer(providerCustomerId: string): Promise<ProviderCustomer | null>;

  /** Create a new provider-side customer for a workspace. */
  createCustomer(input: {
    workspaceId: WorkspaceId;
    email: string | null;
    name: string | null;
    metadata?: Record<string, string>;
  }): Promise<ProviderCustomer>;

  /**
   * Start a hosted checkout session for the given price. Returns a
   * `redirectUrl` the client should navigate the browser to. The
   * provider converts the checkout into a Subscription asynchronously
   * — our DB state is catch-up from the webhook.
   */
  startCheckout(input: {
    workspaceId: WorkspaceId;
    providerCustomerId: string;
    priceId: string;
    /** Optional override; provider may reject unknown values. */
    quantity?: number;
    successUrl: string;
    cancelUrl: string;
  }): Promise<{ redirectUrl: string; sessionId: string }>;

  openPortal(input: {
    providerCustomerId: string;
    returnUrl: string;
  }): Promise<{ redirectUrl: string }>;

  /** Cancel a subscription (immediately or at period end). */
  cancelSubscription(input: {
    providerSubscriptionId: string;
    atPeriodEnd: boolean;
  }): Promise<void>;

  /**
   * Fetch the current provider-side state of a subscription. Used to
   * reconcile after a webhook we couldn't map (e.g. an unknown
   * subscription id) — we fetch, map, upsert.
   */
  fetchSubscription(
    providerSubscriptionId: string,
  ): Promise<ProviderSubscription | null>;
}

export interface ProviderCustomer {
  id: string;
  email: string | null;
  metadata: Record<string, string>;
}

export interface ProviderSubscription {
  id: string;
  customerId: string;
  sync: SubscriptionSyncInput;
}
