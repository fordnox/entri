import {
  boolean,
  index,
  integer,
  json,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Drizzle schema for the Orbit API database.
 *
 * This file is the source of truth for the database. After editing it,
 * run `npm run drizzle:generate` to emit a SQL migration into
 * `apps/api/drizzle/migrations/`, then `npm run drizzle:migrate` to
 * apply it. Feature-gated columns and tables live under
 * `+feature:xxx` fences the strip engine removes when the feature is
 * off.
 */

// ── Identity ────────────────────────────────────────────────────────────

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull().unique(),
    name: text("name").notNull(),
    emailVerified: boolean("emailVerified").notNull().default(false),
    image: text("image"),
    avatarTone: integer("avatarTone").notNull().default(0),
    themeMode: text("themeMode"),
    themePalette: text("themePalette"),
    createdAt: timestamp("createdAt", { mode: "date", precision: 3 })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updatedAt", { mode: "date", precision: 3 }).notNull(),
    // +feature:auth-admin
    role: text("role"),
    banned: boolean("banned").notNull().default(false),
    banReason: text("banReason"),
    banExpires: timestamp("banExpires", { mode: "date", precision: 3 }),
    // -feature:auth-admin
  },
  (t) => [
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expiresAt", { mode: "date", precision: 3 }).notNull(),
    ipAddress: text("ipAddress"),
    userAgent: text("userAgent"),
    createdAt: timestamp("createdAt", { mode: "date", precision: 3 })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updatedAt", { mode: "date", precision: 3 }).notNull(),
    // +feature:auth-admin
    impersonatedBy: text("impersonatedBy"),
    // -feature:auth-admin
  },
  (t) => [index("sessions_userId_idx").on(t.userId)],
);

export const accounts = pgTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: text("accountId").notNull(),
    providerId: text("providerId").notNull(),
    accessToken: text("accessToken"),
    refreshToken: text("refreshToken"),
    accessTokenExpiresAt: timestamp("accessTokenExpiresAt", {
      mode: "date",
      precision: 3,
    }),
    refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt", {
      mode: "date",
      precision: 3,
    }),
    scope: text("scope"),
    idToken: text("idToken"),
    password: text("password"),
    createdAt: timestamp("createdAt", { mode: "date", precision: 3 })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updatedAt", { mode: "date", precision: 3 }).notNull(),
  },
  (t) => [index("accounts_userId_idx").on(t.userId)],
);

export const verifications = pgTable(
  "verifications",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expiresAt", { mode: "date", precision: 3 }).notNull(),
    createdAt: timestamp("createdAt", { mode: "date", precision: 3 })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updatedAt", { mode: "date", precision: 3 }).notNull(),
  },
  (t) => [
    uniqueIndex("verifications_identifier_key").on(t.identifier),
    index("verifications_expiresAt_idx").on(t.expiresAt),
  ],
);

// ── Workspace + PBAC ────────────────────────────────────────────────────

export const workspaces = pgTable(
  "workspaces",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    ownerId: text("ownerId")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("createdAt", { mode: "date", precision: 3 })
      .notNull()
      .defaultNow(),
  },
  (t) => [
  ],
);

export const workspaceRoles = pgTable(
  "workspace_roles",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspaceId")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    isSystem: boolean("isSystem").notNull().default(false),
    systemKey: text("systemKey"),
    sortOrder: integer("sortOrder").notNull().default(0),
    createdAt: timestamp("createdAt", { mode: "date", precision: 3 })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updatedAt", { mode: "date", precision: 3 }).notNull(),
  },
  (t) => [
    uniqueIndex("workspace_roles_workspaceId_name_key").on(
      t.workspaceId,
      t.name,
    ),
    uniqueIndex("workspace_roles_workspaceId_systemKey_key").on(
      t.workspaceId,
      t.systemKey,
    ),
    index("workspace_roles_workspaceId_sortOrder_idx").on(
      t.workspaceId,
      t.sortOrder,
    ),
  ],
);

export const workspaceRolePermissions = pgTable(
  "workspace_role_permissions",
  {
    roleId: text("roleId")
      .notNull()
      .references(() => workspaceRoles.id, { onDelete: "cascade" }),
    permission: text("permission").notNull(),
  },
  (t) => [primaryKey({ columns: [t.roleId, t.permission] })],
);

