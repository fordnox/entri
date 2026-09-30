import { createFileRoute } from "@tanstack/react-router";
import Mdx, {
  frontmatter,
} from "@/pages/docs/concepts/bounded-contexts.mdx";
import { DocsLayout } from "@/components/docs-layout";
import { docsRouteHead } from "@/lib/og";

export const Route = createFileRoute("/docs/concepts/bounded-contexts")({
  head: () =>
    docsRouteHead({ ...frontmatter, path: "/docs/concepts/bounded-contexts" }),
  component: () => (
    <DocsLayout
      kicker={frontmatter.kicker}
      title={frontmatter.title}
      description={frontmatter.description}
      path="/docs/concepts/bounded-contexts"
    >
      <Mdx />
    </DocsLayout>
  ),
});
