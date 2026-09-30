/**
 * Translate a committed domain event into zero, one, or two audit
 * entries. This is the single place where the audit log's action
 * taxonomy lives — grep this file to see what is (and isn't) recorded.
 *
 * Two parallel maps:
 *
 *   - `WORKSPACE_MAPPERS` — tenant-scoped ledger entries. The default
 *     home for almost everything that happens inside a workspace.
 *   - `APP_MAPPERS` — global admin-only ledger. The home for app-level
 *     moderation events (bans, role changes).
 *
 * On top of those, `FAN_OUT_TO_APP` forwards every workspace-mapped
 * event to the app ledger as well, with the workspaceId / teamId /
 * actorMemberId tucked into metadata. Result: an app admin sees every
 * workspace's activity in one feed; tenant admins see only their own
 * workspace. Reduces duplication — write one workspace mapper, both
 * surfaces light up.
 *
 * Some team-scoped events (`teams.role.*`, `teams.member.*`) only carry
 * a teamId, not a workspaceId. The audit projector resolves the parent
 * workspaceId via the team repository before calling this mapper and
 * passes it as `ctx.resolvedWorkspaceId`. Without that, those mappers
 * return null.
 *
 * Metadata is passed through `sanitizeMetadata` on the way in — tokens
 * and secrets are redacted, everything else (including email addresses)
 * is kept as-is so the ledger stays useful for customer support.
 */

import type { DomainEvent } from "@/kernel/events.ts";
import {
  WorkspaceCreated,
  WorkspaceDeleted,
  type WorkspaceId,
} from "@/workspaces/domain/workspace.ts";
import {
  WorkspaceMemberJoined,
  WorkspaceMemberLeft,
  WorkspaceMemberRoleChanged,
} from "@/workspaces/domain/workspace-member.ts";
import {
  WorkspaceRoleCreated,
  WorkspaceRoleDeleted,
  WorkspaceRoleUpdated,
} from "@/workspaces/domain/workspace-role.ts";
import {
  InviteAccepted,
  InviteRevoked,
  InviteSent,
} from "@/workspaces/domain/invite.ts";
// +feature:auth-admin
import {
  AppUserBanned,
  AppUserRoleChanged,
  AppUserUnbanned,
} from "@/identity/domain/app-admin-events.ts";
// -feature:auth-admin
import {
  newAppAuditEntry,
  type AppAuditEntry,
  type AppAuditEntryInput,
} from "../domain/app-audit-entry.ts";
import {
  newWorkspaceAuditEntry,
  type WorkspaceAuditEntry,
  type WorkspaceAuditEntryInput,
} from "../domain/workspace-audit-entry.ts";
import { sanitizeMetadata } from "./sanitize-metadata.ts";

export interface MappedAuditEntries {
  readonly app: AppAuditEntry | null;
  readonly workspace: WorkspaceAuditEntry | null;
}

/**
 * Optional projector-supplied context. Used to plug enrichment that
 * isn't on the event itself — currently just the parent workspaceId
 * for team-only events (`teams.role.*`, `teams.member.*`).
 */
export interface AuditMapContext {
  resolvedWorkspaceId?: WorkspaceId | null;
}

type AppInputFactory = (event: DomainEvent) => AppAuditEntryInput | null;
type WorkspaceInputFactory = (
  event: DomainEvent,
  ctx: AuditMapContext,
) => WorkspaceAuditEntryInput | null;

export function mapEventToAudit(
  event: DomainEvent,
  ctx: AuditMapContext = {},
): MappedAuditEntries | null {
  const appFactory = APP_MAPPERS.get(event.type);
  const wsFactory = WORKSPACE_MAPPERS.get(event.type);
  if (!appFactory && !wsFactory) return null;

  const wsInput = wsFactory ? wsFactory(event, ctx) : null;
  let appInput = appFactory ? appFactory(event) : null;

  // Auto-fanout: events listed in FAN_OUT_TO_APP that have a workspace
  // entry but no dedicated app mapper synthesise one from the workspace
  // input. Keeps the app ledger globally complete without forcing every
  // workspace mapper to have a copy-pasted app twin.
  if (!appInput && wsInput && FAN_OUT_TO_APP.has(event.type)) {
    appInput = fanOutToApp(wsInput);
  }

  return {
    app: appInput
      ? newAppAuditEntry({
          ...appInput,
          metadata: sanitizeMetadata(appInput.metadata ?? {}),
        })
      : null,
    workspace: wsInput
      ? newWorkspaceAuditEntry({
          ...wsInput,
          metadata: sanitizeMetadata(wsInput.metadata ?? {}),
        })
      : null,
  };
}

