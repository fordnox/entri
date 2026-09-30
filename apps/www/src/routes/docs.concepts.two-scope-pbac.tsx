import { createFileRoute } from "@tanstack/react-router";
import Mdx, {
  frontmatter,
} from "@/pages/docs/concepts/two-scope-pbac.mdx";
import { DocsLayout } from "@/components/docs-layout";
import { docsRouteHead } from "@/lib/og";

export const Route = createFileRoute("/docs/concepts/two-scope-pbac")({
  head: () =>
    docsRouteHead({ ...frontmatter, path: "/docs/concepts/two-scope-pbac" }),
  component: () => (
    <DocsLayout
      kicker={frontmatter.kicker}
      title={frontmatter.title}
      description={frontmatter.description}
      path="/docs/concepts/two-scope-pbac"
    >
      <Mdx />
    </DocsLayout>
  ),
});
