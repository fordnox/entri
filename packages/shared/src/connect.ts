/**
 * Wire contract for Connect — the "let your users connect their own
 * domain" product. Three audiences read this file:
 *
 *  - the API (`apps/api/src/connect`), which validates and serves it,
 *  - the embeddable SDK (`packages/connect-js`), which drives the modal
 *    against the public `/v1/connect/*` endpoints,
 *  - the dashboard (`apps/web-tanstack`), which manages applications and
 *    inspects connected domains through `/v1/workspaces/:slug/connect/*`.
 *
 * Framework-free and dependency-free on purpose.
 */
import type { Id } from "./ids.ts";

export type ConnectApplicationId = Id<"connectApplication">;
export type DomainConnectionId = Id<"domainConnection">;
export type WebhookDeliveryId = Id<"webhookDelivery">;

// ── DNS records ─────────────────────────────────────────────────────────

export type DnsRecordType = "A" | "AAAA" | "CNAME" | "TXT" | "MX" | "CAA";

export const DNS_RECORD_TYPES: readonly DnsRecordType[] = [
  "A",
  "AAAA",
  "CNAME",
  "TXT",
  "MX",
  "CAA",
];

/**
 * A record the integrating app wants on its end user's domain, as passed
 * to `showConnect({ dnsRecords })`.
 *
 * `host` is relative to the domain the user enters: `"@"` is the apex
 * (or the entered subdomain itself), `"www"` is `www.<domain>`.
 * `host` and `value` may contain placeholders resolved server-side:
 *
 *  - `{DOMAIN}`     — the full domain the user entered (`shop.acme.com`)
 *  - `{ROOT_DOMAIN}` — the registrable domain (`acme.com`)
 *  - `{SUBDOMAIN}`  — the subdomain part, or empty string (`shop`)
 */
export interface DnsRecordInput {
  type: DnsRecordType;
  host: string;
  value: string;
  /** Seconds. Defaults to 300. */
  ttl?: number;
  /** MX only. */
  priority?: number;
}

/**
 * Records can be given as one flat list, or split by what the user
 * enters: a bare registrable domain (`acme.com`) vs a subdomain
 * (`shop.acme.com`). Mirrors how most hosting platforms need an A
 * record on the apex but a CNAME on subdomains.
 */
export type DnsRecordsConfig =
  | DnsRecordInput[]
  | { domain: DnsRecordInput[]; subDomain: DnsRecordInput[] };

export type DnsRecordStatus = "pending" | "propagating" | "verified" | "mismatch";

/** A record after placeholder resolution, with its live DNS state. */
export interface ResolvedDnsRecordDTO {
  type: DnsRecordType;
  /** Relative to the zone (root domain): `"@"`, `"www"`, `"shop"`, `"_verify.shop"`. */
  host: string;
  /** Fully-qualified name: `shop.acme.com`. */
  fqdn: string;
  value: string;
  ttl: number;
  priority?: number;
  status: DnsRecordStatus;
  /** Values currently served by public resolvers, for debugging mismatches. */
  observed: string[];
}

// ── Providers ───────────────────────────────────────────────────────────

export interface ProviderCredentialFieldDTO {
  key: string;
  label: string;
  /** Rendered as a password input when true. */
  secret: boolean;
  placeholder?: string;
  help?: string;
}

export interface DnsProviderDTO {
  key: string;
  name: string;
  /** True when Connect can write records through the provider's API. */
  automated: boolean;
  /** Credential form shown before automatic setup. Empty when not automated. */
  credentialFields: ProviderCredentialFieldDTO[];
  /** Where the user creates an API token for automatic setup. */
  credentialsUrl: string | null;
  /** Where the user edits DNS by hand (manual setup fallback). */
  dnsPanelUrl: string | null;
}

// ── Public (SDK-facing) endpoints ───────────────────────────────────────

/** `POST /v1/connect/token` — server-to-server, never from a browser. */
export interface IssueTokenRequest {
  applicationId: string;
  secret: string;
}

export interface IssueTokenResponse {
  auth_token: string;
  /** Seconds until expiry (3600). */
  expires_in: number;
}

/** `GET /v1/connect/application` — branding for the modal header. */
export interface ConnectApplicationPublicDTO {
  applicationId: ConnectApplicationId;
  name: string;
  iconUrl: string | null;
}

/** `POST /v1/connect/domains/check` */
export interface CheckDomainRequest {
  domain: string;
}

export interface CheckDomainResponse {
  /** Normalized (lowercase, no scheme / trailing dot / path). */
  domain: string;
  rootDomain: string;
  /** Null when the user entered a registrable domain. */
  subdomain: string | null;
  nameservers: string[];
  /** Null when nameservers didn't match any known provider. */
  provider: DnsProviderDTO | null;
}