function fanOutToApp(ws: WorkspaceAuditEntryInput): AppAuditEntryInput {
  return {
    actorUserId: ws.actorUserId,
    action: ws.action,
    targetType: ws.targetType,
    targetId: ws.targetId,
    metadata: {
      ...(ws.metadata ?? {}),
      workspaceId: ws.workspaceId,
      actorMemberId: ws.actorMemberId,
    },
    occurredAt: ws.occurredAt,
  };
}

const APP_MAPPERS = new Map<string, AppInputFactory>();
const WORKSPACE_MAPPERS = new Map<string, WorkspaceInputFactory>();

/**
 * Workspace events worth surfacing in the app-admin ledger too. The
 * fan-out is permissive on purpose: app admins want a global feed of
 * "what's happening in tenants right now". If something turns out to
 * be too noisy in practice, drop it from this set.
 */
const FAN_OUT_TO_APP = new Set<string>([
  "workspaces.workspace.created",
  "workspaces.workspace.deleted",
  "workspaces.member.joined",
  "workspaces.member.left",
  "workspaces.member.role_changed",
  "workspaces.role.created",
  "workspaces.role.updated",
  "workspaces.role.deleted",
  "workspaces.invite.sent",
  "workspaces.invite.accepted",
  "workspaces.invite.revoked",
]);

// ────────────────────────────────────────────────────────────────────────────
// Workspace lifecycle
// ────────────────────────────────────────────────────────────────────────────

WORKSPACE_MAPPERS.set("workspaces.workspace.created", (event) => {
  const e = event as WorkspaceCreated;
  return {
    workspaceId: e.workspaceId,
    actorMemberId: null,
    actorUserId: e.ownerId,
    action: "workspace.created",
    targetType: "workspace",
    targetId: e.workspaceId,
    occurredAt: e.occurredAt,
  };
});

WORKSPACE_MAPPERS.set("workspaces.workspace.deleted", (event) => {
  const e = event as WorkspaceDeleted;
  return {
    workspaceId: e.workspaceId,
    actorMemberId: e.deletedByMemberId,
    actorUserId: null,
    action: "workspace.deleted",
    targetType: "workspace",
    targetId: e.workspaceId,
    metadata: { slug: e.slug, name: e.name },
    occurredAt: e.occurredAt,
  };
});

// ────────────────────────────────────────────────────────────────────────────
// Workspace members
// ────────────────────────────────────────────────────────────────────────────

WORKSPACE_MAPPERS.set("workspaces.member.joined", (event) => {
  const e = event as WorkspaceMemberJoined;
  return {
    workspaceId: e.workspaceId,
    actorMemberId: e.memberId,
    actorUserId: e.userId,
    action: "member.joined",
    targetType: "workspaceMember",
    targetId: e.memberId,
    occurredAt: e.occurredAt,
  };
});

WORKSPACE_MAPPERS.set("workspaces.member.left", (event) => {
  const e = event as WorkspaceMemberLeft;
  return {
    workspaceId: e.workspaceId,
    actorMemberId: e.memberId,
    actorUserId: null,
    action: "member.left",
    targetType: "workspaceMember",
    targetId: e.memberId,
    occurredAt: e.occurredAt,
  };
});

WORKSPACE_MAPPERS.set("workspaces.member.role_changed", (event) => {
  const e = event as WorkspaceMemberRoleChanged;
  return {
    workspaceId: e.workspaceId,
    actorMemberId: e.changedByMemberId,
    actorUserId: null,
    action: "member.role_changed",
    targetType: "workspaceMember",
    targetId: e.memberId,
    metadata: {
      previousRoleId: e.previousRoleId,
      newRoleId: e.newRoleId,
    },
    occurredAt: e.occurredAt,
  };
});

