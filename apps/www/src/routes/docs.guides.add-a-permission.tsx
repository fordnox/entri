import { createFileRoute } from "@tanstack/react-router";
import Mdx, { frontmatter } from "@/pages/docs/guides/add-a-permission.mdx";
import { DocsLayout } from "@/components/docs-layout";
import { docsRouteHead } from "@/lib/og";

export const Route = createFileRoute("/docs/guides/add-a-permission")({
  head: () => docsRouteHead({ ...frontmatter, path: "/docs/guides/add-a-permission" }),
  component: () => (
    <DocsLayout
      kicker={frontmatter.kicker}
      title={frontmatter.title}
      description={frontmatter.description}
      path="/docs/guides/add-a-permission"
    >
      <Mdx />
    </DocsLayout>
  ),
});
