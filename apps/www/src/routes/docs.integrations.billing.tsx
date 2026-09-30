import { createFileRoute } from "@tanstack/react-router";
import Mdx, { frontmatter } from "@/pages/docs/integrations/billing.mdx";
import { DocsLayout } from "@/components/docs-layout";
import { docsRouteHead } from "@/lib/og";

export const Route = createFileRoute("/docs/integrations/billing")({
  head: () =>
    docsRouteHead({ ...frontmatter, path: "/docs/integrations/billing" }),
  component: () => (
    <DocsLayout
      kicker={frontmatter.kicker}
      title={frontmatter.title}
      description={frontmatter.description}
      path="/docs/integrations/billing"
    >
      <Mdx />
    </DocsLayout>
  ),
});
