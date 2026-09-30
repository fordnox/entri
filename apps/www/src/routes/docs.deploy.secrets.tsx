import { createFileRoute } from "@tanstack/react-router";
import Mdx, { frontmatter } from "@/pages/docs/deploy/secrets.mdx";
import { DocsLayout } from "@/components/docs-layout";
import { docsRouteHead } from "@/lib/og";

export const Route = createFileRoute("/docs/deploy/secrets")({
  head: () => docsRouteHead({ ...frontmatter, path: "/docs/deploy/secrets" }),
  component: () => (
    <DocsLayout
      kicker={frontmatter.kicker}
      title={frontmatter.title}
      description={frontmatter.description}
      path="/docs/deploy/secrets"
    >
      <Mdx />
    </DocsLayout>
  ),
});
