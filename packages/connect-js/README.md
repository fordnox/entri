# @orbit/connect-js

The embeddable browser SDK for **Connect**. One call opens a modal that
takes your end user from "I own `acme.com`" to "the DNS records your
platform needs are live". If we support their DNS provider, the records
are created through its API. If not, the modal shows copy-paste
instructions and checks the records live until they resolve.

The full product/API contract lives in [`docs/connect.md`](../../docs/connect.md);
wire types are in `@orbit/shared/connect`.

- Framework-free, no runtime dependencies (~39 KB minified, ~12 KB gzipped)
- Renders in a Shadow DOM, so host-page CSS can't leak in
- Accessible: `role="dialog"`, `aria-modal`, focus trap, Escape to close, focus restored on close
- Follows `prefers-color-scheme` and `prefers-reduced-motion`; becomes a full-screen sheet under 480px

## Install

### Script tag

```html
<script src="https://<api-origin>/sdk/connect.js"></script>
<script>
  Connect.showConnect({ /* config */ });
</script>
```

The IIFE build defines `window.Connect = { showConnect, close, version }`.
When `apiOrigin` isn't passed, it defaults to the origin the script was
loaded from.

### npm / bundler

```ts
import { showConnect, close } from "@orbit/connect-js";
```

In the ESM build, `apiOrigin` defaults to `window.location.origin`, so
pass it whenever the API runs on a different origin.

## 1. Mint a token on your server

Keep the application secret on your server and never ship it to a
browser. Exchange it for a short-lived token (1 hour):

```bash
curl -X POST https://<api-origin>/v1/connect/token \
  -H 'content-type: application/json' \
  -d '{"applicationId":"app_…","secret":"sk_…"}'
# → {"auth_token":"eyJ…","expires_in":3600}
```

```ts
// e.g. an Express/Hono route on your backend
app.post("/api/connect-token", async (req, res) => {
  const r = await fetch("https://<api-origin>/v1/connect/token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      applicationId: process.env.CONNECT_APP_ID,
      secret: process.env.CONNECT_SECRET,
    }),
  });
  const { auth_token } = await r.json();
  res.json({ token: auth_token });
});
```

## 2. Open the modal

```js
const { token } = await fetch("/api/connect-token", { method: "POST" }).then((r) => r.json());

Connect.showConnect({
  applicationId: "app_…",
  token,
  prefilledDomain: "acme.com",
  userId: "cus_123",
  dnsRecords: {
    domain:    [{ type: "A",     host: "@",   value: "76.76.21.21", ttl: 300 },
                { type: "CNAME", host: "www", value: "cname.yourapp.com" }],
    subDomain: [{ type: "CNAME", host: "@",   value: "cname.yourapp.com" }],
  },
  onSuccess: ({ domain, connectionId, setupType, provider }) => {},
  onClose:   ({ domain, connectionId, success, setupType, lastStatus }) => {},
});
```

## Config

| Option | Type | Required | Description |
| --- | --- | --- | --- |
| `applicationId` | `string` | yes | Your application ID (`app_…`). |
| `token` | `string` | yes | `auth_token` minted server-side via `POST /v1/connect/token`. |
| `dnsRecords` | `DnsRecordInput[] \| { domain, subDomain }` | yes | Records to create. A flat array applies to every domain. The split form picks a list depending on whether the user enters a registrable domain or a subdomain. |
| `prefilledDomain` | `string` | no | Prefills the domain input. |
| `userId` | `string` | no | Your identifier for the end user, echoed back in webhooks. |
| `metadata` | `Record<string, unknown>` | no | Free-form data echoed back in webhooks (max 2 KB serialized). |
| `apiOrigin` | `string` | no | API base URL. Default: the origin the script was loaded from (script tag) or `window.location.origin` (ESM). |
| `forceManualSetup` | `boolean` | no | Skip automatic setup even when the provider supports it. |
| `onSuccess` | `(r: ConnectSuccess) => void` | no | Fires once, when every record is verified. |
| `onClose` | `(r: ConnectCloseResult) => void` | no | Fires exactly once, whenever the modal closes. |
| `onStepChange` | `(step: ConnectStep) => void` | no | Fires on every step transition. |

### DNS records

`host` is relative to what the user types: `@` is the domain itself and
`www` is `www.<domain>`. `host` and `value` accept the placeholders
`{DOMAIN}`, `{ROOT_DOMAIN}` and `{SUBDOMAIN}`, which are resolved
server-side. Supported types are `A`, `AAAA`, `CNAME`, `TXT`, `MX` (with
`priority`) and `CAA`. TTL defaults to 300.

## Flow

| Step | What the user sees |
| --- | --- |
| `domain` | Domain input. Submitting calls `POST /domains/check`, then `POST /configurations`. |
| `provider` | The detected DNS provider, with "Connect automatically" or "Set up manually". This step appears only when the provider supports automatic setup and `forceManualSetup` is off. |
| `credentials` | The provider's API-token form. Credentials are sent once to `/automate` and never stored. |
| `manual` | Records to add, a copy button per value, and a link to the provider's DNS panel. "I've added these records" calls `/manual`. |
| `verifying` | Polls `/verify` every 5 s and shows each record's status (`pending` / `propagating` / `verified` / `mismatch`, with the observed values). Polling pauses after 10 minutes and a "Check again" button appears. The user can close the modal while propagation continues server-side. |
| `success` | Confirmation. `onSuccess` fires. |
| `error` | Fatal errors: invalid or expired token, origin not allowed, network failure. "Try again" appears where a retry makes sense. |

## Results

```ts
type ConnectStep = "domain" | "provider" | "credentials" | "manual" | "verifying" | "success" | "error";

interface ConnectSuccess {
  domain: string;
  connectionId: string;
  setupType: "automatic" | "manual";
  provider: string | null;      // provider display name
}

interface ConnectCloseResult {
  domain: string | null;
  connectionId: string | null;
  success: boolean;             // true only if closed from the success step
  setupType: "automatic" | "manual" | null;
  lastStatus: ConnectStep;
}
```

A close from `verifying` returns `success: false`. Propagation still
continues server-side, and your backend receives `domain.connected` by
webhook once the records resolve.

## Events

Each callback is also dispatched on `window` as a `CustomEvent`. The
callback's argument is in `event.detail`.

```js
window.addEventListener("onConnectStepChange", (e) => console.log(e.detail)); // ConnectStep
window.addEventListener("onConnectSuccess",    (e) => console.log(e.detail)); // ConnectSuccess
window.addEventListener("onConnectClose",      (e) => console.log(e.detail)); // ConnectCloseResult
```

## API

```ts
showConnect(config: ConnectConfig): ConnectHandle  // { close(): void }
close(): void                                      // close whichever modal is open
version: string
class ConnectApiError extends Error { code: string; status: number }
```

Calling `showConnect` while a modal is open closes the previous one first,
and its `onClose` fires.

## Webhooks

Handle `domain.connected`, `domain.disconnected` and
`domain.setup_failed` at your application's webhook URL. Verify the
`Connect-Signature: t=<unix>,v1=<hex>` header, where `hex` is
`HMAC-SHA256(webhookSigningSecret, "<t>.<raw body>")`.

## Development

```bash
npm run build --workspace @orbit/connect-js      # dist/connect.js (IIFE) + dist/connect.esm.js
npm run typecheck --workspace @orbit/connect-js
```

`examples/index.html` is a playground. It loads `../dist/connect.js` and
takes an application ID, a token, the API origin and a JSON `dnsRecords`
config, then logs every callback and window event on the page.
