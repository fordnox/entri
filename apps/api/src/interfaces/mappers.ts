import type {
  // +feature:audit-log
  AuditEntryDTO,
  // -feature:audit-log
  // +feature:billing
  BillingCustomerDTO,
  BillingPlanDTO,
  SubscriptionDTO,
  // -feature:billing
  UserDTO,
  // +feature:billing
  WorkspaceBillingDTO,
  // -feature:billing
  WorkspaceDTO,
  WorkspaceInviteDTO,
  WorkspaceMemberDTO,
  WorkspaceRoleDTO,
} from "@orbit/shared/dto";
// +feature:audit-log
import type { AppAuditEntry } from "@/audit/domain/app-audit-entry.ts";
import type { WorkspaceAuditEntry } from "@/audit/domain/workspace-audit-entry.ts";
// -feature:audit-log
// +feature:billing
import type { BillingCustomer } from "@/billing/domain/billing-customer.ts";
import type { BillingPlan } from "@/billing/domain/billing-plan.ts";
import type { Subscription } from "@/billing/domain/subscription.ts";
import type { WorkspaceBillingView } from "@/billing/application/get-workspace-billing.service.ts";
// -feature:billing
import type { User } from "@/identity/domain/user.ts";
import type { WorkspaceInvite } from "@/workspaces/domain/invite.ts";
import type { WorkspaceMember } from "@/workspaces/domain/workspace-member.ts";
import type { WorkspaceRole } from "@/workspaces/domain/workspace-role.ts";
import type { Workspace } from "@/workspaces/domain/workspace.ts";

export function userToDTO(u: User): UserDTO {
  return {
    id: u.id,
    email: u.email.value,
    name: u.name,
    avatarTone: u.avatarTone,
    createdAt: u.createdAt.toISOString(),
    themeMode: u.themeMode,
    themePalette: u.themePalette,
    // +feature:auth-admin
    // Overridden at call sites that read the raw better-auth row (see
    // `auth.controller.ts` for `/v1/me`). Not modelled on the User
    // aggregate, so the DTO-mapper defaults to null.
    role: null,
    impersonatedBy: null,
    // -feature:auth-admin
  };
}

export function workspaceToDTO(w: Workspace): WorkspaceDTO {
  return {
    id: w.id,
    slug: w.slug.value,
    name: w.name,
    ownerId: w.ownerId,
    createdAt: w.createdAt.toISOString(),
  };
}

export function workspaceRoleToDTO(
  r: WorkspaceRole,
  opts?: { memberCount?: number },
): WorkspaceRoleDTO {
  return {
    id: r.id,
    workspaceId: r.workspaceId,
    name: r.name,
    description: r.description,
    isSystem: r.isSystem,
    systemKey: r.systemKey,
    sortOrder: r.sortOrder,
    permissions: [...r.permissions],
    memberCount: opts?.memberCount,
    createdAt: r.createdAt.toISOString(),
  };
}

export function workspaceMemberToDTO(
  m: WorkspaceMember,
  user: { email: string; name: string },
  role: WorkspaceRole,
): WorkspaceMemberDTO {
  return {
    id: m.id,
    workspaceId: m.workspaceId,
    userId: m.userId,
    name: user.name,
    email: user.email,
    role: workspaceRoleToDTO(role),
    tone: m.tone,
    createdAt: m.createdAt.toISOString(),
  };
}

export function workspaceInviteToDTO(
  i: WorkspaceInvite,
  role: WorkspaceRole | null,
): WorkspaceInviteDTO {
  return {
    id: i.id,
    workspaceId: i.workspaceId,
    email: i.email,
    invitedById: i.invitedById,
    role: role ? workspaceRoleToDTO(role) : null,
    createdAt: i.createdAt.toISOString(),
    acceptedAt: i.acceptedAt?.toISOString() ?? null,
    revokedAt: i.revokedAt?.toISOString() ?? null,
  };
}


// +feature:billing
export function billingPlanToDTO(p: BillingPlan): BillingPlanDTO {
  return {
    key: p.key,
    name: p.name,
    description: p.description,
    priceId: p.priceId,
    unitAmount: p.unitAmount,
    currency: p.currency,
    interval: p.interval,
    intervalCount: p.intervalCount,
    features: [...p.features],
  };
}

export function billingCustomerToDTO(c: BillingCustomer): BillingCustomerDTO {
  return {
    id: c.id,
    workspaceId: c.workspaceId,
    provider: c.provider,
    providerCustomerId: c.providerCustomerId,
    createdAt: c.createdAt.toISOString(),
  };
}

export function subscriptionToDTO(s: Subscription): SubscriptionDTO {
  return {
    id: s.id,
    workspaceId: s.workspaceId,
    provider: s.provider,
    providerSubscriptionId: s.providerSubscriptionId,
    status: s.status,
    priceId: s.priceId,
    planKey: s.planKey,
    quantity: s.quantity,
    currentPeriodStart: s.currentPeriodStart.toISOString(),
    currentPeriodEnd: s.currentPeriodEnd.toISOString(),
    cancelAtPeriodEnd: s.cancelAtPeriodEnd,
    canceledAt: s.canceledAt?.toISOString() ?? null,
    trialEndsAt: s.trialEndsAt?.toISOString() ?? null,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

export function workspaceBillingToDTO(view: WorkspaceBillingView): WorkspaceBillingDTO {
  return {
    customer: view.customer ? billingCustomerToDTO(view.customer) : null,
    subscription: view.subscription ? subscriptionToDTO(view.subscription) : null,
    availablePlans: view.availablePlans.map(billingPlanToDTO),
  };
}
// -feature:billing

// +feature:audit-log
export function appAuditEntryToDTO(e: AppAuditEntry): AuditEntryDTO {
  return {
    id: e.id,
    action: e.action,
    actorKind: e.actorKind,
    actorUserId: e.actorUserId,
    actorMemberId: null,
    workspaceId: null,
    targetType: e.targetType,
    targetId: e.targetId,
    metadata: { ...e.metadata },
    occurredAt: e.occurredAt.toISOString(),
    ipAddress: e.ipAddress,
    userAgent: e.userAgent,
  };
}

export function workspaceAuditEntryToDTO(
  e: WorkspaceAuditEntry,
): AuditEntryDTO {
  return {
    id: e.id,
    action: e.action,
    actorKind: e.actorKind,
    actorUserId: e.actorUserId,
    actorMemberId: e.actorMemberId,
    workspaceId: e.workspaceId,
    targetType: e.targetType,
    targetId: e.targetId,
    metadata: { ...e.metadata },
    occurredAt: e.occurredAt.toISOString(),
    ipAddress: null,
    userAgent: null,
  };
}
// -feature:audit-log
