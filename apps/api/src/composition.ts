/**
 * Composition root.
 *
 * Builds the `AppContainer` out of a shared `FeatureCore` (clock, bus,
 * uow, hub, …) + a list of feature modules. Each `feature.ts` owns its
 * own service wiring; composition.ts just stitches them together.
 *
 * The `// +feature:<name>` / `// -feature:<name>` fences below are what
 * the generator CLI targets when stripping a feature from the kit.
 * Keep the fence markers on their own line, with the matching closing
 * fence, so the strip pass can be a dumb line-range delete.
 *
 * No side effects here: nothing subscribes to the event bus, nothing
 * touches the DB. Call `startBackgroundWork` from your runtime entry
 * point (index.ts) to wire projectors onto the bus. Tests can
 * instantiate this freely and pass `overrides` to swap any primitive.
 */
import type { Clock } from "@/kernel/clock.ts";
import { SystemClock } from "@/kernel/clock.ts";
import { InProcessEventBus, type EventBus } from "@/kernel/events.ts";
import type { FeatureCore } from "@/kernel/feature.ts";
import type { UnitOfWork } from "@/kernel/uow.ts";
import { ConsoleMailer, type Mailer } from "@/infrastructure/mailer.ts";
// +feature:email-resend
import { createDefaultMailer } from "@/infrastructure/resend-mailer.tsx";
// -feature:email-resend
// +feature:orm-drizzle
import { DrizzleUnitOfWork } from "@/infrastructure/drizzle-uow.ts";
import { getDrizzle, type Drizzle } from "@/infrastructure/drizzle.ts";
// -feature:orm-drizzle
// +feature:realtime
import { InProcessRealtimeHub, type RealtimeHub } from "@/realtime/hub.ts";
import { PresenceTracker } from "@/realtime/presence-tracker.ts";
import { RealtimeEventPublisher } from "@/realtime/realtime-event-publisher.ts";
// -feature:realtime
import { buildBetterAuth } from "@/interfaces/http/better-auth.ts";
// +feature:uploads
import type { FileStorage } from "@/uploads/application/file-storage.ts";
// -feature:uploads
import { identityFeature, type IdentityServices } from "@/identity/feature.ts";
import type { UserId } from "@/identity/domain/user.ts";
import { workspacesFeature, type WorkspacesServices } from "@/workspaces/feature.ts";
import {
  connectFeature,
  readConnectConfig,
  type ConnectConfig,
  type ConnectServices,
} from "@/connect/feature.ts";
// +feature:uploads
import { buildFileStorage, readUploadsConfig, type UploadsConfig } from "@/uploads/feature.ts";
// -feature:uploads
// +feature:billing
import {
  billingFeature,
  type BillingConfig,
  type BillingProviderKey,
  type BillingServices,
} from "@/billing/feature.ts";
import type { BillingPlan } from "@/billing/domain/billing-plan.ts";
// -feature:billing
// +feature:audit-log
import { auditFeature, type AuditServices } from "@/audit/feature.ts";
import { AuditProjector } from "@/audit/application/audit-projector.ts";
// -feature:audit-log
// +feature:jobs
import {
  buildJobQueue,
  buildJobDispatcher,
  buildJobs,
  type JobsConfig,
  type JobsProviderKey,
} from "@/jobs/feature.ts";
import type { JobDispatcher } from "@/jobs/application/job-dispatcher.ts";
import type { JobQueue } from "@/jobs/application/job-queue.ts";
import type { JobRegistry } from "@/jobs/application/job-registry.ts";
// -feature:jobs

