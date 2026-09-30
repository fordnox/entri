import { createFileRoute } from "@tanstack/react-router";
import { ComparisonPage } from "@/pages/comparison";
import { pageHead } from "@/lib/og";

const PATH = "/compare/orbit-vs-makerkit";
const TITLE =
  "Orbit vs Makerkit — Multi-Tenant SaaS Boilerplate Comparison (2026)";
const DESCRIPTION =
  "Orbit vs Makerkit: a side-by-side comparison of two multi-tenant SaaS boilerplates. Architecture, tenancy, billing, auth, and pricing — feature-by-feature.";

export const Route = createFileRoute("/compare/orbit-vs-makerkit")({
  head: () =>
    pageHead({
      title: TITLE,
      description: DESCRIPTION,
      path: PATH,
    }),
  component: OrbitVsMakerkit,
});

function OrbitVsMakerkit() {
  return (
    <ComparisonPage
      competitorName="Makerkit"
      kicker="Orbit vs Makerkit"
      headlineLead="Orbit vs Makerkit,"
      headlineRest="feature by feature."
      intro="Both Orbit and Makerkit ship a multi-tenant SaaS scaffold — they just disagree on almost every architectural choice. Makerkit is Supabase-first, Next.js-only, and leans on RLS for tenancy. Orbit is Postgres + Drizzle, ships a separate Hono API, supports Next.js or TanStack Start, and enforces tenancy in the type system. Here's how they line up."
      tldr={{
        orbit: [
          "You want a separate API service (Hono) you can scale independently",
          "You want a typed end-to-end stack with DDD bounded contexts",
          "You want TanStack Start as a first-class option, not just Next.js",
          "You'd rather express tenancy in code (branded IDs + repositories) than in SQL policies",
        ],
        competitor: [
          "You're already deep in the Supabase ecosystem (RLS, Edge Functions, Storage)",
          "You want Postgres, auth, storage, and realtime from one vendor",
          "You're shipping Next.js only and don't need a separate API",
        ],
      }}
      sections={[
        {
          heading: "Multi-tenancy",
          rows: [
            { feature: "Multi-tenant workspaces / accounts", orbit: "yes", competitor: "yes" },
            { feature: "Nested teams + team-scoped roles", orbit: "yes", competitor: "yes" },
            { feature: "PBAC (permissions, not just roles)", orbit: "yes", competitor: "partial" },
            { feature: "Tenancy enforcement", orbit: "Branded IDs + repositories", competitor: "Postgres RLS" },
          ],
        },
        {
          heading: "Auth",
          rows: [
            { feature: "Auth library", orbit: "better-auth", competitor: "Supabase Auth" },
            { feature: "Magic links", orbit: "yes", competitor: "yes" },
            { feature: "OAuth", orbit: "Google + Apple (extensible)", competitor: "All Supabase providers" },
            { feature: "Email + password with verification gate", orbit: "yes", competitor: "yes" },
            { feature: "Admin impersonation + bans", orbit: "yes", competitor: "partial" },
          ],
        },
        {
          heading: "Architecture",
          rows: [
            { feature: "Frontend", orbit: "Next.js 16 or TanStack Start", competitor: "Next.js" },
            { feature: "API", orbit: "Separate Hono REST + WebSocket service", competitor: "Next.js Server Actions / API routes" },
            { feature: "Database", orbit: "Postgres + Drizzle", competitor: "Supabase Postgres" },
            { feature: "ORM", orbit: "Drizzle", competitor: "Supabase client" },
            { feature: "DDD bounded contexts", orbit: "yes", competitor: "no" },
            { feature: "Unit of Work + post-commit event bus", orbit: "yes", competitor: "no" },
            { feature: "Realtime", orbit: "In-process WebSocket hub", competitor: "Supabase Realtime" },
          ],
        },
        {
          heading: "Billing & operations",
          rows: [
            { feature: "Billing providers", orbit: "Stripe / Polar / Dodo", competitor: "Stripe / LemonSqueezy" },
            { feature: "Switchable behind one port", orbit: "yes", competitor: "yes" },
            { feature: "Append-only billing event ledger", orbit: "yes", competitor: "no" },
            { feature: "Audit log (tenant + admin)", orbit: "yes", competitor: "partial" },
            { feature: "Background jobs + cron", orbit: "graphile-worker / QStash", competitor: "Supabase pg_cron / Edge Functions" },
            { feature: "Rate limiting", orbit: "Upstash / Unkey / memory", competitor: "partial" },
          ],
        },
        {
          heading: "Pricing & licensing",
          rows: [
            { feature: "Free public starter", orbit: "yes", competitor: "no" },
            { feature: "Paid tier", orbit: "$50 one-time", competitor: "$299–$799 one-time" },
            { feature: "Source code access", orbit: "GitHub repo", competitor: "GitHub repo" },
          ],
        },
      ]}
      verdict={{
        orbit:
          "Orbit fits if you want the freedom to swap pieces. The Hono API is a separate service, the data layer is Drizzle behind repository ports, billing has three interchangeable adapters, and TanStack Start is a peer to Next.js — not a port. Tenancy is enforced by branded IDs and the repository layer, so cross-tenant queries don't compile.",
        competitor:
          "Makerkit is the right pick if you've decided Supabase is your platform. Auth, Postgres + RLS, storage, realtime, and Edge Functions all come from one vendor — and Makerkit's templates are tuned for that. If you'd rather not run a separate API or pick your own ORM, that integration cost is real value.",
      }}
      faqs={[
        {
          question: "Does Orbit use Supabase?",
          answer:
            "No. Orbit runs on plain Postgres (locally via Docker, in production on Railway, Neon, RDS, Fly Postgres, etc.) with Drizzle. If Supabase is non-negotiable, Makerkit is the better fit.",
        },
        {
          question: "Is RLS or branded-ID tenancy better?",
          answer:
            "Different trade-offs. RLS pushes the policy into the database — defense in depth. Branded IDs + repositories push it into the type system — cross-tenant queries don't compile, which catches bugs at PR time. Orbit picks the latter; Makerkit picks the former.",
        },
        {
          question: "Can I use Orbit with Next.js?",
          answer:
            "Yes — Next.js 16 with App Router is one of the two frontend options. TanStack Start is the other. The CLI keeps whichever you pick.",
        },
        {
          question: "How do the prices compare?",
          answer:
            "Makerkit's templates run from $299 to $799 one-time depending on tier. Orbit's paid tier is $50 one-time and unlocks every paid feature. The free Orbit starter is genuinely free — public repo, no payment required.",
        },
      ]}
      path={PATH}
      breadcrumbName="Orbit vs Makerkit"
    />
  );
}
