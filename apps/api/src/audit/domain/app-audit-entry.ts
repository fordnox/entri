import { type Id, newId } from "@/kernel/id.ts";
import type { UserId } from "@/identity/domain/user.ts";
import type { AuditActorKind, AuditEntry, AuditFilter } from "./audit-entry.ts";

export type AppAuditEntryId = Id<"appAuditEntry">;

export interface AppAuditEntry extends AuditEntry {
  readonly id: AppAuditEntryId;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
}

export interface AppAuditFilter extends AuditFilter {}

export interface AppAuditEntryInput {
  actorUserId: UserId | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Readonly<Record<string, unknown>>;
  ipAddress?: string | null;
  userAgent?: string | null;
  occurredAt: Date;
}

export function newAppAuditEntry(input: AppAuditEntryInput): AppAuditEntry {
  const actorKind: AuditActorKind = input.actorUserId ? "user" : "system";
  return {
    id: newId("appAuditEntry"),
    actorKind,
    actorUserId: input.actorUserId,
    action: input.action,
    targetType: input.targetType ?? null,
    targetId: input.targetId ?? null,
    metadata: input.metadata ?? {},
    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent ?? null,
    occurredAt: input.occurredAt,
  };
}
