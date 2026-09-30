import { createHash, randomBytes } from "node:crypto";
import type { Clock } from "@/kernel/clock.ts";
import { ValidationError } from "@/kernel/errors.ts";
import { DomainEvent } from "@/kernel/events.ts";
import { type Id, newId } from "@/kernel/id.ts";
import { secureStringEqual } from "@/kernel/secure-string-equal.ts";
import type { WorkspaceMemberId } from "@/workspaces/domain/workspace-member.ts";
import type { WorkspaceId } from "@/workspaces/domain/workspace.ts";

export type ConnectApplicationId = Id<"connectApplication">;

abstract class ApplicationEvent extends DomainEvent {
  actorMemberId: WorkspaceMemberId | null = null;
  constructor(
    readonly workspaceId: WorkspaceId,
    readonly applicationId: ConnectApplicationId,
    occurredAt: Date,
  ) {
    super(occurredAt);
  }
}

export class ConnectApplicationCreated extends ApplicationEvent {
  readonly type = "connect.application.created";
}
export class ConnectApplicationUpdated extends ApplicationEvent {
  readonly type = "connect.application.updated";
}
export class ConnectApplicationSecretRotated extends ApplicationEvent {
  readonly type = "connect.application.secret_rotated";
}
export class ConnectApplicationWebhookSecretRotated extends ApplicationEvent {
  readonly type = "connect.application.webhook_secret_rotated";
}
export class ConnectApplicationDeleted extends ApplicationEvent {
  readonly type = "connect.application.deleted";
}

const MAX_NAME_LEN = 64;
const MAX_URL_LEN = 2048;
const MAX_ORIGINS = 20;

export function hashSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

function generateSecret(): string {
  return `sk_${randomBytes(32).toString("base64url")}`;
}

function generateWebhookSecret(): string {
  return `whsec_${randomBytes(24).toString("base64url")}`;
}

function normalizeName(raw: string): string {
  const name = raw.trim();
  if (!name) throw new ValidationError("application.name_required", "name is required");
  if (name.length > MAX_NAME_LEN) {
    throw new ValidationError("application.name_too_long", "name is too long");
  }
  return name;
}

function normalizeUrl(raw: string | null | undefined, code: string): string | null {
  if (raw == null) return null;
  const value = raw.trim();
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ValidationError(code, `'${value}' is not a valid URL`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new ValidationError(code, "URL must use http or https");
  }
  if (value.length > MAX_URL_LEN) throw new ValidationError(code, "URL is too long");
  return url.toString();
}

function normalizeOrigins(raw: readonly string[] | undefined): string[] {
  if (!raw) return [];
  const out = new Set<string>();
  for (const entry of raw) {
    const value = entry.trim();
    if (!value) continue;
    let origin: string;
    try {
      origin = new URL(value).origin;
    } catch {
      origin = "null";
    }
    if (origin === "null" || !/^https?:/.test(origin)) {
      throw new ValidationError(
        "application.origin_invalid",
        `'${value}' is not a valid origin (expected e.g. https://app.example.com)`,
      );
    }
    out.add(origin);
  }
  if (out.size > MAX_ORIGINS) {
    throw new ValidationError(
      "application.too_many_origins",
      `at most ${MAX_ORIGINS} allowed origins`,
    );
  }
  return [...out];
}

export interface ApplicationSettings {
  name?: string;
  iconUrl?: string | null;
  allowedOrigins?: readonly string[];
  webhookUrl?: string | null;
}

/**
 * An integrator's app. Its id doubles as the public `applicationId` the
 * SDK sends; the secret is only ever held as a SHA-256 hash (it's 256
 * bits of randomness, so a slow KDF buys nothing). `secretVersion` is
 * baked into every SDK token so rotating the secret revokes tokens
 * minted with the old one.
 */
export class ConnectApplication {
  private events: DomainEvent[] = [];

  private constructor(
    readonly id: ConnectApplicationId,
    readonly workspaceId: WorkspaceId,
    private _name: string,
    private _iconUrl: string | null,
    private _secretHash: string,
    private _secretPreview: string,
    private _secretVersion: number,
    private _secretRotatedAt: Date,
    private _allowedOrigins: string[],
    private _webhookUrl: string | null,
    private _webhookSecret: string,
    readonly createdAt: Date,
    private _updatedAt: Date,
  ) {}

