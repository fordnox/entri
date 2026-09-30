# Connect — let your users connect their own domain

Connect is this kit's core product: an embeddable modal (`showConnect()`)
that takes an end user from "I own `acme.com`" to "the DNS records your
platform needs are live" — automatically through the DNS provider's API
when we support it, or with copy-paste instructions plus live
verification when we don't. Every change is reported to your backend by
signed webhook.

Types for everything below live in `packages/shared/src/connect.ts`
(`@orbit/shared/connect`).

## Integration in five steps

1. **Create an application** in the dashboard (`Connect → Applications`).
   You get an `applicationId` (`app_…`) and a `secret` (shown once).
2. **Load the SDK** — `<script src="https://<api-origin>/sdk/connect.js">`
   (defines `window.Connect`) or `import { showConnect } from "@orbit/connect-js"`.
3. **Mint a token on your server** — never ship the secret to a browser:

   ```bash
   curl -X POST https://<api-origin>/v1/connect/token \
     -H 'content-type: application/json' \
     -d '{"applicationId":"app_…","secret":"sk_…"}'
   # → {"auth_token":"eyJ…","expires_in":3600}
   ```

4. **Open the modal** with the records your platform needs:

   ```js
   Connect.showConnect({
     applicationId: "app_…",
     token: authToken,
     prefilledDomain: "acme.com",          // optional
     userId: "cus_123",                    // optional, echoed in webhooks
     dnsRecords: {
       domain:    [{ type: "A",     host: "@",   value: "76.76.21.21", ttl: 300 },
                   { type: "CNAME", host: "www", value: "cname.yourapp.com" }],
       subDomain: [{ type: "CNAME", host: "@",   value: "cname.yourapp.com" }],
     },
     onSuccess: ({ domain, connectionId, setupType }) => {},
     onClose:   ({ domain, success, setupType, lastStatus }) => {},
   });
   ```

5. **Handle webhooks** (`domain.connected`, `domain.disconnected`,
   `domain.setup_failed`) at the application's webhook URL. Verify the
   `Connect-Signature: t=<unix>,v1=<hex>` header: `hex` is
   `HMAC-SHA256(webhookSigningSecret, "<t>.<raw body>")`.

## DNS records

`host` is relative to what the user types: `@` is the domain itself,
`www` is `www.<domain>`. `host` and `value` accept `{DOMAIN}`,
`{ROOT_DOMAIN}` and `{SUBDOMAIN}` placeholders. Supported types: `A`,
`AAAA`, `CNAME`, `TXT`, `MX` (with `priority`), `CAA`. TTL defaults to 300.
A flat array applies to every domain; the `{ domain, subDomain }` form
picks by whether the user entered a registrable domain or a subdomain.

## Public API (SDK-facing)

All routes are CORS-open (no cookies). Everything but `/token` and
`/providers` needs `Authorization: Bearer <auth_token>`. If the
application lists `allowedOrigins`, browser requests from other origins
are rejected with `403 origin_not_allowed`.

| Method | Path | Body → Response |
| --- | --- | --- |
| POST | `/v1/connect/token` | `IssueTokenRequest` → `IssueTokenResponse` |
| GET  | `/v1/connect/providers` | → `DnsProviderDTO[]` |
| GET  | `/v1/connect/application` | → `ConnectApplicationPublicDTO` |
| POST | `/v1/connect/domains/check` | `CheckDomainRequest` → `CheckDomainResponse` |
| POST | `/v1/connect/configurations` | `CreateConfigurationRequest` → `DomainConnectionDTO` (201) |
| GET  | `/v1/connect/configurations/:id` | → `DomainConnectionDTO` |
| POST | `/v1/connect/configurations/:id/automate` | `AutomateConfigurationRequest` → `DomainConnectionDTO` |
| POST | `/v1/connect/configurations/:id/manual` | `{}` → `DomainConnectionDTO` |
| POST | `/v1/connect/configurations/:id/verify` | `{}` → `DomainConnectionDTO` |

