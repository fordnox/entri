import { createFileRoute } from "@tanstack/react-router";
import Mdx, { frontmatter } from "@/pages/docs/integrations/orm.mdx";
import { DocsLayout } from "@/components/docs-layout";
import { docsRouteHead } from "@/lib/og";

export const Route = createFileRoute("/docs/integrations/orm")({
  head: () =>
    docsRouteHead({ ...frontmatter, path: "/docs/integrations/orm" }),
  component: () => (
    <DocsLayout
      kicker={frontmatter.kicker}
      title={frontmatter.title}
      description={frontmatter.description}
      path="/docs/integrations/orm"
    >
      <Mdx />
    </DocsLayout>
  ),
});
