import { createFileRoute } from "@tanstack/react-router";
import { ComparisonPage } from "@/pages/comparison";
import { pageHead } from "@/lib/og";

const PATH = "/compare/orbit-vs-shipfast";
const TITLE =
  "Orbit vs ShipFast — Multi-Tenant SaaS Boilerplate Comparison (2026)";
const DESCRIPTION =
  "Orbit vs ShipFast: a side-by-side comparison of two Next.js SaaS boilerplates. Multi-tenant workspaces, PBAC, billing, and TanStack Start support — feature-by-feature.";

export const Route = createFileRoute("/compare/orbit-vs-shipfast")({
  head: () =>
    pageHead({
      title: TITLE,
      description: DESCRIPTION,
      path: PATH,
    }),
  component: OrbitVsShipFast,
});

function OrbitVsShipFast() {
  return (
    <ComparisonPage
      competitorName="ShipFast"
      kicker="Orbit vs ShipFast"
      headlineLead="Orbit vs ShipFast,"
      headlineRest="feature by feature."
      intro="ShipFast is the canonical 'launch a SaaS this weekend' boilerplate — small, opinionated, MongoDB. Orbit is the boilerplate you reach for when the SaaS needs to grow up: multi-tenant workspaces, nested teams, two-scope PBAC, an audit log, and a typed Postgres schema. Here's how they line up."
      tldr={{
        orbit: [
          "You need real multi-tenancy — workspaces, members, invites, ownership transfer",
          "You want PBAC + custom roles, not just 'is_admin'",
          "You'd rather start with Postgres + Drizzle than MongoDB",
          "You want a typed end-to-end stack with DDD bounded contexts",
        ],
        competitor: [
          "You're shipping a single-tenant tool over a weekend",
          "You're already deep in MongoDB / NextAuth and want minimal divergence",
          "You don't need teams, audit logs, or a separate API service",
        ],
      }}
      sections={[
        {
          heading: "Multi-tenancy",
          rows: [
            { feature: "Multi-tenant workspaces", detail: "Tenant root with slug URLs", orbit: "yes", competitor: "no" },
            { feature: "Nested teams + team-scoped roles", orbit: "yes", competitor: "no" },
            { feature: "Member invites + ownership transfer", orbit: "yes", competitor: "partial" },
            { feature: "Two-scope PBAC (workspace + team)", orbit: "yes", competitor: "no" },
          ],
        },
        {
          heading: "Auth",
          rows: [
            { feature: "Auth library", orbit: "better-auth", competitor: "NextAuth" },
            { feature: "Magic links", orbit: "yes", competitor: "yes" },
            { feature: "OAuth (Google + Apple)", orbit: "yes", competitor: "yes" },
            { feature: "Email + password with verification gate", orbit: "yes", competitor: "no" },
            { feature: "Admin impersonation + bans", orbit: "yes", competitor: "no" },
          ],
        },
        {
          heading: "Billing",
          rows: [
            { feature: "Providers", orbit: "Stripe / Polar / Dodo", competitor: "Stripe / LemonSqueezy" },
            { feature: "Switchable behind one port", orbit: "yes", competitor: "no" },
            { feature: "Signed webhook receiver", orbit: "yes", competitor: "yes" },
            { feature: "Append-only billing event ledger", orbit: "yes", competitor: "no" },
          ],
        },
        {
          heading: "Architecture",
          rows: [
            { feature: "Frontend", orbit: "Next.js 16 or TanStack Start", competitor: "Next.js (Pages or App)" },
            { feature: "API", orbit: "Separate Hono service", competitor: "Next.js API routes" },
            { feature: "Database", orbit: "Postgres + Drizzle", competitor: "MongoDB (Mongoose)" },
            { feature: "DDD bounded contexts", orbit: "yes", competitor: "no" },
            { feature: "Unit of Work + post-commit event bus", orbit: "yes", competitor: "no" },
            { feature: "Realtime over WebSocket", orbit: "yes", competitor: "no" },
            { feature: "Audit log (workspace + admin scope)", orbit: "yes", competitor: "no" },
            { feature: "Background jobs", orbit: "graphile-worker / QStash", competitor: "no" },
            { feature: "Rate limiting", orbit: "Upstash / Unkey / memory", competitor: "partial" },
          ],
        },
        {
          heading: "Pricing & licensing",
          rows: [
            { feature: "Free public starter", orbit: "yes", competitor: "no" },
            { feature: "Paid tier", orbit: "$50 one-time", competitor: "$199–$299 one-time" },
            { feature: "Source code access", orbit: "GitHub repo", competitor: "GitHub repo" },
          ],
        },
      ]}
      verdict={{
        orbit:
          "Orbit is the better fit when the SaaS is the product. Multi-tenancy, PBAC, audit log, realtime, and a typed Postgres schema mean you don't have to bolt the enterprise stuff on six months in — and the CLI lets you turn off the parts you don't need so a single-tenant scaffold is still a one-command install.",
        competitor:
          "ShipFast is genuinely great if you're spinning up a single-tenant tool, you already know NextAuth + MongoDB, and you want to ship something this weekend. Orbit costs more upfront in concepts (workspaces, PBAC, ports + adapters) — if you'll never need them, ShipFast wins on velocity.",
      }}
      faqs={[
        {
          question: "Is Orbit open source like ShipFast isn't?",
          answer:
            "Both are source-available behind a GitHub repo. Orbit ships a free public starter (no payment, no GitHub access required) plus a paid private template that unlocks teams, billing, audit log, uploads, jobs, rate limiting, email, Drizzle, and the demo mode.",
        },
        {
          question: "Can I get the same 'ship this weekend' speed with Orbit?",
          answer:
            "Yes. The CLI lets you turn off everything you don't want — pick --framework=next and skip teams, billing, audit log, etc. You'll get a single-tenant Next.js + Postgres + better-auth scaffold in one command.",
        },
        {
          question: "Does Orbit work with MongoDB?",
          answer:
            "No. Orbit is Postgres-first, with Drizzle behind repository ports. If MongoDB is non-negotiable, ShipFast or another Mongo-first template is the right pick.",
        },
        {
          question: "How do the prices compare?",
          answer:
            "ShipFast is $199 one-time (Next.js Pages) or $299 (App Router). Orbit's paid tier is $50 one-time and unlocks every paid feature. The free Orbit starter is genuinely free — public repo, no payment required.",
        },
      ]}
      path={PATH}
      breadcrumbName="Orbit vs ShipFast"
    />
  );
}