// ────────────────────────────────────────────────────────────────────────────
// Workspace roles
// ────────────────────────────────────────────────────────────────────────────

WORKSPACE_MAPPERS.set("workspaces.role.created", (event) => {
  const e = event as WorkspaceRoleCreated;
  return {
    workspaceId: e.workspaceId,
    actorMemberId: e.actorMemberId,
    actorUserId: null,
    action: "role.created",
    targetType: "workspaceRole",
    targetId: e.roleId,
    occurredAt: e.occurredAt,
  };
});

WORKSPACE_MAPPERS.set("workspaces.role.updated", (event) => {
  const e = event as WorkspaceRoleUpdated;
  return {
    workspaceId: e.workspaceId,
    actorMemberId: e.actorMemberId,
    actorUserId: null,
    action: "role.updated",
    targetType: "workspaceRole",
    targetId: e.roleId,
    occurredAt: e.occurredAt,
  };
});

WORKSPACE_MAPPERS.set("workspaces.role.deleted", (event) => {
  const e = event as WorkspaceRoleDeleted;
  return {
    workspaceId: e.workspaceId,
    actorMemberId: e.actorMemberId,
    actorUserId: null,
    action: "role.deleted",
    targetType: "workspaceRole",
    targetId: e.roleId,
    occurredAt: e.occurredAt,
  };
});

// ────────────────────────────────────────────────────────────────────────────
// Workspace invites
// ────────────────────────────────────────────────────────────────────────────

WORKSPACE_MAPPERS.set("workspaces.invite.sent", (event) => {
  const e = event as InviteSent;
  return {
    workspaceId: e.workspaceId,
    actorMemberId: e.actorMemberId,
    actorUserId: null,
    action: "invite.sent",
    targetType: "invite",
    targetId: e.inviteId,
    metadata: { email: e.email },
    occurredAt: e.occurredAt,
  };
});

WORKSPACE_MAPPERS.set("workspaces.invite.accepted", (event) => {
  const e = event as InviteAccepted;
  return {
    workspaceId: e.workspaceId,
    actorMemberId: e.newMemberId,
    actorUserId: null,
    action: "invite.accepted",
    targetType: "invite",
    targetId: e.inviteId,
    metadata: { invitedById: e.invitedById },
    occurredAt: e.occurredAt,
  };
});

WORKSPACE_MAPPERS.set("workspaces.invite.revoked", (event) => {
  const e = event as InviteRevoked;
  return {
    workspaceId: e.workspaceId,
    actorMemberId: e.actorMemberId,
    actorUserId: null,
    action: "invite.revoked",
    targetType: "invite",
    targetId: e.inviteId,
    metadata: { email: e.email },
    occurredAt: e.occurredAt,
  };
});

// ────────────────────────────────────────────────────────────────────────────
// Teams
// ────────────────────────────────────────────────────────────────────────────


// ────────────────────────────────────────────────────────────────────────────
// App-level moderation (auth-admin)
// ────────────────────────────────────────────────────────────────────────────

// +feature:auth-admin
APP_MAPPERS.set("identity.app_user.role_changed", (event) => {
  const e = event as AppUserRoleChanged;
  return {
    actorUserId: e.actorUserId,
    action: "app_user.role_changed",
    targetType: "user",
    targetId: e.targetUserId,
    metadata: {
      previousRole: e.previousRole,
      newRole: e.newRole,
    },
    occurredAt: e.occurredAt,
  };
});

APP_MAPPERS.set("identity.app_user.banned", (event) => {
  const e = event as AppUserBanned;
  return {
    actorUserId: e.actorUserId,
    action: "app_user.banned",
    targetType: "user",
    targetId: e.targetUserId,
    metadata: {
      reason: e.reason,
      expiresAt: e.expiresAt?.toISOString() ?? null,
    },
    occurredAt: e.occurredAt,
  };
});

APP_MAPPERS.set("identity.app_user.unbanned", (event) => {
  const e = event as AppUserUnbanned;
  return {
    actorUserId: e.actorUserId,
    action: "app_user.unbanned",
    targetType: "user",
    targetId: e.targetUserId,
    occurredAt: e.occurredAt,
  };
});
// -feature:auth-admin
