import type {
  DnsRecordStatus,
  DomainConnectionStatus,
  SetupMethod,
} from "@orbit/shared/connect";
import type { Clock } from "@/kernel/clock.ts";
import { ConflictError, ValidationError } from "@/kernel/errors.ts";
import { DomainEvent } from "@/kernel/events.ts";
import { type Id, newId } from "@/kernel/id.ts";
import type { WorkspaceId } from "@/workspaces/domain/workspace.ts";
import type { ConnectApplicationId } from "./application.ts";
import type { ParsedDomain, ResolvedRecord } from "./dns-records.ts";

export type DomainConnectionId = Id<"domainConnection">;

abstract class ConnectionEvent extends DomainEvent {
  constructor(
    readonly workspaceId: WorkspaceId,
    readonly applicationId: ConnectApplicationId,
    readonly connectionId: DomainConnectionId,
    occurredAt: Date,
  ) {
    super(occurredAt);
  }
}

export class DomainConnectionCreated extends ConnectionEvent {
  readonly type = "connect.domain.created";
}
/** Every record observed on public resolvers for the first time (or again after a downgrade). */
export class DomainConnected extends ConnectionEvent {
  readonly type = "connect.domain.connected";
}
export class DomainSetupFailed extends ConnectionEvent {
  readonly type = "connect.domain.setup_failed";
}
export class DomainDisconnected extends ConnectionEvent {
  readonly type = "connect.domain.disconnected";
  constructor(
    workspaceId: WorkspaceId,
    applicationId: ConnectApplicationId,
    connectionId: DomainConnectionId,
    occurredAt: Date,
    /** Serialized at delete time — the row is gone by the time webhooks run. */
    readonly snapshot: DomainConnectionSnapshot,
  ) {
    super(workspaceId, applicationId, connectionId, occurredAt);
  }
}

const MAX_USER_ID_LEN = 256;
const MAX_METADATA_BYTES = 2048;
const MAX_ERROR_LEN = 500;

export interface RecordObservation {
  observed: string[];
  matches: boolean;
}

export interface DomainConnectionSnapshot {
  id: DomainConnectionId;
  applicationId: ConnectApplicationId;
  workspaceId: WorkspaceId;
  domain: string;
  rootDomain: string;
  subdomain: string | null;
  userId: string | null;
  metadata: Record<string, unknown> | null;
  providerKey: string | null;
  setupMethod: SetupMethod | null;
  status: DomainConnectionStatus;
  records: ResolvedRecord[];
  lastError: string | null;
  lastCheckedAt: Date | null;
  connectedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

function normalizeUserId(raw: string | undefined | null): string | null {
  if (raw == null) return null;
  const value = String(raw).trim();
  if (!value) return null;
  if (value.length > MAX_USER_ID_LEN) {
    throw new ValidationError("user_id.too_long", "userId is too long");
  }
  return value;
}

function normalizeMetadata(
  raw: Record<string, unknown> | undefined | null,
): Record<string, unknown> | null {
  if (raw == null) return null;
  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw new ValidationError("metadata.invalid", "metadata must be a JSON object");
  }
  const json = JSON.stringify(raw);
  if (Buffer.byteLength(json) > MAX_METADATA_BYTES) {
    throw new ValidationError("metadata.too_large", "metadata must be at most 2 KB");
  }
  return JSON.parse(json) as Record<string, unknown>;
}

/**
 * One end user's attempt to point a domain at the integrator's platform.
 *
 *   pending ──automate ok / manual──▶ propagating ──all verified──▶ connected
 *      │  └──automate rejected──▶ failed ──retry / manual──▶ propagating
 *      └──────────────all verified (records already existed)─────────▲
 *
 * A re-verify that no longer sees every record downgrades `connected`
 * back to `propagating`; seeing them all again re-emits DomainConnected.
 */
export class DomainConnection {
  private events: DomainEvent[] = [];

  private constructor(private s: DomainConnectionSnapshot) {}

