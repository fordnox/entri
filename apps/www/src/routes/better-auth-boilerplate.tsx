import { createFileRoute } from "@tanstack/react-router";
import { SeoLandingPage } from "@/pages/seo-landing";
import { pageHead } from "@/lib/og";

const PATH = "/better-auth-boilerplate";
const TITLE =
  "better-auth Boilerplate — SaaS Starter with Magic Links, OAuth & PBAC | Orbit";
const DESCRIPTION =
  "A production-ready better-auth boilerplate. Magic links, Google + Apple OAuth, email + password with verification, admin impersonation, multi-tenant workspaces, and PBAC — all wired up. One CLI: npx create-orb.";

export const Route = createFileRoute("/better-auth-boilerplate")({
  head: () =>
    pageHead({
      title: TITLE,
      description: DESCRIPTION,
      path: PATH,
    }),
  component: BetterAuthBoilerplate,
});

function BetterAuthBoilerplate() {
  return (
    <SeoLandingPage
      kicker="better-auth boilerplate"
      headlineLead="A better-auth boilerplate"
      headlineRest="that's already a SaaS."
      intro="Most better-auth examples stop at sign-in. Orbit ships a full SaaS on top of it: magic links, OAuth, email + password with verification, admin impersonation, multi-tenant workspaces, invites, PBAC, and a settings UI — all wired up and typed end-to-end."
      bullets={[
        "better-auth: magic link, OAuth (Google + Apple), email + password",
        "Email verification gate before first sign-in",
        "Admin plugin for impersonation + bans",
        "Workspace-scoped sessions and invites",
        "PBAC at workspace and team scope",
        "Drop-in Drizzle DB adapter",
      ]}
      features={[
        {
          title: "All the auth methods, no glue",
          body: "Magic link sign-in via Resend (or stdout in dev), Google + Apple OAuth, and email + password with a verification step that closes the pre-account-takeover window.",
        },
        {
          title: "Wired into a real product",
          body: "Auth isn't an isolated demo. Sessions are workspace-aware, invites flow through email, and the settings UI handles email change, password reset, and account deletion with verification at every step.",
        },
        {
          title: "Admin plugin, ready to use",
          body: "User search, ban / unban, and impersonation routes are mounted with permission gates. App-scoped audit log captures every admin action.",
        },
        {
          title: "Permission-based access control",
          body: "Two-scope PBAC: WorkspaceRole and TeamRole. System roles plus custom roles. Server middleware enforces; useCan() / useCanTeam() hooks gate the UI.",
        },
        {
          title: "Drizzle, wired in",
          body: "better-auth runs on @better-auth/drizzle-adapter against the same Drizzle schema as the rest of the data layer. One ORM, one schema, no glue.",
        },
        {
          title: "Rate limiting that ships",
          body: "Auth and waitlist endpoints are guarded by layered per-IP and per-email limits via a RateLimiter port (memory / Upstash / Unkey). One address can't be ground down by a botnet.",
        },
      ]}
      docLinks={[
        { label: "OAuth setup →", to: "/docs/integrations/oauth" },
        { label: "Magic links + mailer →", to: "/docs/integrations/mailer" },
        { label: "Two-scope PBAC →", to: "/docs/concepts/two-scope-pbac" },
        { label: "Rate limiting →", to: "/docs/integrations/rate-limiting" },
      ]}
      faqs={[
        {
          question: "Is this just a better-auth example?",
          answer:
            "No. It's a complete multi-tenant SaaS that uses better-auth for the identity layer. You get sign-in, but also workspaces, teams, invites, settings UI, audit log, and a permissions model — out of the box.",
        },
        {
          question: "Which auth methods are supported?",
          answer:
            "Magic links (Resend or console mailer), Google OAuth, Apple OAuth, and email + password with a verification step. Sign-up is blocked until the email is verified, which closes the pre-account-takeover window.",
        },
        {
          question: "Can I add OIDC or SAML?",
          answer:
            "better-auth supports additional OAuth / OIDC providers via plugins. The Orbit identity context is small and intentionally easy to extend — add a provider in one place, and the rest of the app picks it up.",
        },
        {
          question: "Which ORM does the auth layer use?",
          answer:
            "Drizzle. better-auth uses @better-auth/drizzle-adapter, and the rest of the data layer is Drizzle repositories behind the same ports. Domain code is ORM-agnostic.",
        },
        {
          question: "Is impersonation included?",
          answer:
            "Yes — better-auth's admin plugin is mounted with permission gates and every action is captured in a global app-scope audit log. Useful for support work without needing a separate tool.",
        },
      ]}
      path={PATH}
      breadcrumbName="better-auth boilerplate"
      schemaDescription="A production-ready better-auth boilerplate built into a multi-tenant SaaS template — magic links, OAuth, email + password, admin impersonation, workspaces, and PBAC."
    />
  );
}
