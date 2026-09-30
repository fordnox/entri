import { createFileRoute } from "@tanstack/react-router";
import Mdx, { frontmatter } from "@/pages/docs/getting-started/dev-server.mdx";
import { DocsLayout } from "@/components/docs-layout";
import { docsRouteHead } from "@/lib/og";

export const Route = createFileRoute("/docs/getting-started/dev-server")({
  head: () =>
    docsRouteHead({ ...frontmatter, path: "/docs/getting-started/dev-server" }),
  component: () => (
    <DocsLayout
      kicker={frontmatter.kicker}
      title={frontmatter.title}
      description={frontmatter.description}
      path="/docs/getting-started/dev-server"
    >
      <Mdx />
    </DocsLayout>
  ),
});