export const workspaceMembers = pgTable(
  "workspace_members",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspaceId")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleId: text("roleId")
      .notNull()
      .references(() => workspaceRoles.id, { onDelete: "restrict" }),
    tone: integer("tone").notNull().default(0),
    createdAt: timestamp("createdAt", { mode: "date", precision: 3 })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("workspace_members_workspaceId_userId_key").on(
      t.workspaceId,
      t.userId,
    ),
    index("workspace_members_workspaceId_idx").on(t.workspaceId),
    index("workspace_members_roleId_idx").on(t.roleId),
  ],
);

export const workspaceInvites = pgTable(
  "workspace_invites",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspaceId")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    token: text("token").notNull().unique(),
    invitedById: text("invitedById")
      .notNull()
      .references(() => workspaceMembers.id, { onDelete: "cascade" }),
    roleId: text("roleId").references(() => workspaceRoles.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("createdAt", { mode: "date", precision: 3 })
      .notNull()
      .defaultNow(),
    acceptedAt: timestamp("acceptedAt", { mode: "date", precision: 3 }),
    revokedAt: timestamp("revokedAt", { mode: "date", precision: 3 }),
  },
  (t) => [
    index("workspace_invites_workspaceId_idx").on(t.workspaceId),
    index("workspace_invites_email_idx").on(t.email),
  ],
);

// ── Teams ───────────────────────────────────────────────────────────────


// ── Billing ─────────────────────────────────────────────────────────────

// +feature:billing
export const billingCustomers = pgTable(
  "billing_customers",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspaceId")
      .notNull()
      .unique()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    providerCustomerId: text("providerCustomerId").notNull(),
    createdAt: timestamp("createdAt", { mode: "date", precision: 3 })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updatedAt", { mode: "date", precision: 3 }).notNull(),
  },
  (t) => [
    uniqueIndex("billing_customers_provider_providerCustomerId_key").on(
      t.provider,
      t.providerCustomerId,
    ),
  ],
);

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspaceId")
      .notNull()
      .unique()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    billingCustomerId: text("billingCustomerId")
      .notNull()
      .references(() => billingCustomers.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    providerSubscriptionId: text("providerSubscriptionId").notNull().unique(),
    status: text("status").notNull(),
    priceId: text("priceId").notNull(),
    planKey: text("planKey"),
    quantity: integer("quantity").notNull().default(1),
    currentPeriodStart: timestamp("currentPeriodStart", {
      mode: "date",
      precision: 3,
    }).notNull(),
    currentPeriodEnd: timestamp("currentPeriodEnd", {
      mode: "date",
      precision: 3,
    }).notNull(),
    cancelAtPeriodEnd: boolean("cancelAtPeriodEnd").notNull().default(false),
    canceledAt: timestamp("canceledAt", { mode: "date", precision: 3 }),
    trialEndsAt: timestamp("trialEndsAt", { mode: "date", precision: 3 }),
    createdAt: timestamp("createdAt", { mode: "date", precision: 3 })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updatedAt", { mode: "date", precision: 3 }).notNull(),
  },
  (t) => [
    index("subscriptions_billingCustomerId_idx").on(t.billingCustomerId),
    index("subscriptions_status_idx").on(t.status),
  ],
);

export const billingEvents = pgTable(
  "billing_events",
  {
    id: text("id").primaryKey(),
    provider: text("provider").notNull(),
    providerEventId: text("providerEventId").notNull(),
    type: text("type").notNull(),
    workspaceId: text("workspaceId"),
    payload: json("payload").notNull(),
    processedAt: timestamp("processedAt", { mode: "date", precision: 3 })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("billing_events_provider_providerEventId_key").on(
      t.provider,
      t.providerEventId,
    ),
    index("billing_events_workspaceId_processedAt_idx").on(
      t.workspaceId,
      t.processedAt,
    ),
  ],
);
// -feature:billing

// ── Waitlist ────────────────────────────────────────────────────────────


// ── Audit log ───────────────────────────────────────────────────────────