export type SetupMethod = "automatic" | "manual";

export type DomainConnectionStatus =
  /** Records resolved, nothing written or observed yet. */
  | "pending"
  /** Records written (automatic) or user says they added them (manual); waiting on DNS. */
  | "propagating"
  /** Every record is served by public resolvers. Terminal (until re-verify fails). */
  | "connected"
  /** Automatic setup was rejected by the provider. User can retry or go manual. */
  | "failed";

/** `POST /v1/connect/configurations` */
export interface CreateConfigurationRequest {
  domain: string;
  dnsRecords: DnsRecordsConfig;
  /** Your own identifier for the end user, echoed back in webhooks. */
  userId?: string;
  /** Free-form data echoed back in webhooks. Max 2 KB serialized. */
  metadata?: Record<string, unknown>;
}

export interface DomainConnectionDTO {
  id: DomainConnectionId;
  applicationId: ConnectApplicationId;
  domain: string;
  rootDomain: string;
  subdomain: string | null;
  userId: string | null;
  metadata: Record<string, unknown> | null;
  provider: DnsProviderDTO | null;
  setupMethod: SetupMethod | null;
  status: DomainConnectionStatus;
  records: ResolvedDnsRecordDTO[];
  lastError: string | null;
  lastCheckedAt: string | null;
  connectedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** `POST /v1/connect/configurations/:id/automate` */
export interface AutomateConfigurationRequest {
  /** Keyed by `ProviderCredentialFieldDTO.key`. Used once, never stored. */
  credentials: Record<string, string>;
}

/** `POST /v1/connect/configurations/:id/manual` — user chose to add records by hand. */
export type MarkManualRequest = Record<string, never>;

// `POST /v1/connect/configurations/:id/verify` → DomainConnectionDTO
// `GET  /v1/connect/configurations/:id`        → DomainConnectionDTO

// ── Dashboard endpoints (`/v1/workspaces/:slug/connect/*`) ──────────────

export interface ConnectApplicationDTO {
  id: ConnectApplicationId;
  name: string;
  iconUrl: string | null;
  /** Last 4 characters of the current secret, e.g. `"…9f2c"`. */
  secretPreview: string;
  secretRotatedAt: string;
  /** Browser origins allowed to call the public API with this app's tokens. Empty = any. */
  allowedOrigins: string[];
  webhookUrl: string | null;
  /** Always present so it can be shown/copied in the dashboard. */
  webhookSigningSecret: string;
  domainCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateApplicationRequest {
  name: string;
  iconUrl?: string | null;
  allowedOrigins?: string[];
  webhookUrl?: string | null;
}

/** Returned exactly once — on create and on rotate. */
export interface ApplicationWithSecretDTO {
  application: ConnectApplicationDTO;
  secret: string;
}

export type UpdateApplicationRequest = Partial<CreateApplicationRequest>;

export interface DomainConnectionListItemDTO extends DomainConnectionDTO {
  applicationName: string;
}

export interface DomainConnectionPageDTO {
  items: DomainConnectionListItemDTO[];
  nextCursor: string | null;
}

export type WebhookEventType =
  | "domain.connected"
  | "domain.disconnected"
  | "domain.setup_failed"
  | "webhook.test";

export type WebhookDeliveryStatus = "pending" | "succeeded" | "failed";

export interface WebhookDeliveryDTO {
  id: WebhookDeliveryId;
  applicationId: ConnectApplicationId;
  connectionId: DomainConnectionId | null;
  eventType: WebhookEventType;
  url: string;
  status: WebhookDeliveryStatus;
  attempts: number;
  lastStatusCode: number | null;
  lastError: string | null;
  payload: WebhookPayload;
  createdAt: string;
  deliveredAt: string | null;
}

/**
 * Body POSTed to an application's `webhookUrl`. Signed with
 * `Connect-Signature: t=<unix seconds>,v1=<hex hmac-sha256>` where the
 * HMAC input is `${t}.${rawBody}` keyed by the webhook signing secret.
 */
export interface WebhookPayload {
  id: WebhookDeliveryId;
  type: WebhookEventType;
  createdAt: string;
  data: {
    connection: DomainConnectionDTO | null;
  };
}

/** `POST /v1/workspaces/:slug/connect/applications/:id/test-token` */
export interface TestTokenResponse {
  applicationId: ConnectApplicationId;
  auth_token: string;
  expires_in: number;
  /** Public API base, e.g. `http://localhost:4002`. */
  apiOrigin: string;
}
