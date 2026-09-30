---
name: add-billing-provider
description: Use when adding a fourth BillingProvider adapter (or modifying an existing one). Covers the BillingProvider interface, the matching webhook receiver, env wiring, composition.ts selection, and the mutually-exclusive sub-feature declaration in features.json.
---

# Adding a billing provider

Orbit's billing layer is a port-and-adapter design. The `BillingProvider` interface lives in `apps/api/src/billing/domain/`; adapters in `apps/api/src/billing/infrastructure/`. Three are shipped: Stripe, Polar, Dodo. Adding a fourth means implementing the interface, writing a webhook receiver, declaring it as a mutually-exclusive sub-feature, and wiring the CLI.

## The interface

`BillingProvider`:

- `key: string` — stable identifier matching the env value (`stripe`, `polar`, `dodo`, ...)
- `listPlans(): BillingPlan[]` — read from `BILLING_PLANS_JSON`
- `findCustomer(providerCustomerId)` / `createCustomer(input)` — customer lifecycle
- `startCheckout(input)` — returns `{ redirectUrl, sessionId }`
- `openPortal(input)` — returns `{ redirectUrl }`
- `cancelSubscription(input)` — `void`
- `fetchSubscription(providerSubscriptionId)` — for reconciliation

## Steps

### 1. Implement the adapter

`apps/api/src/billing/infrastructure/<name>-billing-provider.ts`. Pattern: thin wrapper around the provider's TypeScript SDK; map provider types to Orbit's `ProviderCustomer` / `ProviderSubscription` value objects.

### 2. Implement the webhook receiver

`apps/api/src/billing/infrastructure/<name>-webhook-receiver.ts`. The receiver:

- **Verifies the signature**. Each provider has its own header convention; Polar + Dodo use Standard-Webhooks (`webhook-id` / `webhook-timestamp` / `webhook-signature`, `npm:standardwebhooks` package). Stripe has its own scheme via `Stripe.webhooks.constructEvent`.
- **Translates provider events** into the canonical `BillingEvent` shape.
- **Hands off to** `HandleBillingWebhookService`.

### 3. Wire in `composition.ts`

```ts
// +feature:billing-<name>
if (env.BILLING_PROVIDER === "<name>") {
  billingProvider = new <Name>BillingProvider({...});
  billingWebhookReceiver = new <Name>WebhookReceiver({...});
}
// -feature:billing-<name>
```

### 4. Declare the sub-feature in `features.json`

```jsonc
"billing-<name>": {
  "name": "billing-<name>",
  "tier": "paid",
  "label": "Billing: <Name> adapter",
  "description": "...",
  "defaultEnabled": false,
  "requires": ["billing"],
  "files": [
    "apps/api/src/billing/infrastructure/<name>-billing-provider.ts",
    "apps/api/src/billing/infrastructure/<name>-webhook-receiver.ts"
  ],
  "fencedRegions": [
    "apps/api/src/billing/feature.ts",
    "apps/api/src/composition.ts"
  ],
  "envKeys": ["<NAME>_API_KEY", "<NAME>_WEBHOOK_SECRET"]
}
```

Also add `<name>` to `features.billing.options.provider.choices`.

### 5. Update the CLI

In `packages/create-orb/src/args.ts`:

- Extend the `BillingProviderChoice` union
- Append to `BILLING_PROVIDER_CHOICES`
- Update `normalizeBillingProvider()`
- Add `billing-<name>` to the `FeatureKey` union, `FEATURE_KEYS` array, and `PAID_FEATURES` set
- Update `HELP_TEXT`

In `packages/create-orb/src/prompts.ts`:

- Add the new option to the billing-provider prompt's choices

### 6. Docs

Add the new provider to `docs/billing-providers.md`. Note merchant-of-record status, signature scheme, what's idiomatic about the SDK.

## Webhook signing

Use the provider's official verifier when available. Don't roll your own HMAC — the failure modes (constant-time compare, replay window) are subtle. If the provider speaks Standard-Webhooks, use the `standardwebhooks` package and you get `webhook-id` replay protection for free.

## Sanity check

- Stripping the new sub-feature removes the adapter file, the webhook receiver, and the composition branch — Stripe / Polar / Dodo still work
- `BILLING_PROVIDER=<name> npm run dev:api` boots without errors
- A test webhook (locally via smee + the webhook-tunnel app) is verified, parsed, and lands in the `billing_event` table
