import { createFileRoute } from "@tanstack/react-router";
import Mdx, {
  frontmatter,
} from "@/pages/docs/getting-started/quickstart.mdx";
import { DocsLayout } from "@/components/docs-layout";
import { docsRouteHead } from "@/lib/og";

export const Route = createFileRoute("/docs/getting-started/quickstart")({
  head: () =>
    docsRouteHead({ ...frontmatter, path: "/docs/getting-started/quickstart" }),
  component: () => (
    <DocsLayout
      kicker={frontmatter.kicker}
      title={frontmatter.title}
      description={frontmatter.description}
      path="/docs/getting-started/quickstart"
    >
      <Mdx />
    </DocsLayout>
  ),
});
