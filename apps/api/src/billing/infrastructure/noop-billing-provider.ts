import { ConflictError } from "@/kernel/errors.ts";
import type {
  BillingProvider,
  ProviderCustomer,
  ProviderSubscription,
} from "../application/billing-provider.ts";

/**
 * Fallback provider wired when no real billing adapter is configured.
 * Lets the kit boot without Stripe credentials. All calls return a
 * deterministic 409 so controllers can short-circuit with a helpful
 * error without each of them needing to re-check `config.billing.enabled`.
 */
export class NoopBillingProvider implements BillingProvider {
  readonly key = "noop";

  listPlans(): readonly [] {
    return [];
  }

  private fail(): never {
    throw new ConflictError(
      "billing.provider_not_configured",
      "billing is not configured on this server",
    );
  }

  async findCustomer(): Promise<ProviderCustomer | null> {
    this.fail();
  }
  async createCustomer(): Promise<ProviderCustomer> {
    this.fail();
  }
  async startCheckout(): Promise<{ redirectUrl: string; sessionId: string }> {
    this.fail();
  }
  async openPortal(): Promise<{ redirectUrl: string }> {
    this.fail();
  }
  async cancelSubscription(): Promise<void> {
    this.fail();
  }
  async fetchSubscription(): Promise<ProviderSubscription | null> {
    this.fail();
  }
}
