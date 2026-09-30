import { Fragment } from "react";
import { AmbientGrain } from "@orbit/ui/ambient-grain";
import { Button } from "@orbit/ui/button";
import { ArrowRight, Check, Minus, X } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { CopyCommand } from "@/components/copy-command";
import { JsonLd } from "@/components/json-ld";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { CHECKOUT_URLS } from "@/lib/checkout";
import { breadcrumbJsonLd, faqJsonLd } from "@/lib/og";

export type ComparisonCell = "yes" | "no" | "partial" | string;

export type ComparisonRow = {
  feature: string;
  /** Short note shown under the feature name. */
  detail?: string;
  orbit: ComparisonCell;
  competitor: ComparisonCell;
};

export type ComparisonSection = {
  heading: string;
  rows: ComparisonRow[];
};

export type ComparisonProps = {
  competitorName: string;
  /** Eyebrow above the H1, e.g. "Orbit vs ShipFast". */
  kicker: string;
  /** H1 with leading + muted second clause. */
  headlineLead: string;
  headlineRest: string;
  /** Lede paragraph. */
  intro: string;
  /** TL;DR — 3-4 short bullets summarising who should pick which. */
  tldr: { orbit: string[]; competitor: string[] };
  /** Comparison table sections. */
  sections: ComparisonSection[];
  /** "Pick Orbit if…" + "Pick competitor if…" verdict copy. */
  verdict: { orbit: string; competitor: string };
  faqs: Array<{ question: string; answer: string }>;
  path: string;
  breadcrumbName: string;
};

function CellIcon({ value }: { value: ComparisonCell }) {
  if (value === "yes") {
    return (
      <span className="inline-flex items-center gap-1.5 text-emerald-400">
        <Check className="h-4 w-4" strokeWidth={2} />
        <span className="text-xs">Yes</span>
      </span>
    );
  }
  if (value === "no") {
    return (
      <span className="inline-flex items-center gap-1.5 text-muted-foreground/70">
        <X className="h-4 w-4" strokeWidth={2} />
        <span className="text-xs">No</span>
      </span>
    );
  }
  if (value === "partial") {
    return (
      <span className="inline-flex items-center gap-1.5 text-amber-400">
        <Minus className="h-4 w-4" strokeWidth={2} />
        <span className="text-xs">Partial</span>
      </span>
    );
  }
  return <span className="text-foreground/90 text-xs">{value}</span>;
}

export function ComparisonPage(props: ComparisonProps) {
  return (
    <div className="relative min-h-svh overflow-hidden bg-background font-mono text-foreground">
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: "Orbit", path: "/" },
            { name: "Compare", path: "/compare" },
            { name: props.breadcrumbName, path: props.path },
          ]),
          faqJsonLd(props.faqs),
        ]}
      />
      <AmbientGrain />
      <SiteHeader />

      <section className="relative z-10 mx-auto max-w-4xl px-6 pt-10 pb-12 md:px-12 md:pt-16 md:pb-16">
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

      <section className="relative z-10 mx-auto max-w-7xl px-6 pb-16 md:px-12">
        <div className="border-t border-border/60 pt-10">
          <div className="text-[11px] text-muted-foreground uppercase tracking-[0.25em]">
            TL;DR
          </div>
          <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="rounded-xl border border-border/60 bg-card/30 p-6">
              <div className="font-medium text-foreground text-sm">
                Pick Orbit if…
              </div>
              <ul className="mt-4 space-y-2 text-sm text-foreground/90">
                {props.tldr.orbit.map((b) => (
                  <li key={b} className="flex items-start gap-2">
                    <Check
                      className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400/90"
                      strokeWidth={2}
                    />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-border/60 bg-card/30 p-6">
              <div className="font-medium text-foreground text-sm">
                Pick {props.competitorName} if…
              </div>
              <ul className="mt-4 space-y-2 text-sm text-foreground/90">
                {props.tldr.competitor.map((b) => (
                  <li key={b} className="flex items-start gap-2">
                    <Check
                      className="mt-0.5 h-4 w-4 shrink-0 text-amber-400/90"
                      strokeWidth={2}
                    />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-7xl px-6 pb-20 md:px-12">
        <div className="border-t border-border/60 pt-10">
          <div className="text-[11px] text-muted-foreground uppercase tracking-[0.25em]">
            Side-by-side
          </div>
          <div className="mt-6 overflow-x-auto rounded-xl border border-border/60">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-card/30 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  <th className="px-4 py-3 font-normal">Feature</th>
                  <th className="px-4 py-3 font-normal">Orbit</th>
                  <th className="px-4 py-3 font-normal">{props.competitorName}</th>
                </tr>
              </thead>
              <tbody>
                {props.sections.map((section) => (
                  <Fragment key={section.heading}>
                    <tr className="border-t border-border/60 bg-muted/20">
                      <td
                        colSpan={3}
                        className="px-4 py-2 text-[10px] uppercase tracking-[0.25em] text-muted-foreground"
                      >
                        {section.heading}
                      </td>
                    </tr>
                    {section.rows.map((row) => (
                      <tr
                        key={`${section.heading}-${row.feature}`}
                        className="border-t border-border/60 align-top"
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium text-foreground text-sm">
                            {row.feature}
                          </div>
                          {row.detail && (
                            <div className="mt-1 text-xs text-muted-foreground">
                              {row.detail}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <CellIcon value={row.orbit} />
                        </td>
                        <td className="px-4 py-3">
                          <CellIcon value={row.competitor} />
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-4xl px-6 pb-20 md:px-12">
        <div className="border-t border-border/60 pt-10">
          <div className="text-[11px] text-muted-foreground uppercase tracking-[0.25em]">
            The verdict
          </div>
          <div className="mt-6 space-y-6 text-sm text-foreground/90 leading-relaxed">
            <p>{props.verdict.orbit}</p>
            <p>{props.verdict.competitor}</p>
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
