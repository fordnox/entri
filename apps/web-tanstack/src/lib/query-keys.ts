export const queryKeys = {
  root: ["orbit"] as const,
  config: () => [...queryKeys.root, "config"] as const,
  me: () => [...queryKeys.root, "me"] as const,
  accountBlockingWorkspaces: () =>
    [...queryKeys.root, "account", "blocking-workspaces"] as const,
  onboardingIntentStatus: () =>
    [...queryKeys.root, "onboarding", "intent-status"] as const,
  workspace: () => [...queryKeys.root, "workspace"] as const,
  workspaceSnapshot: (slug: string) =>
    [...queryKeys.workspace(), "snapshot", slug] as const,
  workspaceMembers: (slug: string) =>
    [...queryKeys.workspace(), "members", slug] as const,
  workspaceInvites: (slug: string) =>
    [...queryKeys.workspace(), "invites", slug] as const,
  workspaceRoles: (slug: string) =>
    [...queryKeys.workspace(), "roles", slug] as const,
  teams: (slug: string) => [...queryKeys.workspace(), "teams", slug] as const,
  team: (slug: string, teamId: string) =>
    [...queryKeys.teams(slug), teamId] as const,
  teamMembers: (slug: string, teamId: string) =>
    [...queryKeys.team(slug, teamId), "members"] as const,
  teamRoles: (slug: string, teamId: string) =>
    [...queryKeys.team(slug, teamId), "roles"] as const,
  billing: (slug: string) =>
    [...queryKeys.workspace(), "billing", slug] as const,
  connect: (slug: string) =>
    [...queryKeys.workspace(), "connect", slug] as const,
  connectApplications: (slug: string) =>
    [...queryKeys.connect(slug), "applications"] as const,
  connectApplication: (slug: string, appId: string) =>
    [...queryKeys.connectApplications(slug), appId] as const,
  connectDeliveries: (slug: string, appId: string) =>
    [...queryKeys.connectApplication(slug, appId), "deliveries"] as const,
  connectDomains: (slug: string) =>
    [...queryKeys.connect(slug), "domains"] as const,
  connectDomainList: (
    slug: string,
    filters: { applicationId?: string; status?: string; q?: string },
  ) => [...queryKeys.connectDomains(slug), "list", filters] as const,
  /** Single first page per status — used for overview counts, not the infinite list. */
  connectDomainCount: (slug: string, status: string) =>
    [...queryKeys.connectDomains(slug), "count", status] as const,
  connectDomain: (slug: string, connectionId: string) =>
    [...queryKeys.connectDomains(slug), "detail", connectionId] as const,
  connectProviders: () => [...queryKeys.root, "connect", "providers"] as const,
  // +feature:audit-log
  workspaceAudit: (slug: string) =>
    [...queryKeys.workspace(), "audit", slug] as const,
  adminAudit: () => [...queryKeys.root, "admin", "audit"] as const,
  // -feature:audit-log
};
