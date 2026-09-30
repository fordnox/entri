import { createFileRoute } from "@tanstack/react-router";
import { SeoLandingPage } from "@/pages/seo-landing";
import { pageHead } from "@/lib/og";

const PATH = "/tanstack-start-saas-boilerplate";
const TITLE =
  "TanStack Start SaaS Boilerplate — Multi-Tenant, Typed, Wired Up | Orbit";
const DESCRIPTION =
  "Production-ready TanStack Start SaaS boilerplate. Multi-tenant workspaces, teams, PBAC, Stripe / Polar / Dodo billing, better-auth, audit logs, realtime, and email — all typed end-to-end. Scaffolded with one CLI.";

export const Route = createFileRoute("/tanstack-start-saas-boilerplate")({
  head: () =>
    pageHead({
      title: TITLE,
      description: DESCRIPTION,
      path: PATH,
    }),
  component: TanStackStartSaasBoilerplate,
});

function TanStackStartSaasBoilerplate() {
  return (
    <SeoLandingPage
      kicker="TanStack Start SaaS boilerplate"
      headlineLead="The TanStack Start SaaS boilerplate"
      headlineRest="for multi-tenant apps."
      intro="Orbit is a CLI that scaffolds a production-ready, multi-tenant SaaS on TanStack Start in minutes. File-based routing, React 19, Vite, server functions — paired with a Hono REST + WebSocket API, Drizzle, better-auth, and a clean DDD core. No glue code to write on day one."
      bullets={[
        "TanStack Start app on port 4001",
        "TanStack Router file-based routing + Loader data",
        "Hono API with WebSocket realtime",
        "better-auth: magic link, OAuth, email + password",
        "Multi-tenant workspaces with two-scope PBAC",
        "Stripe, Polar, or Dodo billing — same port",
      ]}
      features={[
        {
          title: "TanStack Start, idiomatic",
          body: "First-class TanStack Start app with React 19 + Vite. Loader-driven data fetching, file-based routing, server functions — set up the way the TanStack docs recommend, not retrofitted from another framework.",
        },
        {
          title: "Hono API + WebSocket realtime",
          body: "Separate Hono service exposes a typed REST API and a WebSocket hub. The frontend ships with a query-keyed React Query layer and a realtime store that applies domain events as they happen.",
        },
        {
          title: "Multi-tenant workspaces",
          body: "Workspace is the tenant root. Slug URLs, ownership transfer, member management, invites, plus optional nested teams with their own roles and permissions.",
        },
        {
          title: "Permission-based access control",
          body: "PBAC at workspace and team scope, enforced by middleware on the server and surfaced by useCan() / useCanTeam() hooks on the client. System and custom roles included.",
        },
        {
          title: "Billing, three providers",
          body: "Stripe, Polar, or Dodo Payments behind one BillingProvider port. Checkout, customer portal, signature-verified webhooks, and an append-only billing event ledger.",
        },
        {
          title: "Typed end-to-end",
          body: "TypeScript 6, Drizzle, branded prefixed UUIDv7 IDs, Zod validation, vitest + Testcontainers. The CLI strips features you don't pick at scaffold time, so you only ship what you use.",
        },
      ]}
      docLinks={[
        { label: "Quickstart →", to: "/docs/getting-started/quickstart" },
        { label: "Workspaces & tenancy →", to: "/docs/concepts/workspaces-teams-tenancy" },
        { label: "Two-scope PBAC →", to: "/docs/concepts/two-scope-pbac" },
        { label: "Billing integration →", to: "/docs/integrations/billing" },
      ]}
      faqs={[
        {
          question: "Is this a real TanStack Start app or a Next.js port?",
          answer:
            "It's a real TanStack Start app. The TanStack frontend lives in apps/web-tanstack with file-based TanStack Router routes, server functions, and Vite. There is also a Next.js variant — the CLI keeps whichever you pick and deletes the other.",
        },
        {
          question: "What's in the box on day one?",
          answer:
            "better-auth (magic link, OAuth, password), multi-tenant workspaces, PBAC, a Hono API with WebSocket realtime, a 55-component UI library, settings screens, member invites, and an opinionated DDD layout. Optional paid features add teams, billing, audit logs, uploads, jobs, rate limiting, and email.",
        },
        {
          question: "Can I use Stripe, Polar, or Dodo Payments?",
          answer:
            "All three. Billing is a port with adapters for each. Pick one at scaffold time with --billing-provider; the others are stripped from the output.",
        },
        {
          question: "Do I have to keep PBAC, teams, or audit logs?",
          answer:
            "No. The CLI removes any feature you don't select — files, routes, env vars, and Drizzle tables all vanish. You can ship a single-tenant TanStack app or a full multi-tenant SaaS from the same template.",
        },
        {
          question: "How do I install it?",
          answer:
            "Run npx create-orb@latest, choose --framework=tanstack, and pick the features you want. The CLI clones the right template, installs dependencies, and gets you running with one command.",
        },
      ]}
      path={PATH}
      breadcrumbName="TanStack Start SaaS boilerplate"
      schemaDescription="Production-ready TanStack Start SaaS boilerplate with multi-tenant workspaces, teams, PBAC, billing, audit logs, realtime, and email — scaffolded with the create-orb CLI."
    />
  );
}