export interface AppConfig {
  authSecret: string;
  apiOrigin: string;
  // +feature:auth-magic-link
  magicLinkTtlMinutes: number;
  // -feature:auth-magic-link
  webOrigin: string;
  wwwOrigin: string;
  /**
   * Additional browser origins that should be allowed by CORS and
   * trusted by better-auth. Useful when running multiple frontend shells
   * against one API (e.g. the Next.js dev server on :4003 alongside the
   * canonical TanStack Start app on :4001). Comma-separated via
   * `ADDITIONAL_WEB_ORIGINS` in the environment.
   */
  additionalOrigins: string[];
  cookieSecure: boolean;
  /**
   * Optional parent domain for auth cookies (e.g. `.wereorbit.com`),
   * loaded from `AUTH_COOKIE_DOMAIN`. When set, cookies are shared
   * across subdomains so the demo flow's session minted on the API
   * subdomain is readable on the app subdomain.
   */
  cookieDomain?: string;
  /** Connect (domain connection product). See `connect/feature.ts`. */
  connect: ConnectConfig;
  // +feature:auth-oauth
  social?: {
    google?: { clientId: string; clientSecret: string };
    apple?: { clientId: string; clientSecret: string };
  };
  // -feature:auth-oauth
  // +feature:uploads
  /**
   * File storage configuration. See `uploads/feature.ts` for provider
   * selection (`UPLOADS_PROVIDER`): hosted UploadThing with private
   * ACLs, any S3-compatible bucket (Cloudflare R2, AWS S3, MinIO…) with
   * presigned reads, or the no-op adapter that answers 501 / surfaces
   * a configuration message.
   */
  uploads: UploadsConfig;
  // -feature:uploads
  // +feature:billing
  /**
   * Billing. When `provider` is null (BILLING_PROVIDER unset or
   * equal to "noop"), the kit boots without a real billing adapter —
   * the `/billing` endpoints return 404 and the web UI can hide the
   * Billing tab via `RuntimeConfigDTO.billing.enabled = false`.
   */
  billing: BillingConfig;
  // -feature:billing
  // +feature:jobs
  /**
   * Background jobs. When `provider` is null (JOBS_PROVIDER unset or
   * equal to "noop"), services calling `jobQueue.enqueue` get a
   * `ConflictError` — the kit boots but background work is off.
   */
  jobs: JobsConfig;
  // -feature:jobs
}

/**
 * Full set of services available on the container. Built as a union of
 * each active feature's services record so stripping a feature (and
 * removing its spread in `buildContainer`) naturally removes the
 * corresponding keys from this type.
 */
export type AppServices = IdentityServices &
  WorkspacesServices &
  ConnectServices &
  // +feature:billing
  BillingServices &
  // -feature:billing
  // +feature:audit-log
  AuditServices &
  // -feature:audit-log
  {};

export interface AppContainer {
  config: AppConfig;
  // +feature:orm-drizzle
  drizzle: Drizzle;
  // -feature:orm-drizzle
  clock: Clock;
  bus: EventBus;
  uow: UnitOfWork;
  mailer: Mailer;
  // +feature:realtime
  hub: RealtimeHub;
  presence: PresenceTracker;
  // -feature:realtime
  // +feature:uploads
  fileStorage: FileStorage;
  // -feature:uploads
  // +feature:jobs
  jobQueue: JobQueue;
  jobRegistry: JobRegistry;
  jobDispatcher: JobDispatcher | null;
  // -feature:jobs
  auth: ReturnType<typeof buildBetterAuth>;
  services: AppServices;
  background: {
    // +feature:realtime
    realtimeEventPublisher: RealtimeEventPublisher;
    // -feature:realtime
    // +feature:audit-log
    auditProjector: AuditProjector;
    // -feature:audit-log
  };
}

// +feature:billing
function readBillingConfig(): BillingConfig {
  const providerName = process.env.BILLING_PROVIDER?.trim().toLowerCase();
  const disabled: BillingConfig = {
    enabled: false,
    provider: null,
    // +feature:billing-stripe
    stripe: null,
    // -feature:billing-stripe
  };
  if (!providerName || providerName === "noop" || providerName === "none") {
    return disabled;
  }
  const allowed: BillingProviderKey[] = [
    // +feature:billing-stripe
    "stripe",
    // -feature:billing-stripe
  ];
  if (!allowed.includes(providerName as BillingProviderKey)) {
    throw new Error(
      `BILLING_PROVIDER='${providerName}' is not supported; expected one of ${allowed.join(", ") || "(no providers compiled in)"} or unset`,
    );
  }
  const plans = parseBillingPlansFromEnv();
  const provider = providerName as BillingProviderKey;
  // +feature:billing-stripe
  if (provider === "stripe") {
    const apiKey = process.env.STRIPE_SECRET_KEY?.trim();
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
    if (!apiKey || !webhookSecret) {
      throw new Error(
        "BILLING_PROVIDER=stripe requires STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET",
      );
    }
    return {
      ...disabled,
      enabled: true,
      provider,
      stripe: { apiKey, webhookSecret, plans },
    };
  }
  // -feature:billing-stripe
  return disabled;
}

/**
 * Parse a small JSON array of BillingPlan from `BILLING_PLANS_JSON`.
 * Intentionally not "magic" — tenants that need more than a handful of
 * plans can replace the catalog source (e.g. pull from their own DB)
 * without touching the composition root.
 */
function parseBillingPlansFromEnv(): readonly BillingPlan[] {
  const raw = process.env.BILLING_PLANS_JSON?.trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as readonly BillingPlan[];
    if (!Array.isArray(parsed)) {
      throw new Error("BILLING_PLANS_JSON must be a JSON array of BillingPlan");
    }
    return parsed;
  } catch (err) {
    throw new Error(
      `failed to parse BILLING_PLANS_JSON: ${err instanceof Error ? err.message : err}`,
    );
  }
}
// -feature:billing

