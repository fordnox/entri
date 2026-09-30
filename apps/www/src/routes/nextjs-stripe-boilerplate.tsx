import { createFileRoute } from "@tanstack/react-router";
import { SeoLandingPage } from "@/pages/seo-landing";
import { pageHead } from "@/lib/og";

const PATH = "/nextjs-stripe-boilerplate";
const TITLE =
  "Next.js Stripe Boilerplate — Checkout, Portal & Webhooks Wired Up | Orbit";
const DESCRIPTION =
  "A Next.js Stripe boilerplate with checkout sessions, customer portal, signature-verified webhooks, and an append-only billing event ledger. Multi-tenant workspaces, PBAC, and a Hono API on the side. One CLI: npx create-orb.";

export const Route = createFileRoute("/nextjs-stripe-boilerplate")({
  head: () =>
    pageHead({
      title: TITLE,
      description: DESCRIPTION,
      path: PATH,
    }),
  component: NextjsStripeBoilerplate,
});

function NextjsStripeBoilerplate() {
  return (
    <SeoLandingPage
      kicker="Next.js Stripe boilerplate"
      headlineLead="A Next.js Stripe boilerplate"
      headlineRest="that handles every webhook."
      intro="Wiring Stripe by hand is a week you don't get back. Orbit's paid tier ships Next.js 16 + Stripe with checkout sessions, customer portal, signature-verified webhooks, an append-only billing event ledger, and the multi-tenant primitives — workspaces, PBAC, audit logs — that make subscriptions actually map to your product. Next.js and Stripe both live in the paid tier; the free public starter is TanStack Start + better-auth without billing."
      bullets={[
        "Stripe checkout sessions + customer portal",
        "Signature-verified webhooks via Hono",
        "Append-only billing event ledger",
        "Workspace-scoped subscriptions + customers",
        "PBAC-gated billing settings UI",
        "Switch to Polar or Dodo without rewriting product code",
      ]}
      features={[
        {
          title: "Next.js 16 frontend, idiomatic",
          body: "App Router, React 19, server components, route handlers. The billing settings UI lives in /d/$workspaceSlug/workspace/settings/billing and is gated by workspace.billing.manage.",
        },
        {
          title: "Stripe, end to end",
          body: "Checkout sessions for upgrades, customer portal for plan changes and invoices, webhook receiver that verifies the signature and translates events into domain updates inside a Unit of Work.",
        },
        {
          title: "Append-only event ledger",
          body: "Every billing event Stripe sends is persisted to a billing_events table. Idempotent, replayable, auditable. If a webhook fires twice, your subscriptions don't double-flip.",
        },
        {
          title: "Workspace-scoped subscriptions",
          body: "A subscription belongs to a workspace, not a user. Ownership transfer keeps the customer ID with the workspace. The customer portal link is scoped to the right Stripe customer with no impersonation gymnastics.",
        },
        {
          title: "Provider port",
          body: "Stripe is one adapter behind a BillingProvider port. Polar and Dodo are the others. Pick at scaffold; switch later by replacing one file. Product code never imports the Stripe SDK.",
        },
        {
          title: "Local webhooks that just work",
          body: "Built-in smee.io webhook tunnel forwards Stripe events to localhost:4002 in dev. No ngrok dance, no stripe listen process to babysit.",
        },
      ]}
      docLinks={[
        { label: "Billing integration →", to: "/docs/integrations/billing" },
        { label: "Add a plan →", to: "/docs/guides/add-a-plan" },
        { label: "Webhooks in production →", to: "/docs/deploy/webhooks" },
        { label: "Quickstart →", to: "/docs/getting-started/quickstart" },
      ]}
      faqs={[
        {
          question: "Stripe Checkout or embedded Elements?",
          answer:
            "Checkout sessions, with the customer portal for self-serve plan changes and invoices. Embedded Elements is overkill for the 95% of SaaS use cases this template targets.",
        },
        {
          question: "How do you verify webhooks?",
          answer:
            "The Stripe adapter verifies the Stripe-Signature header against your webhook secret on every request. Handlers run inside a Unit of Work, so domain events fire atomically with the DB write.",
        },
        {
          question: "Can I switch from Stripe to Polar or Dodo later?",
          answer:
            "Yes — that's the whole point of the BillingProvider port. Pick one at scaffold; if you change your mind, swap the adapter file. The rest of the codebase doesn't notice.",
        },
        {
          question: "How do plans get defined?",
          answer:
            "There's a guide for it. Plans live in code (typed), price IDs are env vars, and the upgrade button kicks off a checkout session. Audit log records every plan change.",
        },
        {
          question: "Does it work with Next.js 14 or only Next.js 16?",
          answer:
            "The shipped template is Next.js 16. The architecture is plain App Router + route handlers, so backporting is straightforward, but we don't ship a 14 variant.",
        },
      ]}
      path={PATH}
      breadcrumbName="Next.js Stripe boilerplate"
      schemaDescription="A Next.js Stripe boilerplate with checkout, customer portal, signature-verified webhooks, and an append-only billing event ledger — built into a multi-tenant SaaS template."
    />
  );
}
