import { createFileRoute } from "@tanstack/react-router";
import Mdx, { frontmatter } from "@/pages/docs/integrations/uploads.mdx";
import { DocsLayout } from "@/components/docs-layout";
import { docsRouteHead } from "@/lib/og";

export const Route = createFileRoute("/docs/integrations/uploads")({
  head: () =>
    docsRouteHead({ ...frontmatter, path: "/docs/integrations/uploads" }),
  component: () => (
    <DocsLayout
      kicker={frontmatter.kicker}
      title={frontmatter.title}
      description={frontmatter.description}
      path="/docs/integrations/uploads"
    >
      <Mdx />
    </DocsLayout>
  ),
});
