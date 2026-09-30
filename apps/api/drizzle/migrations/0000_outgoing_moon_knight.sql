CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"accountId" text NOT NULL,
	"providerId" text NOT NULL,
	"accessToken" text,
	"refreshToken" text,
	"accessTokenExpiresAt" timestamp (3),
	"refreshTokenExpiresAt" timestamp (3),
	"scope" text,
	"idToken" text,
	"password" text,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_audit_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"actorUserId" text,
	"action" text NOT NULL,
	"targetType" text,
	"targetId" text,
	"metadata" json NOT NULL,
	"ipAddress" text,
	"userAgent" text,
	"occurredAt" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_customers" (
	"id" text PRIMARY KEY NOT NULL,
	"workspaceId" text NOT NULL,
	"provider" text NOT NULL,
	"providerCustomerId" text NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) NOT NULL,
	CONSTRAINT "billing_customers_workspaceId_unique" UNIQUE("workspaceId")
);
--> statement-breakpoint
CREATE TABLE "billing_events" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"providerEventId" text NOT NULL,
	"type" text NOT NULL,
	"workspaceId" text,
	"payload" json NOT NULL,
	"processedAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "connect_applications" (
	"id" text PRIMARY KEY NOT NULL,
	"workspaceId" text NOT NULL,
	"name" text NOT NULL,
	"iconUrl" text,
	"secretHash" text NOT NULL,
	"secretPreview" text NOT NULL,
	"secretVersion" integer DEFAULT 1 NOT NULL,
	"secretRotatedAt" timestamp (3) NOT NULL,
	"allowedOrigins" json NOT NULL,
	"webhookUrl" text,
	"webhookSecret" text NOT NULL,
	"createdAt" timestamp (3) NOT NULL,
	"updatedAt" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "domain_connections" (
	"id" text PRIMARY KEY NOT NULL,
	"applicationId" text NOT NULL,
	"workspaceId" text NOT NULL,
	"domain" text NOT NULL,
	"rootDomain" text NOT NULL,
	"subdomain" text,
	"userId" text,
	"metadata" json,
	"providerKey" text,
	"setupMethod" text,
	"status" text NOT NULL,
	"records" json NOT NULL,
	"lastError" text,
	"lastCheckedAt" timestamp (3),
	"connectedAt" timestamp (3),
	"createdAt" timestamp (3) NOT NULL,
	"updatedAt" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"token" text NOT NULL,
	"expiresAt" timestamp (3) NOT NULL,
	"ipAddress" text,
	"userAgent" text,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) NOT NULL,
	"impersonatedBy" text,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"workspaceId" text NOT NULL,
	"billingCustomerId" text NOT NULL,
	"provider" text NOT NULL,
	"providerSubscriptionId" text NOT NULL,
	"status" text NOT NULL,
	"priceId" text NOT NULL,
	"planKey" text,
	"quantity" integer DEFAULT 1 NOT NULL,
	"currentPeriodStart" timestamp (3) NOT NULL,
	"currentPeriodEnd" timestamp (3) NOT NULL,
	"cancelAtPeriodEnd" boolean DEFAULT false NOT NULL,
	"canceledAt" timestamp (3),
	"trialEndsAt" timestamp (3),
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) NOT NULL,
	CONSTRAINT "subscriptions_workspaceId_unique" UNIQUE("workspaceId"),
	CONSTRAINT "subscriptions_providerSubscriptionId_unique" UNIQUE("providerSubscriptionId")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"emailVerified" boolean DEFAULT false NOT NULL,
	"image" text,
	"avatarTone" integer DEFAULT 0 NOT NULL,
	"themeMode" text,
	"themePalette" text,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) NOT NULL,
	"role" text,
	"banned" boolean DEFAULT false NOT NULL,
	"banReason" text,
	"banExpires" timestamp (3),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expiresAt" timestamp (3) NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
	"id" text PRIMARY KEY NOT NULL,
	"applicationId" text NOT NULL,
	"connectionId" text,
	"eventType" text NOT NULL,
	"url" text NOT NULL,
	"payload" json NOT NULL,
	"status" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"lastStatusCode" integer,
	"lastError" text,
	"nextAttemptAt" timestamp (3),
	"createdAt" timestamp (3) NOT NULL,
	"deliveredAt" timestamp (3)
);
--> statement-breakpoint
CREATE TABLE "workspace_audit_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"workspaceId" text NOT NULL,
	"teamId" text,
	"actorMemberId" text,
	"actorUserId" text,
	"action" text NOT NULL,
	"targetType" text,
	"targetId" text,
	"metadata" json NOT NULL,
	"occurredAt" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_invites" (
	"id" text PRIMARY KEY NOT NULL,
	"workspaceId" text NOT NULL,
	"email" text NOT NULL,
	"token" text NOT NULL,
	"invitedById" text NOT NULL,
	"roleId" text,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"acceptedAt" timestamp (3),
	"revokedAt" timestamp (3),
	CONSTRAINT "workspace_invites_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "workspace_members" (
	"id" text PRIMARY KEY NOT NULL,
	"workspaceId" text NOT NULL,
	"userId" text NOT NULL,
	"roleId" text NOT NULL,
	"tone" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_role_permissions" (
	"roleId" text NOT NULL,
	"permission" text NOT NULL,
	CONSTRAINT "workspace_role_permissions_roleId_permission_pk" PRIMARY KEY("roleId","permission")
);
--> statement-breakpoint
CREATE TABLE "workspace_roles" (
	"id" text PRIMARY KEY NOT NULL,
	"workspaceId" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"isSystem" boolean DEFAULT false NOT NULL,
	"systemKey" text,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"ownerId" text NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "workspaces_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_audit_entries" ADD CONSTRAINT "app_audit_entries_actorUserId_users_id_fk" FOREIGN KEY ("actorUserId") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_customers" ADD CONSTRAINT "billing_customers_workspaceId_workspaces_id_fk" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connect_applications" ADD CONSTRAINT "connect_applications_workspaceId_workspaces_id_fk" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domain_connections" ADD CONSTRAINT "domain_connections_applicationId_connect_applications_id_fk" FOREIGN KEY ("applicationId") REFERENCES "public"."connect_applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domain_connections" ADD CONSTRAINT "domain_connections_workspaceId_workspaces_id_fk" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_workspaceId_workspaces_id_fk" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_billingCustomerId_billing_customers_id_fk" FOREIGN KEY ("billingCustomerId") REFERENCES "public"."billing_customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_applicationId_connect_applications_id_fk" FOREIGN KEY ("applicationId") REFERENCES "public"."connect_applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_audit_entries" ADD CONSTRAINT "workspace_audit_entries_workspaceId_workspaces_id_fk" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_audit_entries" ADD CONSTRAINT "workspace_audit_entries_actorMemberId_workspace_members_id_fk" FOREIGN KEY ("actorMemberId") REFERENCES "public"."workspace_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_audit_entries" ADD CONSTRAINT "workspace_audit_entries_actorUserId_users_id_fk" FOREIGN KEY ("actorUserId") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_invites" ADD CONSTRAINT "workspace_invites_workspaceId_workspaces_id_fk" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_invites" ADD CONSTRAINT "workspace_invites_invitedById_workspace_members_id_fk" FOREIGN KEY ("invitedById") REFERENCES "public"."workspace_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_invites" ADD CONSTRAINT "workspace_invites_roleId_workspace_roles_id_fk" FOREIGN KEY ("roleId") REFERENCES "public"."workspace_roles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspaceId_workspaces_id_fk" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_roleId_workspace_roles_id_fk" FOREIGN KEY ("roleId") REFERENCES "public"."workspace_roles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_role_permissions" ADD CONSTRAINT "workspace_role_permissions_roleId_workspace_roles_id_fk" FOREIGN KEY ("roleId") REFERENCES "public"."workspace_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_roles" ADD CONSTRAINT "workspace_roles_workspaceId_workspaces_id_fk" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_ownerId_users_id_fk" FOREIGN KEY ("ownerId") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_userId_idx" ON "accounts" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "app_audit_entries_occurredAt_idx" ON "app_audit_entries" USING btree ("occurredAt");--> statement-breakpoint
CREATE INDEX "app_audit_entries_actorUserId_occurredAt_idx" ON "app_audit_entries" USING btree ("actorUserId","occurredAt");--> statement-breakpoint
CREATE INDEX "app_audit_entries_action_occurredAt_idx" ON "app_audit_entries" USING btree ("action","occurredAt");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_customers_provider_providerCustomerId_key" ON "billing_customers" USING btree ("provider","providerCustomerId");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_events_provider_providerEventId_key" ON "billing_events" USING btree ("provider","providerEventId");--> statement-breakpoint
CREATE INDEX "billing_events_workspaceId_processedAt_idx" ON "billing_events" USING btree ("workspaceId","processedAt");--> statement-breakpoint
CREATE INDEX "connect_applications_workspaceId_idx" ON "connect_applications" USING btree ("workspaceId");--> statement-breakpoint
CREATE INDEX "domain_connections_workspaceId_createdAt_idx" ON "domain_connections" USING btree ("workspaceId","createdAt","id");--> statement-breakpoint
CREATE INDEX "domain_connections_applicationId_createdAt_idx" ON "domain_connections" USING btree ("applicationId","createdAt","id");--> statement-breakpoint
CREATE INDEX "domain_connections_domain_idx" ON "domain_connections" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "sessions_userId_idx" ON "sessions" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "subscriptions_billingCustomerId_idx" ON "subscriptions" USING btree ("billingCustomerId");--> statement-breakpoint
CREATE INDEX "subscriptions_status_idx" ON "subscriptions" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "verifications_identifier_key" ON "verifications" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "verifications_expiresAt_idx" ON "verifications" USING btree ("expiresAt");--> statement-breakpoint
CREATE INDEX "webhook_deliveries_applicationId_createdAt_idx" ON "webhook_deliveries" USING btree ("applicationId","createdAt");--> statement-breakpoint
CREATE INDEX "webhook_deliveries_status_nextAttemptAt_idx" ON "webhook_deliveries" USING btree ("status","nextAttemptAt");--> statement-breakpoint
CREATE INDEX "workspace_audit_entries_workspaceId_occurredAt_idx" ON "workspace_audit_entries" USING btree ("workspaceId","occurredAt");--> statement-breakpoint
CREATE INDEX "workspace_audit_entries_workspaceId_teamId_occurredAt_idx" ON "workspace_audit_entries" USING btree ("workspaceId","teamId","occurredAt");--> statement-breakpoint
CREATE INDEX "workspace_audit_entries_workspaceId_action_occurredAt_idx" ON "workspace_audit_entries" USING btree ("workspaceId","action","occurredAt");--> statement-breakpoint
CREATE INDEX "workspace_invites_workspaceId_idx" ON "workspace_invites" USING btree ("workspaceId");--> statement-breakpoint
CREATE INDEX "workspace_invites_email_idx" ON "workspace_invites" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_members_workspaceId_userId_key" ON "workspace_members" USING btree ("workspaceId","userId");--> statement-breakpoint
CREATE INDEX "workspace_members_workspaceId_idx" ON "workspace_members" USING btree ("workspaceId");--> statement-breakpoint
CREATE INDEX "workspace_members_roleId_idx" ON "workspace_members" USING btree ("roleId");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_roles_workspaceId_name_key" ON "workspace_roles" USING btree ("workspaceId","name");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_roles_workspaceId_systemKey_key" ON "workspace_roles" USING btree ("workspaceId","systemKey");--> statement-breakpoint
CREATE INDEX "workspace_roles_workspaceId_sortOrder_idx" ON "workspace_roles" USING btree ("workspaceId","sortOrder");