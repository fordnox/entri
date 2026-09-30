import { createFileRoute } from "@tanstack/react-router";
import Mdx, { frontmatter } from "@/pages/docs/guides/write-a-job.mdx";
import { DocsLayout } from "@/components/docs-layout";
import { docsRouteHead } from "@/lib/og";

export const Route = createFileRoute("/docs/guides/write-a-job")({
  head: () => docsRouteHead({ ...frontmatter, path: "/docs/guides/write-a-job" }),
  component: () => (
    <DocsLayout
      kicker={frontmatter.kicker}
      title={frontmatter.title}
      description={frontmatter.description}
      path="/docs/guides/write-a-job"
    >
      <Mdx />
    </DocsLayout>
  ),
});
