import { createFileRoute } from "@tanstack/react-router";
import Mdx, { frontmatter } from "@/pages/docs/concepts/unit-of-work.mdx";
import { DocsLayout } from "@/components/docs-layout";
import { docsRouteHead } from "@/lib/og";

export const Route = createFileRoute("/docs/concepts/unit-of-work")({
  head: () =>
    docsRouteHead({ ...frontmatter, path: "/docs/concepts/unit-of-work" }),
  component: () => (
    <DocsLayout
      kicker={frontmatter.kicker}
      title={frontmatter.title}
      description={frontmatter.description}
      path="/docs/concepts/unit-of-work"
    >
      <Mdx />
    </DocsLayout>
  ),
});
