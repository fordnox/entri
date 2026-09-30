import { createFileRoute } from "@tanstack/react-router";
import Mdx, { frontmatter } from "@/pages/docs/integrations/audit-log.mdx";
import { DocsLayout } from "@/components/docs-layout";
import { docsRouteHead } from "@/lib/og";

export const Route = createFileRoute("/docs/integrations/audit-log")({
  head: () =>
    docsRouteHead({ ...frontmatter, path: "/docs/integrations/audit-log" }),
  component: () => (
    <DocsLayout
      kicker={frontmatter.kicker}
      title={frontmatter.title}
      description={frontmatter.description}
      path="/docs/integrations/audit-log"
    >
      <Mdx />
    </DocsLayout>
  ),
});