// +feature:jobs
function readJobsConfig(): JobsConfig {
  const providerName = process.env.JOBS_PROVIDER?.trim().toLowerCase();
  const disabled: JobsConfig = {
    enabled: false,
    provider: null,
    // +feature:jobs-graphile
    graphile: null,
    // -feature:jobs-graphile
  };
  if (!providerName || providerName === "noop" || providerName === "none") {
    return disabled;
  }
  const allowed: JobsProviderKey[] = [
    // +feature:jobs-graphile
    "graphile",
    // -feature:jobs-graphile
  ];
  if (!allowed.includes(providerName as JobsProviderKey)) {
    throw new Error(
      `JOBS_PROVIDER='${providerName}' is not supported; expected one of ${allowed.join(", ") || "(no providers compiled in)"} or unset`,
    );
  }
  const provider = providerName as JobsProviderKey;
  // +feature:jobs-graphile
  if (provider === "graphile") {
    const connectionString =
      process.env.WORKER_DATABASE_URL?.trim() ||
      process.env.DATABASE_URL?.trim() ||
      "";
    if (!connectionString) {
      throw new Error(
        "JOBS_PROVIDER=graphile requires DATABASE_URL (or WORKER_DATABASE_URL for a direct-connection override)",
      );
    }
    const concurrency = Number(process.env.JOBS_CONCURRENCY ?? 2);
    if (!Number.isFinite(concurrency) || concurrency < 1) {
      throw new Error("JOBS_CONCURRENCY must be a positive integer");
    }
    return {
      ...disabled,
      enabled: true,
      provider,
      graphile: { connectionString, concurrency },
    };
  }
  // -feature:jobs-graphile
  return disabled;
}
// -feature:jobs


function buildDefaultMailer(): Mailer {
  // +feature:email-resend
  return createDefaultMailer();
  // -feature:email-resend
  return new ConsoleMailer();
}

