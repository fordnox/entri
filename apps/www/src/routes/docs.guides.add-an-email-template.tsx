import { createFileRoute } from "@tanstack/react-router";
import Mdx, { frontmatter } from "@/pages/docs/guides/add-an-email-template.mdx";
import { DocsLayout } from "@/components/docs-layout";
import { docsRouteHead } from "@/lib/og";

export const Route = createFileRoute("/docs/guides/add-an-email-template")({
  head: () => docsRouteHead({ ...frontmatter, path: "/docs/guides/add-an-email-template" }),
  component: () => (
    <DocsLayout
      kicker={frontmatter.kicker}
      title={frontmatter.title}
      description={frontmatter.description}
      path="/docs/guides/add-an-email-template"
    >
      <Mdx />
    </DocsLayout>
  ),
});