// +feature:audit-log
export const appAuditEntries = pgTable(
  "app_audit_entries",
  {
    id: text("id").primaryKey(),
    actorUserId: text("actorUserId").references(() => users.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    targetType: text("targetType"),
    targetId: text("targetId"),
    metadata: json("metadata").notNull(),
    ipAddress: text("ipAddress"),
    userAgent: text("userAgent"),
    occurredAt: timestamp("occurredAt", { mode: "date", precision: 3 }).notNull(),
  },
  (t) => [
    index("app_audit_entries_occurredAt_idx").on(t.occurredAt),
    index("app_audit_entries_actorUserId_occurredAt_idx").on(
      t.actorUserId,
      t.occurredAt,
    ),
    index("app_audit_entries_action_occurredAt_idx").on(
      t.action,
      t.occurredAt,
    ),
  ],
);

export const workspaceAuditEntries = pgTable(
  "workspace_audit_entries",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspaceId")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    teamId: text("teamId"),
    actorMemberId: text("actorMemberId").references(
      () => workspaceMembers.id,
      { onDelete: "set null" },
    ),
    actorUserId: text("actorUserId").references(() => users.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    targetType: text("targetType"),
    targetId: text("targetId"),
    metadata: json("metadata").notNull(),
    occurredAt: timestamp("occurredAt", { mode: "date", precision: 3 }).notNull(),
  },
  (t) => [
    index("workspace_audit_entries_workspaceId_occurredAt_idx").on(
      t.workspaceId,
      t.occurredAt,
    ),
    index("workspace_audit_entries_workspaceId_teamId_occurredAt_idx").on(
      t.workspaceId,
      t.teamId,
      t.occurredAt,
    ),
    index("workspace_audit_entries_workspaceId_action_occurredAt_idx").on(
      t.workspaceId,
      t.action,
      t.occurredAt,
    ),
  ],
);
// -feature:audit-log

// ── Connect ─────────────────────────────────────────────────────────────

export const connectApplications = pgTable(
  "connect_applications",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspaceId")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    iconUrl: text("iconUrl"),
    secretHash: text("secretHash").notNull(),
    secretPreview: text("secretPreview").notNull(),
    secretVersion: integer("secretVersion").notNull().default(1),
    secretRotatedAt: timestamp("secretRotatedAt", { mode: "date", precision: 3 }).notNull(),
    allowedOrigins: json("allowedOrigins").$type<string[]>().notNull(),
    webhookUrl: text("webhookUrl"),
    webhookSecret: text("webhookSecret").notNull(),
    createdAt: timestamp("createdAt", { mode: "date", precision: 3 }).notNull(),
    updatedAt: timestamp("updatedAt", { mode: "date", precision: 3 }).notNull(),
  },
  (t) => [index("connect_applications_workspaceId_idx").on(t.workspaceId)],
);

export const domainConnections = pgTable(
  "domain_connections",
  {
    id: text("id").primaryKey(),
    applicationId: text("applicationId")
      .notNull()
      .references(() => connectApplications.id, { onDelete: "cascade" }),
    workspaceId: text("workspaceId")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    domain: text("domain").notNull(),
    rootDomain: text("rootDomain").notNull(),
    subdomain: text("subdomain"),
    userId: text("userId"),
    metadata: json("metadata").$type<Record<string, unknown> | null>(),
    providerKey: text("providerKey"),
    setupMethod: text("setupMethod"),
    status: text("status").notNull(),
    records: json("records").notNull(),
    lastError: text("lastError"),
    lastCheckedAt: timestamp("lastCheckedAt", { mode: "date", precision: 3 }),
    connectedAt: timestamp("connectedAt", { mode: "date", precision: 3 }),
    createdAt: timestamp("createdAt", { mode: "date", precision: 3 }).notNull(),
    updatedAt: timestamp("updatedAt", { mode: "date", precision: 3 }).notNull(),
  },
  (t) => [
    index("domain_connections_workspaceId_createdAt_idx").on(t.workspaceId, t.createdAt, t.id),
    index("domain_connections_applicationId_createdAt_idx").on(
      t.applicationId,
      t.createdAt,
      t.id,
    ),
    index("domain_connections_domain_idx").on(t.domain),
  ],
);

export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id: text("id").primaryKey(),
    applicationId: text("applicationId")
      .notNull()
      .references(() => connectApplications.id, { onDelete: "cascade" }),
    connectionId: text("connectionId"),
    eventType: text("eventType").notNull(),
    url: text("url").notNull(),
    payload: json("payload").notNull(),
    status: text("status").notNull(),
    attempts: integer("attempts").notNull().default(0),
    lastStatusCode: integer("lastStatusCode"),
    lastError: text("lastError"),
    nextAttemptAt: timestamp("nextAttemptAt", { mode: "date", precision: 3 }),
    createdAt: timestamp("createdAt", { mode: "date", precision: 3 }).notNull(),
    deliveredAt: timestamp("deliveredAt", { mode: "date", precision: 3 }),
  },
  (t) => [
    index("webhook_deliveries_applicationId_createdAt_idx").on(t.applicationId, t.createdAt),
    index("webhook_deliveries_status_nextAttemptAt_idx").on(t.status, t.nextAttemptAt),
  ],
);
