# @orbit/webhook-tunnel

Dev-only workspace that forwards third-party webhooks from
[smee.io](https://smee.io) channels to local services. Keeps your
laptop off the public internet while still letting you develop against
real provider events.

Runs as part of `npm run dev` (TurboRepo picks it up automatically).
The process forwards two independent channels:

- **API billing webhooks** — configured in `apps/api/.env`
  (`SMEE_URL`, `SMEE_TARGET_PATH`, `API_ORIGIN`). Default target:
  `http://localhost:4002/v1/billing/webhooks/stripe`.
- **Platform webhooks** (internal CLI-sale flow) — configured in
  `internal/platform/.env` (`PLATFORM_SMEE_URL`, `PLATFORM_TARGET_PATH`,
  `PLATFORM_ORIGIN`). Default target:
  `http://localhost:4100/v1/webhooks/polar`.

Either tunnel is skipped if its `SMEE_URL` is unset — contributors who
only need one path aren't blocked by the other.

## Platform tunnel (CLI-sale Polar webhooks)

1. Create a smee channel at [smee.io/new](https://smee.io/new).
2. In `internal/platform/.env`, set:
   ```env
   PLATFORM_SMEE_URL=https://smee.io/your-channel-id
   ```
3. In the Polar sandbox dashboard, register that smee URL as a webhook
   endpoint and subscribe to `order.paid` and `order.refunded`. Copy
   the signing secret into `POLAR_WEBHOOK_SECRET`.
4. `npm run dev` — you'll see:
   ```
   [webhook-tunnel:platform] forwarding https://smee.io/... -> http://localhost:4100/v1/webhooks/polar
   ```

## Setup

1. Create a smee channel once per dev environment: visit
  [smee.io/new](https://smee.io/new) and copy the URL.
2. In `apps/api/.env`, set `SMEE_URL`, plus the env vars for your
  chosen billing provider (see
   `[docs/billing-providers.md](../../docs/billing-providers.md)`):
3. Point `SMEE_TARGET_PATH` at the matching webhook route (defaults to
  `/v1/billing/webhooks/stripe`):
4. In the provider's dashboard, create a webhook endpoint pointing at
  your smee URL. Subscribe to the subscription lifecycle events:
  - **Stripe** — `customer.subscription.`*, `invoice.`*
  - **Polar** — `subscription.created`, `subscription.updated`,
  `subscription.canceled`, `subscription.revoked`
  - **Dodo** — `subscription.active`, `subscription.on_hold`,
  `subscription.cancelled`, `subscription.failed`,
  `subscription.expired`, `subscription.renewed`
5. Start everything:
  ```sh
   npm run dev
  ```
   You should see a log line like:

## Forwarding somewhere else

`SMEE_TARGET_PATH` can point at any API route — useful when adding a
new provider adapter you're building:

```env
SMEE_TARGET_PATH="/v1/billing/webhooks/paddle"
```

## What flows through it

Whichever provider is wired, each webhook arrives at the server,
is signature-verified by the adapter
(`StripeWebhookReceiver` / `PolarWebhookReceiver` /
`DodoWebhookReceiver`), and then handed to
`HandleBillingWebhookService` which normalizes the event and updates
the workspace's `Subscription` row inside a Unit of Work.

Invalid signatures return `400` with
`billing.webhook.invalid_signature`.