  static create(
    input: { workspaceId: WorkspaceId } & ApplicationSettings & { name: string },
    clock: Clock,
  ): { application: ConnectApplication; secret: string } {
    const now = clock.now();
    const secret = generateSecret();
    const app = new ConnectApplication(
      newId("connectApplication"),
      input.workspaceId,
      normalizeName(input.name),
      normalizeUrl(input.iconUrl, "application.icon_url_invalid"),
      hashSecret(secret),
      secret.slice(-4),
      1,
      now,
      normalizeOrigins(input.allowedOrigins),
      normalizeUrl(input.webhookUrl, "application.webhook_url_invalid"),
      generateWebhookSecret(),
      now,
      now,
    );
    app.events.push(new ConnectApplicationCreated(app.workspaceId, app.id, now));
    return { application: app, secret };
  }

  static rehydrate(p: {
    id: ConnectApplicationId;
    workspaceId: WorkspaceId;
    name: string;
    iconUrl: string | null;
    secretHash: string;
    secretPreview: string;
    secretVersion: number;
    secretRotatedAt: Date;
    allowedOrigins: string[];
    webhookUrl: string | null;
    webhookSecret: string;
    createdAt: Date;
    updatedAt: Date;
  }): ConnectApplication {
    return new ConnectApplication(
      p.id,
      p.workspaceId,
      p.name,
      p.iconUrl,
      p.secretHash,
      p.secretPreview,
      p.secretVersion,
      p.secretRotatedAt,
      [...p.allowedOrigins],
      p.webhookUrl,
      p.webhookSecret,
      p.createdAt,
      p.updatedAt,
    );
  }

  get name(): string {
    return this._name;
  }
  get iconUrl(): string | null {
    return this._iconUrl;
  }
  get secretHash(): string {
    return this._secretHash;
  }
  get secretPreview(): string {
    return this._secretPreview;
  }
  get secretVersion(): number {
    return this._secretVersion;
  }
  get secretRotatedAt(): Date {
    return this._secretRotatedAt;
  }
  get allowedOrigins(): readonly string[] {
    return this._allowedOrigins;
  }
  get webhookUrl(): string | null {
    return this._webhookUrl;
  }
  get webhookSecret(): string {
    return this._webhookSecret;
  }
  get updatedAt(): Date {
    return this._updatedAt;
  }

  verifySecret(candidate: string): boolean {
    return secureStringEqual(hashSecret(candidate), this._secretHash);
  }

  /** An empty allow-list means any origin; server-to-server calls send none. */
  allowsOrigin(origin: string | null | undefined): boolean {
    if (!origin || this._allowedOrigins.length === 0) return true;
    return this._allowedOrigins.includes(origin);
  }

  update(settings: ApplicationSettings, clock: Clock): void {
    let changed = false;
    if (settings.name !== undefined) {
      const name = normalizeName(settings.name);
      changed ||= name !== this._name;
      this._name = name;
    }
    if (settings.iconUrl !== undefined) {
      const iconUrl = normalizeUrl(settings.iconUrl, "application.icon_url_invalid");
      changed ||= iconUrl !== this._iconUrl;
      this._iconUrl = iconUrl;
    }
    if (settings.allowedOrigins !== undefined) {
      const origins = normalizeOrigins(settings.allowedOrigins);
      changed ||= origins.join(",") !== this._allowedOrigins.join(",");
      this._allowedOrigins = origins;
    }
    if (settings.webhookUrl !== undefined) {
      const webhookUrl = normalizeUrl(settings.webhookUrl, "application.webhook_url_invalid");
      changed ||= webhookUrl !== this._webhookUrl;
      this._webhookUrl = webhookUrl;
    }
    if (!changed) return;
    this._updatedAt = clock.now();
    this.events.push(new ConnectApplicationUpdated(this.workspaceId, this.id, this._updatedAt));
  }

  rotateSecret(clock: Clock): string {
    const secret = generateSecret();
    const now = clock.now();
    this._secretHash = hashSecret(secret);
    this._secretPreview = secret.slice(-4);
    this._secretVersion += 1;
    this._secretRotatedAt = now;
    this._updatedAt = now;
    this.events.push(new ConnectApplicationSecretRotated(this.workspaceId, this.id, now));
    return secret;
  }

  rotateWebhookSecret(clock: Clock): void {
    this._webhookSecret = generateWebhookSecret();
    this._updatedAt = clock.now();
    this.events.push(
      new ConnectApplicationWebhookSecretRotated(this.workspaceId, this.id, this._updatedAt),
    );
  }

  markDeleted(clock: Clock): void {
    this.events.push(new ConnectApplicationDeleted(this.workspaceId, this.id, clock.now()));
  }

  pullEvents(): DomainEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }
}