  static create(
    input: {
      applicationId: ConnectApplicationId;
      workspaceId: WorkspaceId;
      domain: ParsedDomain;
      records: ResolvedRecord[];
      providerKey: string | null;
      userId?: string | null;
      metadata?: Record<string, unknown> | null;
    },
    clock: Clock,
  ): DomainConnection {
    const now = clock.now();
    const conn = new DomainConnection({
      id: newId("domainConnection"),
      applicationId: input.applicationId,
      workspaceId: input.workspaceId,
      domain: input.domain.domain,
      rootDomain: input.domain.rootDomain,
      subdomain: input.domain.subdomain,
      userId: normalizeUserId(input.userId),
      metadata: normalizeMetadata(input.metadata),
      providerKey: input.providerKey,
      setupMethod: null,
      status: "pending",
      records: input.records.map((r) => ({ ...r, observed: [...r.observed] })),
      lastError: null,
      lastCheckedAt: null,
      connectedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    conn.emit(DomainConnectionCreated, now);
    return conn;
  }

  static rehydrate(snapshot: DomainConnectionSnapshot): DomainConnection {
    return new DomainConnection({
      ...snapshot,
      records: snapshot.records.map((r) => ({ ...r, observed: [...r.observed] })),
    });
  }

  get id(): DomainConnectionId {
    return this.s.id;
  }
  get applicationId(): ConnectApplicationId {
    return this.s.applicationId;
  }
  get workspaceId(): WorkspaceId {
    return this.s.workspaceId;
  }
  get rootDomain(): string {
    return this.s.rootDomain;
  }
  get providerKey(): string | null {
    return this.s.providerKey;
  }
  get status(): DomainConnectionStatus {
    return this.s.status;
  }
  get records(): readonly ResolvedRecord[] {
    return this.s.records;
  }

  snapshot(): DomainConnectionSnapshot {
    return {
      ...this.s,
      records: this.s.records.map((r) => ({ ...r, observed: [...r.observed] })),
    };
  }

  /** Provider API accepted every record. */
  markAutomaticSetupSucceeded(clock: Clock): void {
    this.assertNotConnected();
    this.s.setupMethod = "automatic";
    this.s.status = "propagating";
    this.s.lastError = null;
    this.setAwaitingRecords();
    this.touch(clock);
  }

  markAutomaticSetupFailed(reason: string, clock: Clock): void {
    this.assertNotConnected();
    this.s.setupMethod = "automatic";
    this.s.status = "failed";
    this.s.lastError = reason.slice(0, MAX_ERROR_LEN);
    const now = this.touch(clock);
    this.emit(DomainSetupFailed, now);
  }

  /** End user says they added the records by hand. */
  markManualSetup(clock: Clock): void {
    this.assertNotConnected();
    this.s.setupMethod = "manual";
    this.s.status = "propagating";
    this.s.lastError = null;
    this.setAwaitingRecords();
    this.touch(clock);
  }

  /** `observations[i]` is the live DNS state of `records[i]`. */
  applyVerification(observations: readonly RecordObservation[], clock: Clock): void {
    if (observations.length !== this.s.records.length) {
      throw new Error("applyVerification: observation count mismatch");
    }
    const awaiting = this.s.status === "propagating" || this.s.status === "connected";
    this.s.records = this.s.records.map((r, i) => {
      const o = observations[i]!;
      let status: DnsRecordStatus;
      if (o.matches) status = "verified";
      else if (o.observed.length > 0) status = "mismatch";
      else status = awaiting ? "propagating" : "pending";
      return { ...r, status, observed: [...o.observed] };
    });
    const now = clock.now();
    this.s.lastCheckedAt = now;
    const allVerified = this.s.records.every((r) => r.status === "verified");
    if (allVerified && this.s.status !== "connected") {
      this.s.status = "connected";
      this.s.connectedAt = now;
      this.s.lastError = null;
      this.s.updatedAt = now;
      this.emit(DomainConnected, now);
    } else if (!allVerified && this.s.status === "connected") {
      this.s.status = "propagating";
      this.s.updatedAt = now;
    }
  }

  markDeleted(clock: Clock): void {
    const now = clock.now();
    this.events.push(
      new DomainDisconnected(
        this.s.workspaceId,
        this.s.applicationId,
        this.s.id,
        now,
        this.snapshot(),
      ),
    );
  }

  pullEvents(): DomainEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  private assertNotConnected(): void {
    if (this.s.status === "connected") {
      throw new ConflictError("connection.already_connected", "this domain is already connected");
    }
  }

  private setAwaitingRecords(): void {
    this.s.records = this.s.records.map((r) =>
      r.status === "pending" ? { ...r, status: "propagating" } : r,
    );
  }

  private touch(clock: Clock): Date {
    this.s.updatedAt = clock.now();
    return this.s.updatedAt;
  }

  private emit(
    Ctor: new (
      w: WorkspaceId,
      a: ConnectApplicationId,
      c: DomainConnectionId,
      at: Date,
    ) => ConnectionEvent,
    at: Date,
  ): void {
    this.events.push(new Ctor(this.s.workspaceId, this.s.applicationId, this.s.id, at));
  }
}
