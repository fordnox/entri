import { createFileRoute } from "@tanstack/react-router";
import Mdx, { frontmatter } from "@/pages/docs/guides/add-a-plan.mdx";
import { DocsLayout } from "@/components/docs-layout";
import { docsRouteHead } from "@/lib/og";

export const Route = createFileRoute("/docs/guides/add-a-plan")({
  head: () => docsRouteHead({ ...frontmatter, path: "/docs/guides/add-a-plan" }),
  component: () => (
    <DocsLayout
      kicker={frontmatter.kicker}
      title={frontmatter.title}
      description={frontmatter.description}
      path="/docs/guides/add-a-plan"
    >
      <Mdx />
    </DocsLayout>
  ),
});
