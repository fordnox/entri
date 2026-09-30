import { createFileRoute } from "@tanstack/react-router";
import Mdx, { frontmatter } from "@/pages/docs/guides/add-a-bounded-context.mdx";
import { DocsLayout } from "@/components/docs-layout";
import { docsRouteHead } from "@/lib/og";

export const Route = createFileRoute("/docs/guides/add-a-bounded-context")({
  head: () => docsRouteHead({ ...frontmatter, path: "/docs/guides/add-a-bounded-context" }),
  component: () => (
    <DocsLayout
      kicker={frontmatter.kicker}
      title={frontmatter.title}
      description={frontmatter.description}
      path="/docs/guides/add-a-bounded-context"
    >
      <Mdx />
    </DocsLayout>
  ),
});
