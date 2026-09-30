import { createFileRoute } from "@tanstack/react-router";
import { SeoLandingPage } from "@/pages/seo-landing";
import { pageHead } from "@/lib/og";

const PATH = "/multi-tenant-saas-boilerplate";
const TITLE =
  "Multi-Tenant SaaS Boilerplate — Workspaces, Teams & PBAC | Orbit";
const DESCRIPTION =
  "A multi-tenant SaaS boilerplate done right. Workspaces as the tenant root, nested teams with their own roles, two-scope PBAC, slug URLs, invites, audit logs, and a typed Postgres schema. Next.js or TanStack Start.";

export const Route = createFileRoute("/multi-tenant-saas-boilerplate")({
  head: () =>
    pageHead({
      title: TITLE,
      description: DESCRIPTION,
      path: PATH,
    }),
  component: MultiTenantSaasBoilerplate,
});

function MultiTenantSaasBoilerplate() {
  return (
    <SeoLandingPage
      kicker="Multi-tenant SaaS boilerplate"
      headlineLead="A multi-tenant SaaS boilerplate"
      headlineRest="that gets tenancy right."
      intro="Most SaaS templates bolt tenancy on as an afterthought. Orbit treats the workspace as the tenant root: every domain object belongs to a workspace, every server route is workspace-scoped, every realtime channel is keyed by workspace. Add nested teams, two-scope PBAC, and an audit log and you have what enterprise customers actually ask for."
      bullets={[
        "Workspace = the tenant root, slug-based URLs",
        "Nested teams with their own roles + members",
        "Two-scope PBAC (workspace + team)",
        "Tenant-scoped realtime channels",
        "Workspace-scoped audit log + global admin log",
        "Invite flows + ownership transfer wired up",
      ]}
      features={[
        {
          title: "Workspace as the tenant root",
          body: "Every aggregate hangs off a workspace. Workspace slugs in the URL, branded WorkspaceId everywhere, transfer of ownership built in. There is no leakage between tenants because the type system won't let you write a query that crosses one.",
        },
        {
          title: "Nested teams",
          body: "Optional second tier of grouping. A team lives inside a workspace, carries its own members and roles, and adds a second permission scope. Useful for departments, sub-projects, or customer-managed groups.",
        },
        {
          title: "Two-scope PBAC",
          body: "WorkspaceRole ↔ WorkspacePermission and TeamRole ↔ TeamPermission. System roles (owner / admin / member) plus arbitrary custom roles. Server middleware (requirePermission, requireTeamPermission) and client hooks (useCan, useCanTeam) share one vocabulary.",
        },
        {
          title: "Realtime, per tenant",
          body: "An in-process WebSocket hub broadcasts domain events to workspace channels. Presence tracker keeps a 30-second grace window. The frontend store applies events as they arrive — your UI stays consistent across tabs and members.",
        },
        {
          title: "Audit log at two scopes",
          body: "Workspace-scoped log for tenant admins (members invited, roles changed, billing updated) and an app-wide log for platform moderation (bans, impersonations). Materialised by a post-commit projector listening to domain events.",
        },
        {
          title: "Postgres + Drizzle, typed",
          body: "Single Postgres database, row-level tenancy via WorkspaceId. Branded prefixed UUIDv7 IDs (newId('team')) make it impossible to mix scopes. DDD bounded contexts keep the code organised as the product grows.",
        },
      ]}
      docLinks={[
        { label: "Workspaces, teams & tenancy →", to: "/docs/concepts/workspaces-teams-tenancy" },
        { label: "Two-scope PBAC →", to: "/docs/concepts/two-scope-pbac" },
        { label: "Realtime events →", to: "/docs/concepts/realtime-events" },
        { label: "Audit log integration →", to: "/docs/integrations/audit-log" },
      ]}
      faqs={[
        {
          question: "Database-per-tenant or shared schema?",
          answer:
            "Shared schema with row-level tenancy via WorkspaceId. Branded IDs and the repository layer make cross-tenant queries impossible to express. Database-per-tenant is overkill for almost every SaaS at the size where you'd reach for a boilerplate.",
        },
        {
          question: "Can I disable teams and ship a workspaces-only product?",
          answer:
            "Yes. Teams are an optional feature — if you don't pick it, the team folder, routes, models, and PBAC scope all vanish from the scaffolded project. Same goes for billing, audit logs, uploads, and email.",
        },
        {
          question: "How do invites work?",
          answer:
            "An admin invites by email, the recipient gets a magic-link-style invite, accepting it joins the workspace at the assigned role. All flows are wired and tested. Same primitive is reused for team-level invites.",
        },
        {
          question: "Is the audit log enough for SOC 2 / compliance?",
          answer:
            "It's the right substrate. Append-only, materialised from domain events post-commit, sanitised metadata (tokens redacted), permission-gated view + export. You'll layer your own policies on top, but the data is there from day one.",
        },
        {
          question: "Next.js or TanStack Start?",
          answer:
            "Both, mutually exclusive at scaffold. Pick --framework=next or --framework=tanstack and the CLI keeps the matching app and deletes the other. Same API, same UI library, same tenancy model.",
        },
      ]}
      path={PATH}
      breadcrumbName="Multi-tenant SaaS boilerplate"
      schemaDescription="A multi-tenant SaaS boilerplate with workspaces as the tenant root, nested teams, two-scope PBAC, audit logs, and a typed Postgres schema. Next.js or TanStack Start."
    />
  );
}
