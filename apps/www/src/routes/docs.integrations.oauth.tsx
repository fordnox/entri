import { createFileRoute } from "@tanstack/react-router";
import Mdx, { frontmatter } from "@/pages/docs/integrations/oauth.mdx";
import { DocsLayout } from "@/components/docs-layout";
import { docsRouteHead } from "@/lib/og";

export const Route = createFileRoute("/docs/integrations/oauth")({
  head: () =>
    docsRouteHead({ ...frontmatter, path: "/docs/integrations/oauth" }),
  component: () => (
    <DocsLayout
      kicker={frontmatter.kicker}
      title={frontmatter.title}
      description={frontmatter.description}
      path="/docs/integrations/oauth"
    >
      <Mdx />
    </DocsLayout>
  ),
});
