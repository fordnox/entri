import { createFileRoute } from "@tanstack/react-router";
import Mdx, {
  frontmatter,
} from "@/pages/docs/getting-started/prerequisites.mdx";
import { DocsLayout } from "@/components/docs-layout";
import { docsRouteHead } from "@/lib/og";

export const Route = createFileRoute("/docs/getting-started/prerequisites")({
  head: () =>
    docsRouteHead({
      ...frontmatter,
      path: "/docs/getting-started/prerequisites",
    }),
  component: () => (
    <DocsLayout
      kicker={frontmatter.kicker}
      title={frontmatter.title}
      description={frontmatter.description}
      path="/docs/getting-started/prerequisites"
    >
      <Mdx />
    </DocsLayout>
  ),
});
