import type { Id } from "./ids.ts";
import type { OrbitThemeMode, OrbitThemePalette } from "./themes.ts";
import type {
  Permission,
  WorkspacePermission,
  WorkspaceRoleSystemKey,
} from "./permissions.ts";

export type UserId = Id<"user">;
export type WorkspaceId = Id<"workspace">;
export type WorkspaceMemberId = Id<"workspaceMember">;
export type WorkspaceInviteId = Id<"workspaceInvite">;
export type WorkspaceRoleId = Id<"workspaceRole">;
// +feature:billing
export type BillingCustomerId = Id<"billingCustomer">;
export type SubscriptionId = Id<"subscription">;
// -feature:billing

/** Back-compat alias for the stable key union on the three seeded
 * workspace roles. Custom roles carry `systemKey === null`. */
export type WorkspaceRole = WorkspaceRoleSystemKey;

export interface UserDTO {
  id: UserId;
  email: string;
  name: string;
  avatarTone: number;
  createdAt: string;
  themeMode: OrbitThemeMode | null;
  themePalette: OrbitThemePalette | null;
  // +feature:auth-admin
  role: "admin" | "user" | null;
  impersonatedBy: string | null;
  // -feature:auth-admin
}

export interface WorkspaceDTO {
  id: WorkspaceId;
  slug: string;
  name: string;
  ownerId: UserId;
  createdAt: string;
}

export interface WorkspaceRoleDTO {
  id: WorkspaceRoleId;
  workspaceId: WorkspaceId;
  name: string;
  description: string | null;
  /** True for the three seeded roles (OWNER/ADMIN/MEMBER). */
  isSystem: boolean;
  /** Non-null only on system roles; stable identifier the server keys on. */
  systemKey: WorkspaceRoleSystemKey | null;
  sortOrder: number;
  permissions: WorkspacePermission[];
  /** Number of members currently assigned. Sent with list/snapshot responses. */
  memberCount?: number;
  createdAt: string;
}

export interface WorkspaceMemberDTO {
  id: WorkspaceMemberId;
  workspaceId: WorkspaceId;
  userId: UserId;
  name: string;
  email: string;
  role: WorkspaceRoleDTO;
  tone: number;
  createdAt: string;
}

export interface WorkspaceInviteDTO {
  id: WorkspaceInviteId;
  workspaceId: WorkspaceId;
  email: string;
  invitedById: WorkspaceMemberId;
  /** Role assigned on accept, or null to fall back to MEMBER at accept time. */
  role: WorkspaceRoleDTO | null;
  createdAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
}


// +feature:billing
/**
 * Names of the billing-provider adapters recognised by the starter kit's
 * web UI for provider-specific copy (e.g. "Manage in Stripe portal").
 * Deliberately intersected with `string` so custom providers added
 * downstream still satisfy the DTO without patching this type.
 */
export type BillingProviderKeyDTO =
  | "stripe"
  | "polar"
  | "dodo"
  | (string & {});

export type SubscriptionStatusDTO =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "incomplete"
  | "incomplete_expired"
  | "paused";

export interface SubscriptionDTO {
  id: SubscriptionId;
  workspaceId: WorkspaceId;
  provider: string;
  providerSubscriptionId: string;
  status: SubscriptionStatusDTO;
  priceId: string;
  planKey: string | null;
  quantity: number;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
  trialEndsAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BillingCustomerDTO {
  id: BillingCustomerId;
  workspaceId: WorkspaceId;
  provider: string;
  providerCustomerId: string;
  createdAt: string;
}

export interface WorkspaceBillingDTO {
  customer: BillingCustomerDTO | null;
  subscription: SubscriptionDTO | null;
  /** Checkout-ready catalog of price IDs the web client can render. */
  availablePlans: BillingPlanDTO[];
}

export interface BillingPlanDTO {
  key: string;
  name: string;
  description: string | null;
  priceId: string;
  /** Cents. Keep the UI free of currency-conversion logic. */
  unitAmount: number;
  currency: string;
  interval: "day" | "week" | "month" | "year";
  intervalCount: number;
  features: string[];
}
// -feature:billing


export interface SubmitOnboardingIntentInput {
  ownerName: string;
  workspaceName: string;
  workspaceSlug: string;
  invitedEmails: string[];
}

export interface OnboardingIntentStatus {
  submitted: boolean;
}

/**
 * Public runtime config served by `GET /v1/config`. Read unauthenticated
 * so pre-login pages (request-access, login) can branch on the same
 * flags as the authenticated app. Never include secrets or per-user
 * data here.
 */
export interface RuntimeConfigDTO {
  // +feature:billing
  billing: {
    /** True when at least one billing provider adapter is wired. */
    enabled: boolean;
    /**
     * Provider key for the wired adapter. Null when disabled. Typed as
     * a union of the built-in providers so the web UI can render
     * provider-specific copy (e.g. "Manage in Stripe portal"), but it's
     * still a `string` at the wire level so custom providers added
     * downstream don't break the DTO.
     */
    provider: BillingProviderKeyDTO | null;
  };
  // -feature:billing
}

/** Helper alias used by shared code that wants a permission in either scope. */
export type AnyPermission = Permission;

// +feature:audit-log
export type AuditActorKindDTO = "user" | "system";

export type AppAuditEntryId = Id<"appAuditEntry">;
export type WorkspaceAuditEntryId = Id<"workspaceAuditEntry">;

/**
 * One row of an audit ledger. Scope is inferred from the presence of
 * `workspaceId`: app-scope rows omit it. `teamId` further narrows the
 * workspace scope when teams is on.
 */
export interface AuditEntryDTO {
  id: AppAuditEntryId | WorkspaceAuditEntryId;
  action: string;
  actorKind: AuditActorKindDTO;
  actorUserId: UserId | null;
  actorMemberId: WorkspaceMemberId | null;
  workspaceId: WorkspaceId | null;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, unknown>;
  occurredAt: string;
  /** Only populated on app-scope entries. */
  ipAddress: string | null;
  userAgent: string | null;
}

export interface AuditPageDTO {
  items: AuditEntryDTO[];
  nextCursor: string | null;
}
// -feature:audit-log
