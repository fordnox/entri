# Billing providers

Orbit ships three billing adapters behind the same `BillingProvider`
port and the same `BillingWebhookReceiver` port:

| Provider | Adapter key | Best for |
|---|---|---|
| [Stripe](https://stripe.com) | `stripe` | You want to be the merchant of record. US-first SaaS. Most mature SDK / dashboard. |
| [Polar](https://polar.sh) | `polar` | You want merchant-of-record so you don't handle sales tax / VAT yourself. Indie-friendly pricing, open source. |
| [Dodo Payments](https://dodopayments.com) | `dodo` | You want merchant-of-record with a Stainless-generated TypeScript SDK and a simpler webhook surface. |

All three implement exactly the same feature set in the app:

- plan catalog driven by `BILLING_PLANS_JSON` on the API
- hosted checkout that redirects back to the workspace settings page
- customer portal for managing payment method, invoices, and cancellation
- webhook-driven reconciliation that writes through the Unit of Work
  and dispatches `SubscriptionCreated` / `SubscriptionUpdated` /
  `SubscriptionCanceled` domain events

## Picking one

If you're not sure which to pick:

- **US-first and want total control** → Stripe. You're responsible for
  sales tax collection yourself (or via Stripe Tax). The dashboard and
  SDK are the richest of the three, and most Stripe snippets you'll
  find online apply directly.
- **Indie SaaS, sell globally, don't want to think about tax** → Polar.
  Polar is the merchant of record, so it handles VAT / sales tax and
  pays you out minus fees. The SDK is small and ergonomic.
- **Want merchant-of-record with a more Stripe-shaped API** → Dodo. It
  uses a Stainless-generated SDK (so the TS types feel like Stripe's)
  and exposes a hosted checkout + customer portal like the others.

You can always swap providers later — the app only depends on the two
ports, not on any SDK directly.

## Wiring a provider

Pick one and set the matching env vars in `apps/api/.env`:

### Stripe

```env
BILLING_PROVIDER="stripe"
STRIPE_SECRET_KEY="sk_test_…"
STRIPE_WEBHOOK_SECRET="whsec_…"
```

Webhook endpoint: `POST /v1/billing/webhooks/stripe`.
Create the endpoint in the Stripe dashboard and subscribe to
`customer.subscription.*` and `invoice.*`.

### Polar

```env
BILLING_PROVIDER="polar"
POLAR_ACCESS_TOKEN="polar_oat_…"
POLAR_WEBHOOK_SECRET="polar_whs_…"
POLAR_SERVER="sandbox"   # or "production"
```

Webhook endpoint: `POST /v1/billing/webhooks/polar`.
In Polar, create a webhook pointing at that URL. Polar uses the
[Standard Webhooks](https://www.standardwebhooks.com/) header set
(`webhook-id`, `webhook-timestamp`, `webhook-signature`).

### Dodo Payments

```env
BILLING_PROVIDER="dodo"
DODO_PAYMENTS_API_KEY="dodo_test_…"
DODO_PAYMENTS_WEBHOOK_KEY="whsec_…"
DODO_PAYMENTS_ENVIRONMENT="test_mode"   # or "live_mode"
```

Webhook endpoint: `POST /v1/billing/webhooks/dodo`.
Dodo also uses Standard Webhooks.

## Plans

Regardless of provider, the catalog is declared once on the API:

```env
BILLING_PLANS_JSON='[{"key":"pro","name":"Pro","description":null,"priceId":"price_…","unitAmount":800,"currency":"usd","interval":"month","intervalCount":1,"features":["Unlimited teams","Priority email"]}]'
```

`priceId` is provider-specific:

- Stripe → price id (`price_…`)
- Polar → product id
- Dodo → product id

When you outgrow env-embedded plans, replace the catalog source in
`apps/api/src/composition.ts` with a DB-backed one — the
`BillingCatalog` only knows about `BillingPlan` records.

## Local webhook tunnel

`apps/webhook-tunnel` forwards a [smee.io](https://smee.io) channel to
the local API during `npm run dev`. Point it at the webhook path for
your chosen provider:

```env
SMEE_URL="https://smee.io/<your-channel>"
SMEE_TARGET_PATH="/v1/billing/webhooks/stripe"   # or /polar, /dodo
```

See [`apps/webhook-tunnel/README.md`](../apps/webhook-tunnel/README.md)
for the full setup.

## Generating a project without billing, or with a different provider

The `create-orb` CLI asks which provider to wire in. Picking one
strips the other two adapters and their env vars from the generated
project. Picking "no billing" removes the whole `billing` feature
(routes, UI, domain) so the generated repo doesn't carry unused code.

```sh
npx create-orb ./my-app --billing-provider=polar
```

Under the hood this toggles the `billing-stripe` / `billing-polar` /
`billing-dodo` sub-features declared in `features.json` so the strip
pass can delete the right adapter files and env keys.
