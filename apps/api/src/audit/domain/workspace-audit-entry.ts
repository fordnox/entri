import { type Id, newId } from "@/kernel/id.ts";
import type { UserId } from "@/identity/domain/user.ts";
import type { WorkspaceMemberId } from "@/workspaces/domain/workspace-member.ts";
import type { WorkspaceId } from "@/workspaces/domain/workspace.ts";
import type { AuditActorKind, AuditEntry, AuditFilter } from "./audit-entry.ts";

export type WorkspaceAuditEntryId = Id<"workspaceAuditEntry">;

export interface WorkspaceAuditEntry extends AuditEntry {
  readonly id: WorkspaceAuditEntryId;
  readonly workspaceId: WorkspaceId;
  readonly actorMemberId: WorkspaceMemberId | null;
}

/**
 * Filter for the workspace audit log. `workspaceId` is required so a
 * member can never accidentally page another tenant's rows. `teamId`
 * is tri-state: omit to include every entry, pass an id to scope to a
 * single team, pass "workspace-only" to exclude team-scoped rows from
 * the workspace-wide view.
 */
export interface WorkspaceAuditFilter extends AuditFilter {
  workspaceId: WorkspaceId;
}

export interface WorkspaceAuditEntryInput {
  workspaceId: WorkspaceId;
  actorMemberId: WorkspaceMemberId | null;
  actorUserId: UserId | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Readonly<Record<string, unknown>>;
  occurredAt: Date;
}

export function newWorkspaceAuditEntry(
  input: WorkspaceAuditEntryInput,
): WorkspaceAuditEntry {
  const actorKind: AuditActorKind =
    input.actorMemberId || input.actorUserId ? "user" : "system";
  return {
    id: newId("workspaceAuditEntry"),
    workspaceId: input.workspaceId,
    actorMemberId: input.actorMemberId,
    actorKind,
    actorUserId: input.actorUserId,
    action: input.action,
    targetType: input.targetType ?? null,
    targetId: input.targetId ?? null,
    metadata: input.metadata ?? {},
    occurredAt: input.occurredAt,
  };
}
