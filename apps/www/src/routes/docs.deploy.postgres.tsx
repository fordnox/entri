import { createFileRoute } from "@tanstack/react-router";
import Mdx, { frontmatter } from "@/pages/docs/deploy/postgres.mdx";
import { DocsLayout } from "@/components/docs-layout";
import { docsRouteHead } from "@/lib/og";

export const Route = createFileRoute("/docs/deploy/postgres")({
  head: () => docsRouteHead({ ...frontmatter, path: "/docs/deploy/postgres" }),
  component: () => (
    <DocsLayout
      kicker={frontmatter.kicker}
      title={frontmatter.title}
      description={frontmatter.description}
      path="/docs/deploy/postgres"
    >
      <Mdx />
    </DocsLayout>
  ),
});
