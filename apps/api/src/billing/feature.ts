/**
 * Billing feature module.
 *
 * Billing is special: its services depend on a `BillingProvider` + a
 * `BillingCatalog` that are themselves built from config (plans, API
 * keys, webhook secret). We keep all of that construction local here
 * so composition.ts just spreads `billingFeature.services(core)` — it
 * never has to know about Stripe, Polar, or Dodo.
 *
 * Read paths (`getWorkspaceBilling`) always work, even when the kit
 * boots with `BILLING_PROVIDER=noop` (or unset). Write paths
 * (`startCheckout`, `openPortal`, `cancelSubscription`,
 * `handleBillingWebhook`) hydrate to `null` and controllers 409 out.
 *
 * Each provider adapter is a strippable sub-feature
 * (`billing-stripe` / `billing-polar` / `billing-dodo`). The CLI
 * translates the user's provider choice into the right sub-feature
 * toggles; this file only reads the resolved config.
 */
import type { FeatureCore, FeatureModule } from "@/kernel/feature.ts";
import type { BillingPlan } from "@/billing/domain/billing-plan.ts";
import type { BillingProvider } from "@/billing/application/billing-provider.ts";
import type { BillingWebhookReceiver } from "@/billing/application/billing-webhook-receiver.ts";
import { BillingCatalog } from "@/billing/application/billing-catalog.ts";
import { CancelSubscriptionService } from "@/billing/application/cancel-subscription.service.ts";
import { GetWorkspaceBillingService } from "@/billing/application/get-workspace-billing.service.ts";
import { HandleBillingWebhookService } from "@/billing/application/handle-billing-webhook.service.ts";
import { OpenPortalService } from "@/billing/application/open-portal.service.ts";
import { StartCheckoutService } from "@/billing/application/start-checkout.service.ts";
import { NoopBillingProvider } from "@/billing/infrastructure/noop-billing-provider.ts";
// +feature:billing-stripe
import { StripeBillingProvider } from "@/billing/infrastructure/stripe-billing-provider.ts";
import { StripeWebhookReceiver } from "@/billing/infrastructure/stripe-webhook-receiver.ts";
// -feature:billing-stripe

/**
 * Per-provider config shape. Each provider owns a small bundle of
 * secrets + its own plan catalog so we can honor the same
 * `BillingProvider` port no matter which adapter is wired.
 */
export interface StripeProviderConfig {
  apiKey: string;
  webhookSecret: string;
  plans: readonly BillingPlan[];
}

export interface PolarProviderConfig {
  accessToken: string;
  webhookSecret: string;
  /** `sandbox` (default) for dev, `production` for live keys. */
  server: "sandbox" | "production";
  plans: readonly BillingPlan[];
}

export interface DodoProviderConfig {
  apiKey: string;
  webhookKey: string;
  /** `test_mode` (default) for dev, `live_mode` for live keys. */
  environment: "test_mode" | "live_mode";
  plans: readonly BillingPlan[];
}

export type BillingProviderKey = "stripe" | "polar" | "dodo";

export interface BillingConfig {
  enabled: boolean;
  provider: BillingProviderKey | null;
  // +feature:billing-stripe
  stripe: StripeProviderConfig | null;
  // -feature:billing-stripe
}

export interface BillingServices {
  getWorkspaceBilling: GetWorkspaceBillingService;
  startCheckout: StartCheckoutService | null;
  openPortal: OpenPortalService | null;
  cancelSubscription: CancelSubscriptionService | null;
  /**
   * Webhook handler + the provider key it was built for. The HTTP
   * router validates the URL's `:provider` matches `handler.provider`
   * before dispatch so we can't accidentally verify a Stripe payload
   * with another adapter's receiver.
   */
  handleBillingWebhook: {
    provider: string;
    service: HandleBillingWebhookService;
  } | null;
}

function buildProvider(
  config: BillingConfig,
  catalog: BillingCatalog,
): BillingProvider {
  // +feature:billing-stripe
  if (config.provider === "stripe" && config.stripe) {
    return new StripeBillingProvider(
      { apiKey: config.stripe.apiKey },
      () => catalog.list(),
    );
  }
  // -feature:billing-stripe
  return new NoopBillingProvider();
}

function buildWebhookReceiver(
  config: BillingConfig,
): BillingWebhookReceiver | null {
  // +feature:billing-stripe
  if (config.provider === "stripe" && config.stripe) {
    return new StripeWebhookReceiver({
      apiKey: config.stripe.apiKey,
      webhookSecret: config.stripe.webhookSecret,
    });
  }
  // -feature:billing-stripe
  return null;
}

function resolvePlans(config: BillingConfig): readonly BillingPlan[] {
  // +feature:billing-stripe
  if (config.provider === "stripe") return config.stripe?.plans ?? [];
  // -feature:billing-stripe
  return [];
}

export const billingFeature: FeatureModule<BillingServices> = {
  name: "billing",
  services: (core: FeatureCore) => {
    const billing = core.config.billing;
    const catalog = new BillingCatalog(resolvePlans(billing));
    const provider = buildProvider(billing, catalog);
    const receiver = buildWebhookReceiver(billing);

    return {
      getWorkspaceBilling: new GetWorkspaceBillingService(core.uow, catalog),
      startCheckout: billing.enabled
        ? new StartCheckoutService(core.uow, core.clock, provider, catalog)
        : null,
      openPortal: billing.enabled
        ? new OpenPortalService(core.uow, provider)
        : null,
      cancelSubscription: billing.enabled
        ? new CancelSubscriptionService(core.uow, provider)
        : null,
      handleBillingWebhook: receiver
        ? {
            provider: receiver.provider,
            service: new HandleBillingWebhookService(
              core.uow,
              core.clock,
              receiver,
              catalog,
            ),
          }
        : null,
    };
  },
};
