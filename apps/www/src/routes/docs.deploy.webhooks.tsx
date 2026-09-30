import { createFileRoute } from "@tanstack/react-router";
import Mdx, { frontmatter } from "@/pages/docs/deploy/webhooks.mdx";
import { DocsLayout } from "@/components/docs-layout";
import { docsRouteHead } from "@/lib/og";

export const Route = createFileRoute("/docs/deploy/webhooks")({
  head: () => docsRouteHead({ ...frontmatter, path: "/docs/deploy/webhooks" }),
  component: () => (
    <DocsLayout
      kicker={frontmatter.kicker}
      title={frontmatter.title}
      description={frontmatter.description}
      path="/docs/deploy/webhooks"
    >
      <Mdx />
    </DocsLayout>
  ),
});
