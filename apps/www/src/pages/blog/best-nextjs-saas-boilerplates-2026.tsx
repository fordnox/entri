import { AmbientGrain } from "@orbit/ui/ambient-grain";
import { Button } from "@orbit/ui/button";
import { ArrowRight, ExternalLink } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { CopyCommand } from "@/components/copy-command";
import { JsonLd } from "@/components/json-ld";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { CHECKOUT_URLS } from "@/lib/checkout";
import {
  breadcrumbJsonLd,
  faqJsonLd,
  techArticleJsonLd,
} from "@/lib/og";

const PATH = "/blog/best-nextjs-saas-boilerplates-2026";

type Entry = {
  rank: number;
  name: string;
  url: string;
  stack: string;
  price: string;
  bestFor: string;
  body: string;
  pros: string[];
  cons: string[];
  internal?: { label: string; to: string };
};

const ENTRIES: Entry[] = [
  {
    rank: 1,
    name: "Orbit",
    url: "https://wereorbit.com",
    stack: "Next.js 16 or TanStack Start · Hono API · Postgres + Drizzle · better-auth",
    price: "Free starter · $50 one-time for paid tier",
    bestFor: "Multi-tenant SaaS that needs to grow up — workspaces, teams, PBAC, audit logs.",
    body: "Orbit is the boilerplate we maintain, so take that as a bias warning — but it earns the top spot here on what it actually ships. It's the only template in the list with first-class TanStack Start support next to Next.js, both behind a single CLI that scaffolds whichever you pick. Multi-tenancy is the design centre: workspaces are the tenant root, teams nest inside, two-scope PBAC governs both, and tenancy is enforced in the type system via branded prefixed IDs. The API is a separate Hono service with a WebSocket realtime hub. The Unit of Work pattern means every write is transactional, every domain event fires post-commit, and projectors handle audit log materialisation, mailer sends, and webhook reconciliation. Three interchangeable billing adapters (Stripe, Polar, Dodo). Drizzle on Postgres, behind repository ports so domain code never imports the ORM.",
    pros: [
      "TanStack Start support is genuinely first-class — not a port",
      "Multi-tenancy enforced in the type system (branded IDs)",
      "Three switchable billing providers behind one port",
      "Audit log + WebSocket realtime + background jobs out of the box",
      "$50 one-time for the full paid tier; free public starter",
    ],
    cons: [
      "Postgres-first — no MongoDB option",
      "Heavier on architecture (DDD bounded contexts, ports + adapters) than weekend templates",
    ],
    internal: { label: "See Orbit features →", to: "/features" },
  },
  {
    rank: 2,
    name: "ShipFast",
    url: "https://shipfa.st",
    stack: "Next.js · NextAuth · MongoDB · Mongoose",
    price: "$199 (Pages) or $299 (App Router)",
    bestFor: "Single-tenant tools you want to launch this weekend.",
    body: "ShipFast set the template for 'launch a SaaS this weekend'. It's intentionally small, intentionally opinionated, and intentionally MongoDB. Auth is NextAuth, billing is Stripe or LemonSqueezy, and the whole template fits in your head in an afternoon. There's no multi-tenancy primitive, no audit log, no separate API service — and that's the point. If your product is one user logging into one workspace, you're paying for things you'll never use with anything more elaborate.",
    pros: [
      "Smallest learning curve — entire template fits in your head",
      "NextAuth + Stripe + Mongo is genuinely launchable in a weekend",
      "Active community and large customer base",
    ],
    cons: [
      "No multi-tenancy primitive — bolt it on yourself",
      "MongoDB only; no Postgres path",
      "No teams, no PBAC, no audit log",
    ],
  },
  {
    rank: 3,
    name: "Makerkit",
    url: "https://makerkit.dev",
    stack: "Next.js · Supabase (Auth + Postgres + Storage) · RLS-based tenancy",
    price: "$299–$799 one-time",
    bestFor: "Teams who've already standardised on Supabase.",
    body: "Makerkit is the most polished template in the Supabase ecosystem. Multi-tenancy, teams, billing (Stripe + LemonSqueezy), and a settings UI all ship out of the box. Tenancy is enforced via Postgres Row Level Security policies — defense in depth at the database layer, which appeals to security-conscious teams. The trade-off is lock-in: Supabase Auth, Supabase Postgres, Supabase Storage, Supabase Edge Functions are all assumed. If you wanted to swap Postgres providers or use a different auth library, you're rebuilding a lot.",
    pros: [
      "Mature multi-tenant primitives backed by RLS",
      "Best-in-class for Supabase-native projects",
      "Polished admin and settings UI",
    ],
    cons: [
      "Heavy lock-in to Supabase",
      "No TanStack Start path — Next.js only",
      "Highest price point in this list",
    ],
  },
  {
    rank: 4,
    name: "Vercel Next.js SaaS Starter",
    url: "https://vercel.com/templates/next.js/next-js-saas-starter",
    stack: "Next.js · Drizzle · Postgres · Stripe · Auth.js",
    price: "Free (MIT)",
    bestFor: "A reference implementation when you want to see how Vercel builds it.",
    body: "Vercel's official template covers auth, Stripe subscriptions, a dashboard, and a marketing site. It's the canonical 'how would Vercel themselves do it' answer and pairs naturally with Vercel + Neon for hosting. Multi-tenancy is shallow — there's a teams concept but no nested teams, no PBAC, no audit log. Treat it as the floor: a clean, free starting point that you'll outgrow as soon as the SaaS gets serious about tenancy or compliance.",
    pros: [
      "Free, MIT licensed, maintained by Vercel",
      "Drizzle + Stripe + Auth.js — modern defaults",
      "Pairs cleanly with Vercel + Neon hosting",
    ],
    cons: [
      "Multi-tenancy is shallow — no nested teams or PBAC",
      "No audit log, realtime, or background jobs",
      "Expect to outgrow it as the product matures",
    ],
  },
  {
    rank: 5,
    name: "SaaS Boilerplate (ixartz)",
    url: "https://github.com/ixartz/SaaS-Boilerplate",
    stack: "Next.js · Drizzle · Postgres · Clerk · Stripe · Tailwind",
    price: "Free (MIT)",
    bestFor: "Open-source starter when Clerk is your auth pick.",
    body: "The most-starred open-source SaaS boilerplate on GitHub. Next.js App Router, Drizzle, Clerk for auth, Stripe for billing, Tailwind, and i18n via next-intl. It's a well-curated stack and a great free starting point — the trade-off is depth. Multi-tenancy via Clerk Organizations is fine for basic teams, but if you need PBAC, audit logs, or a separate API, you'll add them yourself.",
    pros: [
      "Genuinely free, MIT licensed, very actively maintained",
      "Modern stack — App Router, Drizzle, Clerk",
      "i18n out of the box",
    ],
    cons: [
      "Clerk lock-in for auth (and Clerk's pricing scales with MAUs)",
      "Multi-tenancy is what Clerk Organizations gives you — no PBAC",
      "No audit log or realtime",
    ],
  },
  {
    rank: 6,
    name: "Shipped",
    url: "https://shipped.club",
    stack: "Next.js · Postgres · NextAuth · Stripe",
    price: "$249 one-time",
    bestFor: "ShipFast's stack, but on Postgres.",
    body: "Shipped is the answer if you wanted ShipFast but with Postgres instead of MongoDB. Same 'launch this weekend' framing, similar feature set (auth, Stripe, blog), and a similar price point. There's no multi-tenancy primitive and no audit log; the template stops where the product begins.",
    pros: [
      "Postgres instead of Mongo",
      "Sensible defaults for a single-tenant tool",
    ],
    cons: [
      "No multi-tenancy or PBAC",
      "No separate API service or realtime",
    ],
  },
  {
    rank: 7,
    name: "Bedrock",
    url: "https://bedrock.mxstbr.com",
    stack: "Next.js · GraphQL · Postgres · NextAuth",
    price: "$649 one-time",
    bestFor: "Teams who want GraphQL end-to-end.",
    body: "Bedrock by Max Stoiber is a thoughtful, opinionated template centred on a typed GraphQL layer between Next.js and Postgres. If you've decided GraphQL is your API contract, Bedrock has the cleanest expression of that idea among production templates. Multi-tenancy is light, and the GraphQL choice is itself an opinion you'll either love or actively dislike.",
    pros: [
      "Typed GraphQL layer — codegen + persisted queries",
      "Strong opinions, well-documented",
    ],
    cons: [
      "GraphQL is a strong opinion and not the modern default",
      "No first-class multi-tenancy",
    ],
  },
  {
    rank: 8,
    name: "T3 SaaS Stack (community)",
    url: "https://create.t3.gg",
    stack: "Next.js · tRPC · Drizzle · NextAuth · Tailwind",
    price: "Free",
    bestFor: "Roll-your-own when you want full control of every choice.",
    body: "Strictly speaking the T3 stack isn't a SaaS boilerplate — create-t3-app scaffolds a typed Next.js + tRPC project and stops there. But it's the most common starting point for engineers who want to build the SaaS themselves. You'll write your own workspaces, your own PBAC, your own audit log, your own billing — but the foundation is solid and free, and tRPC + typed end-to-end is genuinely good DX.",
    pros: [
      "Free, well-maintained, large community",
      "tRPC end-to-end typing is excellent DX",
    ],
    cons: [
      "Not a SaaS template — you build the SaaS parts yourself",
      "Expect weeks of work to reach feature parity with the paid templates above",
    ],
  },
];

