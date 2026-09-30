import { createFileRoute } from "@tanstack/react-router";
import Mdx, { frontmatter } from "@/pages/docs/deploy/web.mdx";
import { DocsLayout } from "@/components/docs-layout";
import { docsRouteHead } from "@/lib/og";

export const Route = createFileRoute("/docs/deploy/web")({
  head: () => docsRouteHead({ ...frontmatter, path: "/docs/deploy/web" }),
  component: () => (
    <DocsLayout
      kicker={frontmatter.kicker}
      title={frontmatter.title}
      description={frontmatter.description}
      path="/docs/deploy/web"
    >
      <Mdx />
    </DocsLayout>
  ),
});
