import { AmbientGrain } from "@orbit/ui/ambient-grain";
import { Button } from "@orbit/ui/button";
import { ArrowRight, Check } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { CopyCommand } from "@/components/copy-command";
import { JsonLd } from "@/components/json-ld";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { CHECKOUT_URLS } from "@/lib/checkout";
import {
  breadcrumbJsonLd,
  faqJsonLd,
  softwareApplicationJsonLd,
} from "@/lib/og";

export type SeoLandingFaq = { question: string; answer: string };

export type SeoLandingFeature = { title: string; body: string };

export type SeoLandingDocLink = { label: string; to: string };

export type SeoLandingProps = {
  /** Eyebrow above the H1 — e.g. "TanStack Start SaaS boilerplate". */
  kicker: string;
  /** H1. The leading clause renders muted to match the homepage style. */
  headlineLead: string;
  headlineRest: string;
  /** Lede paragraph. */
  intro: string;
  /** Short value bullets surfaced in the hero. */
  bullets: string[];
  /** Mid-page feature blocks. */
  features: SeoLandingFeature[];
  /** "Read the docs" links. */
  docLinks: SeoLandingDocLink[];
  /** Schema.org FAQPage entries — also rendered visually. */
  faqs: SeoLandingFaq[];
  /** Path used for canonical, breadcrumb, and SoftwareApplication URLs. */
  path: string;
  /** Page name for the breadcrumb (deepest crumb). */
  breadcrumbName: string;
  /** SoftwareApplication.description — short, used by JSON-LD. */
  schemaDescription: string;
};

export function SeoLandingPage(props: SeoLandingProps) {
  return (
    <div className="relative min-h-svh overflow-hidden bg-background font-mono text-foreground">
      <JsonLd
        data={[
          softwareApplicationJsonLd({
            description: props.schemaDescription,
            price: "50",
            priceCurrency: "USD",
          }),
          breadcrumbJsonLd([
            { name: "Orbit", path: "/" },
            { name: props.breadcrumbName, path: props.path },
          ]),
          faqJsonLd(props.faqs),
        ]}
      />
      <AmbientGrain />

      <SiteHeader />

      <section className="relative z-10 mx-auto max-w-4xl px-6 pt-10 pb-14 md:px-12 md:pt-16 md:pb-20">
        <div className="text-[11px] text-muted-foreground uppercase tracking-[0.25em]">
          {props.kicker}
        </div>
        <h1 className="mt-4 font-medium text-4xl leading-[1.05] tracking-tight md:text-[52px]">
          {props.headlineLead}{" "}
          <span className="text-muted-foreground">{props.headlineRest}</span>
        </h1>
        <p className="mt-6 max-w-2xl text-muted-foreground text-sm leading-relaxed md:text-base">
          {props.intro}
        </p>

        <ul className="mt-6 grid gap-2 text-sm text-foreground/90 sm:grid-cols-2">
          {props.bullets.map((b) => (
            <li key={b} className="flex items-start gap-2">
              <Check
                className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400/90"
                strokeWidth={2}
              />
              <span>{b}</span>
            </li>
          ))}
        </ul>

        <div className="mt-8">
          <CopyCommand command="npx create-orb@latest" />
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button
            variant="default"
            size="lg"
            render={
              <a href={CHECKOUT_URLS.builder}>
                Get started
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
      </section>

      <section className="relative z-10 mx-auto max-w-7xl px-6 pb-20 md:px-12">
        <div className="border-t border-border/60 pt-10">
          <div className="text-[11px] text-muted-foreground uppercase tracking-[0.25em]">
            What you get
          </div>
          <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {props.features.map((f) => (
              <article
                key={f.title}
                className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card/30 p-6 not-dark:bg-clip-padding"
              >
                <div className="font-medium text-foreground text-sm">
                  {f.title}
                </div>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  {f.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-4xl px-6 pb-20 md:px-12">
        <div className="border-t border-border/60 pt-10">
          <div className="text-[11px] text-muted-foreground uppercase tracking-[0.25em]">
            Read the docs
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {props.docLinks.map((d) => (
              <Link
                key={d.to}
                to={d.to}
                className="group flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-card/30 px-4 py-3 text-sm text-foreground/90 transition-colors hover:border-border hover:bg-card/60"
              >
                <span>{d.label}</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-4xl px-6 pb-24 md:px-12">
        <div className="border-t border-border/60 pt-10">
          <div className="text-[11px] text-muted-foreground uppercase tracking-[0.25em]">
            FAQ
          </div>
          <dl className="mt-8 divide-y divide-border/60">
            {props.faqs.map((f) => (
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