export function BestNextjsSaasBoilerplates2026Page() {
  return (
    <div className="relative min-h-svh overflow-hidden bg-background font-mono text-foreground">
      <JsonLd
        data={[
          techArticleJsonLd({
            title:
              "Best Next.js SaaS boilerplates in 2026 — honest comparison",
            description:
              "Eight Next.js SaaS boilerplates ranked and compared on multi-tenancy, billing, auth, architecture, and price. Updated for 2026.",
            path: PATH,
          }),
          breadcrumbJsonLd([
            { name: "Orbit", path: "/" },
            { name: "Blog", path: "/blog" },
            { name: "Best Next.js SaaS boilerplates 2026", path: PATH },
          ]),
          {
            "@context": "https://schema.org",
            "@type": "ItemList",
            itemListOrder: "https://schema.org/ItemListOrderAscending",
            numberOfItems: ENTRIES.length,
            itemListElement: ENTRIES.map((e) => ({
              "@type": "ListItem",
              position: e.rank,
              name: e.name,
              url: e.url,
            })),
          },
          faqJsonLd(FAQS),
        ]}
      />
      <AmbientGrain />
      <SiteHeader />

      <article className="relative z-10 mx-auto max-w-3xl px-6 pt-10 pb-16 md:px-12 md:pt-16 md:pb-20">
        <div className="text-[11px] text-muted-foreground uppercase tracking-[0.25em]">
          Guide · 2026
        </div>
        <h1 className="mt-4 font-medium text-4xl leading-[1.05] tracking-tight md:text-[52px]">
          The best Next.js SaaS{" "}
          <span className="text-muted-foreground">boilerplates in 2026.</span>
        </h1>
        <p className="mt-6 text-muted-foreground text-sm leading-relaxed md:text-base">
          We build Orbit, so we put it at the top — full disclosure. Beyond
          that, this is an honest comparison of the eight Next.js SaaS
          boilerplates we'd actually consider in 2026, ranked on multi-tenancy
          depth, billing flexibility, auth choices, architecture, and price.
          Skip to the FAQ if you just want the picking-criteria summary.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Button
            variant="default"
            size="lg"
            render={
              <a href={CHECKOUT_URLS.builder}>
                Try Orbit
                <ArrowRight />
              </a>
            }
          />
          <Button
            variant="outline"
            size="lg"
            render={<Link to="/compare/orbit-vs-shipfast">Orbit vs ShipFast</Link>}
          />
        </div>
      </article>

      <section className="relative z-10 mx-auto max-w-3xl px-6 pb-20 md:px-12">
        {ENTRIES.map((entry, index) => (
          <div
            key={entry.name}
            className="border-t border-border/60 py-10 first:border-t-0 first:pt-0"
          >
            <div className="flex flex-wrap items-baseline gap-3">
              <span className="text-[11px] text-muted-foreground uppercase tracking-[0.25em]">
                #{entry.rank}
              </span>
              <h2 className="font-medium text-2xl tracking-tight md:text-3xl">
                {entry.name}
              </h2>
              <a
                href={entry.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Visit
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            <dl className="mt-4 grid gap-2 text-xs sm:grid-cols-[120px_1fr]">
              <dt className="text-muted-foreground uppercase tracking-[0.2em]">Stack</dt>
              <dd className="text-foreground/90">{entry.stack}</dd>
              <dt className="text-muted-foreground uppercase tracking-[0.2em]">Price</dt>
              <dd className="text-foreground/90">{entry.price}</dd>
              <dt className="text-muted-foreground uppercase tracking-[0.2em]">Best for</dt>
              <dd className="text-foreground/90">{entry.bestFor}</dd>
            </dl>

            <p className="mt-6 text-sm text-foreground/85 leading-relaxed">
              {entry.body}
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/5 p-4">
                <div className="text-[10px] uppercase tracking-[0.25em] text-emerald-400/90">
                  Pros
                </div>
                <ul className="mt-2 space-y-1.5 text-xs text-foreground/90">
                  {entry.pros.map((p) => (
                    <li key={p}>· {p}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-lg border border-amber-400/20 bg-amber-400/5 p-4">
                <div className="text-[10px] uppercase tracking-[0.25em] text-amber-400/90">
                  Trade-offs
                </div>
                <ul className="mt-2 space-y-1.5 text-xs text-foreground/90">
                  {entry.cons.map((p) => (
                    <li key={p}>· {p}</li>
                  ))}
                </ul>
              </div>
            </div>

            {entry.internal && (
              <Link
                to={entry.internal.to}
                className="mt-6 inline-flex items-center gap-2 text-sm text-foreground/90 transition-colors hover:text-foreground"
              >
                {entry.internal.label}
              </Link>
            )}

            {index === ENTRIES.length - 1 && null}
          </div>
        ))}
      </section>

      <section className="relative z-10 mx-auto max-w-3xl px-6 pb-20 md:px-12">
        <div className="border-t border-border/60 pt-10">
          <div className="text-[11px] text-muted-foreground uppercase tracking-[0.25em]">
            Try Orbit in one command
          </div>
          <div className="mt-6">
            <CopyCommand command="npx create-orb@latest" />
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button
              variant="default"
              size="lg"
              render={
                <a href={CHECKOUT_URLS.builder}>
                  Get the paid tier
                  <ArrowRight />
                </a>
              }
            />
            <Button
              variant="outline"
              size="lg"
              render={<Link to="/features">All features</Link>}
            />
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-3xl px-6 pb-24 md:px-12">
        <div className="border-t border-border/60 pt-10">
          <div className="text-[11px] text-muted-foreground uppercase tracking-[0.25em]">
            FAQ
          </div>
          <dl className="mt-8 divide-y divide-border/60">
            {FAQS.map((f) => (
              <div key={f.question} className="py-6">
                <dt className="font-medium text-foreground text-sm md:text-base">
                  {f.question}
                </dt>
                <dd className="mt-3 text-muted-foreground text-sm leading-relaxed">
                  {f.answer}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

const FAQS = [
  {
    question: "What's the best Next.js SaaS boilerplate in 2026?",
    answer:
      "It depends on what you're building. For multi-tenant SaaS that needs workspaces, teams, PBAC, audit logs, and a typed Postgres schema, Orbit is the strongest pick at $50. For weekend tools where you don't need tenancy, ShipFast or Shipped are faster to launch. For Supabase-native teams, Makerkit. For free open source, ixartz/SaaS-Boilerplate or the Vercel template.",
  },
  {
    question: "Free vs paid SaaS boilerplate — is paid worth it?",
    answer:
      "If your time is worth more than $50–$300/hour and the template saves you a week, paid pays for itself the first day. The real question is which paid template fits your stack. Don't pay $300 for a Next.js + Mongo template if you're going to swap Mongo out — you've just bought a lot of code you'll delete.",
  },
  {
    question: "Should I use a SaaS boilerplate or roll my own with create-t3-app?",
    answer:
      "T3 gives you a solid Next.js + tRPC foundation but stops there. Expect weeks of work to reach feature parity with any of the paid templates above on auth, billing, multi-tenancy, settings UI, and admin. Roll your own if those weeks are themselves the learning you want; pay $50–$300 if they aren't.",
  },
  {
    question: "Which boilerplate supports TanStack Start?",
    answer:
      "Orbit is the only template in this list with first-class TanStack Start support. The CLI's --framework=tanstack flag scaffolds a TanStack Start app + Hono API; --framework=next scaffolds the Next.js variant instead.",
  },
  {
    question: "Which boilerplate has the deepest multi-tenancy?",
    answer:
      "Orbit and Makerkit are the two with serious multi-tenant primitives. Orbit enforces tenancy in the type system via branded prefixed IDs and repository ports; Makerkit enforces it via Postgres RLS. Both are good answers — pick based on whether you'd rather express tenancy in code or in SQL policies.",
  },
];
