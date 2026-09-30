import { createFileRoute } from "@tanstack/react-router";
import { BestNextjsSaasBoilerplates2026Page } from "@/pages/blog/best-nextjs-saas-boilerplates-2026";
import { pageHead } from "@/lib/og";

const PATH = "/blog/best-nextjs-saas-boilerplates-2026";
const TITLE =
  "The Best Next.js SaaS Boilerplates in 2026 — Honest Comparison | Orbit";
const DESCRIPTION =
  "Eight Next.js SaaS boilerplates ranked and compared on multi-tenancy, billing, auth, architecture, and price. Updated for 2026. Honest take from the Orbit team.";

export const Route = createFileRoute(
  "/blog/best-nextjs-saas-boilerplates-2026",
)({
  head: () =>
    pageHead({
      title: TITLE,
      description: DESCRIPTION,
      path: PATH,
    }),
  component: BestNextjsSaasBoilerplates2026Page,
});