export function readConfig(): AppConfig {
  const authSecret = process.env.BETTER_AUTH_SECRET ?? "";
  if (!authSecret) {
    throw new Error("BETTER_AUTH_SECRET is required");
  }
  // +feature:auth-oauth
  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const appleClientId = process.env.APPLE_CLIENT_ID;
  const appleClientSecret = process.env.APPLE_CLIENT_SECRET;
  const social: NonNullable<AppConfig["social"]> = {};
  if (googleClientId && googleClientSecret) {
    social.google = { clientId: googleClientId, clientSecret: googleClientSecret };
  }
  if (appleClientId && appleClientSecret) {
    social.apple = { clientId: appleClientId, clientSecret: appleClientSecret };
  }
  // -feature:auth-oauth
  return {
    authSecret,
    apiOrigin: process.env.API_ORIGIN ?? "http://localhost:4002",
    // +feature:auth-magic-link
    magicLinkTtlMinutes: Number(process.env.MAGIC_LINK_TTL_MIN ?? 15),
    // -feature:auth-magic-link
    webOrigin: process.env.WEB_ORIGIN ?? "http://localhost:4001",
    wwwOrigin: process.env.WWW_ORIGIN ?? "http://localhost:4000",
    additionalOrigins: (process.env.ADDITIONAL_WEB_ORIGINS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    cookieSecure: (process.env.NODE_ENV ?? "development") === "production",
    cookieDomain: process.env.AUTH_COOKIE_DOMAIN?.trim() || undefined,
    connect: readConnectConfig(),
    // +feature:auth-oauth
    social: Object.keys(social).length > 0 ? social : undefined,
    // -feature:auth-oauth
    // +feature:uploads
    uploads: readUploadsConfig(),
    // -feature:uploads
    // +feature:billing
    billing: readBillingConfig(),
    // -feature:billing
    // +feature:jobs
    jobs: readJobsConfig(),
    // -feature:jobs
  };
}

export function buildContainer(
  config: AppConfig,
  overrides: Partial<Omit<AppContainer, "config">> = {},
): AppContainer {
  // +feature:orm-drizzle
  const drizzle = overrides.drizzle ?? getDrizzle();
  // -feature:orm-drizzle
  const clock = overrides.clock ?? new SystemClock();
  const bus = overrides.bus ?? new InProcessEventBus();
  const buildDefaultUow = (): UnitOfWork => {
    // +feature:orm-drizzle
    return new DrizzleUnitOfWork(drizzle, bus);
    // -feature:orm-drizzle
  };
  const uow = overrides.uow ?? buildDefaultUow();
  const mailer = overrides.mailer ?? buildDefaultMailer();
  // +feature:realtime
  const hub = overrides.hub ?? new InProcessRealtimeHub();
  const presence = overrides.presence ?? new PresenceTracker(hub, clock);
  // -feature:realtime

  // Declared before buildBetterAuth so the closure can capture it.
  // Filled in after `services` is built below.
  const accountHooks: {
    assertUserCanBeDeleted?: (userId: string) => Promise<void>;
  } = {};

  const auth =
    overrides.auth ??
    buildBetterAuth(
      {
        authSecret: config.authSecret,
        apiOrigin: config.apiOrigin,
        webOrigin: config.webOrigin,
        wwwOrigin: config.wwwOrigin,
        additionalOrigins: config.additionalOrigins,
        cookieSecure: config.cookieSecure,
        cookieDomain: config.cookieDomain,
        // +feature:auth-magic-link
        magicLinkTtlMinutes: config.magicLinkTtlMinutes,
        // -feature:auth-magic-link
        // +feature:auth-oauth
        social: config.social,
        // -feature:auth-oauth
        accountHooks,
      },
      {
        uow,
        mailer,
        // +feature:orm-drizzle
        drizzle,
        // -feature:orm-drizzle
      },
    );

  // +feature:uploads
  const fileStorage = overrides.fileStorage ?? buildFileStorage(config, auth);
  // -feature:uploads

  // +feature:jobs
  const jobQueue = overrides.jobQueue ?? buildJobQueue(config.jobs);
  // -feature:jobs

  const core: FeatureCore = {
    config,
    // +feature:orm-drizzle
    drizzle,
    // -feature:orm-drizzle
    clock,
    bus,
    uow,
    mailer,
    // +feature:realtime
    hub,
    presence,
    // -feature:realtime
    // +feature:uploads
    fileStorage,
    // -feature:uploads
    // +feature:jobs
    jobQueue,
    // -feature:jobs
    auth,
  };

  const services: AppServices =
    overrides.services ??
    (() => {
      const identitySvc = identityFeature.services(core);
      const workspacesSvc = workspacesFeature.services(core);
      return {
        ...identitySvc,
        ...workspacesSvc,
        ...connectFeature.services(core),
        // +feature:billing
        ...billingFeature.services(core),
        // -feature:billing
        // +feature:audit-log
        ...auditFeature.services(core),
        // -feature:audit-log
      } satisfies AppServices;
    })();

  accountHooks.assertUserCanBeDeleted = (userId) =>
    services.assertUserCanBeDeleted.execute(userId as UserId);

  const background = overrides.background ?? {
    // +feature:realtime
    realtimeEventPublisher: new RealtimeEventPublisher(bus, hub, uow),
    // -feature:realtime
    // +feature:audit-log
    auditProjector: new AuditProjector(bus, uow),
    // -feature:audit-log
  };

  // +feature:jobs
  // The registry's handlers close over `services`, so it must be built
  // after service wiring above. `buildJobs(...)` is pure — no I/O, no
  // side effects — so this is safe to call inside `buildContainer`.
  const jobPartial = {
    config,
    // +feature:orm-drizzle
    drizzle,
    // -feature:orm-drizzle
    clock,
    bus,
    uow,
    mailer,
    // +feature:realtime
    hub,
    presence,
    // -feature:realtime
    // +feature:uploads
    fileStorage,
    // -feature:uploads
    jobQueue,
    auth,
    services,
    background,
  };
  const jobRegistry = overrides.jobRegistry ?? buildJobs(jobPartial as AppContainer);
  const jobDispatcher =
    overrides.jobDispatcher !== undefined
      ? overrides.jobDispatcher
      : buildJobDispatcher(config.jobs, jobRegistry);
  // -feature:jobs

  return {
    config,
    // +feature:orm-drizzle
    drizzle,
    // -feature:orm-drizzle
    clock,
    bus,
    uow,
    mailer,
    // +feature:realtime
    hub,
    presence,
    // -feature:realtime
    // +feature:uploads
    fileStorage,
    // -feature:uploads
    // +feature:jobs
    jobQueue,
    jobRegistry,
    jobDispatcher,
    // -feature:jobs
    auth,
    services,
    background,
  };
}

/**
 * Subscribe projectors and publishers to the event bus. This is the
 * only place where `buildContainer`'s output becomes "live" — tests
 * that don't need background work can simply skip this call.
 */
export function startBackgroundWork(container: AppContainer): void {
  // +feature:realtime
  container.background.realtimeEventPublisher.start();
  // -feature:realtime
  // +feature:audit-log
  container.background.auditProjector.start();
  // -feature:audit-log
  container.services.connectWebhooks.start();
}