Errors use the kit's standard shape: `{ "error": { "code", "message" } }`.
Notable codes: `token.invalid`, `token.expired`, `origin_not_allowed`,
`domain.invalid`, `dns_records.invalid`, `provider.not_automated`,
`provider.invalid_credentials`, `provider.zone_not_found`,
`provider.permission_denied`, `provider.rate_limited`, `provider.error`.

Provider credentials sent to `/automate` are used for that one request
and never stored or logged.

## Dashboard API (session cookie, workspace-scoped)

| Method | Path | Permission | Body → Response |
| --- | --- | --- | --- |
| GET    | `/v1/workspaces/:slug/connect/applications` | `connect.applications.view` | → `ConnectApplicationDTO[]` |
| POST   | `/v1/workspaces/:slug/connect/applications` | `connect.applications.manage` | `CreateApplicationRequest` → `ApplicationWithSecretDTO` (201) |
| GET    | `/v1/workspaces/:slug/connect/applications/:appId` | `connect.applications.view` | → `ConnectApplicationDTO` |
| PATCH  | `/v1/workspaces/:slug/connect/applications/:appId` | `connect.applications.manage` | `UpdateApplicationRequest` → `ConnectApplicationDTO` |
| DELETE | `/v1/workspaces/:slug/connect/applications/:appId` | `connect.applications.manage` | → 204 |
| POST   | `/v1/workspaces/:slug/connect/applications/:appId/rotate-secret` | `connect.applications.manage` | → `ApplicationWithSecretDTO` |
| POST   | `/v1/workspaces/:slug/connect/applications/:appId/rotate-webhook-secret` | `connect.applications.manage` | → `ConnectApplicationDTO` |
| POST   | `/v1/workspaces/:slug/connect/applications/:appId/test-token` | `connect.applications.manage` | → `TestTokenResponse` |
| POST   | `/v1/workspaces/:slug/connect/applications/:appId/test-webhook` | `connect.applications.manage` | → `WebhookDeliveryDTO` |
| GET    | `/v1/workspaces/:slug/connect/applications/:appId/deliveries` | `connect.applications.view` | → `WebhookDeliveryDTO[]` (latest 50) |
| GET    | `/v1/workspaces/:slug/connect/domains?applicationId=&status=&q=&cursor=` | `connect.domains.view` | → `DomainConnectionPageDTO` |
| GET    | `/v1/workspaces/:slug/connect/domains/:connectionId` | `connect.domains.view` | → `DomainConnectionListItemDTO` |
| POST   | `/v1/workspaces/:slug/connect/domains/:connectionId/verify` | `connect.domains.manage` | → `DomainConnectionListItemDTO` |
| DELETE | `/v1/workspaces/:slug/connect/domains/:connectionId` | `connect.domains.manage` | → 204 |

## SDK surface (`@orbit/connect-js`)

```ts
showConnect(config: ConnectConfig): ConnectHandle   // { close(): void }
close(): void

interface ConnectConfig {
  applicationId: string;
  token: string;
  dnsRecords: DnsRecordsConfig;
  prefilledDomain?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
  apiOrigin?: string;          // default: origin the script was loaded from
  forceManualSetup?: boolean;  // skip automatic setup even when supported
  onSuccess?: (r: ConnectSuccess) => void;
  onClose?: (r: ConnectCloseResult) => void;
  onStepChange?: (step: ConnectStep) => void;
}
type ConnectStep = "domain" | "provider" | "credentials" | "manual" | "verifying" | "success" | "error";
interface ConnectSuccess { domain: string; connectionId: string; setupType: SetupMethod; provider: string | null }
interface ConnectCloseResult { domain: string | null; connectionId: string | null; success: boolean; setupType: SetupMethod | null; lastStatus: ConnectStep }
```

Also dispatched on `window` as `CustomEvent`s: `onConnectSuccess`,
`onConnectClose`, `onConnectStepChange` (payload in `event.detail`).
