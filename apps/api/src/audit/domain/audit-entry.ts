/**
 * Audit-log bounded context.
 *
 * Two flavours sit behind one shared interface:
 *
 *  - `AppAuditEntry` — global ledger, read by `user.role === "admin"`
 *    only. Captures moderation-class actions (bans, impersonations,
 *    cross-tenant admin operations).
 *  - `WorkspaceAuditEntry` — tenant ledger, read by members with
 *    `workspace.audit_log.view` (or, if narrowed by `teamId`, by
 *    members with `team.audit_log.view`). Captures lifecycle of a
 *    workspace's own aggregates — members, roles, teams, billing.
 *
 * Entries are materialised by a post-commit projector subscribed to
 * the domain event bus; services do not write audit rows directly.
 */

import type { UserId } from "@/identity/domain/user.ts";

export type AuditActorKind = "user" | "system";

export interface AuditEntry {
  readonly id: string;
  readonly action: string;
  readonly actorKind: AuditActorKind;
  readonly actorUserId: UserId | null;
  readonly targetType: string | null;
  readonly targetId: string | null;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly occurredAt: Date;
}

export interface AuditFilter {
  actorUserId?: UserId;
  action?: string | readonly string[];
  /**
   * Free-text search. Case-insensitive substring match on `action`. Use
   * for "show me everything role-related" (q=`role.`) or to find a
   * specific noun (q=`invite`). Combined with `action` (exact match) via
   * AND.
   */
  q?: string;
  from?: Date;
  to?: Date;
  /** Opaque cursor returned by a previous page; forward-only. */
  cursor?: string;
  /** Page size. Clamped by the repository to a sane maximum. */
  limit?: number;
}

export interface AuditPage<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
}
