import { createFileRoute } from "@tanstack/react-router";
import Mdx, { frontmatter } from "@/pages/docs/deploy/api.mdx";
import { DocsLayout } from "@/components/docs-layout";
import { docsRouteHead } from "@/lib/og";

export const Route = createFileRoute("/docs/deploy/api")({
  head: () => docsRouteHead({ ...frontmatter, path: "/docs/deploy/api" }),
  component: () => (
    <DocsLayout
      kicker={frontmatter.kicker}
      title={frontmatter.title}
      description={frontmatter.description}
      path="/docs/deploy/api"
    >
      <Mdx />
    </DocsLayout>
  ),
});
