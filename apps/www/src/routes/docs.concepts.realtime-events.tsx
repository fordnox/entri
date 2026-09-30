import { createFileRoute } from "@tanstack/react-router";
import Mdx, {
  frontmatter,
} from "@/pages/docs/concepts/realtime-events.mdx";
import { DocsLayout } from "@/components/docs-layout";
import { docsRouteHead } from "@/lib/og";

export const Route = createFileRoute("/docs/concepts/realtime-events")({
  head: () =>
    docsRouteHead({ ...frontmatter, path: "/docs/concepts/realtime-events" }),
  component: () => (
    <DocsLayout
      kicker={frontmatter.kicker}
      title={frontmatter.title}
      description={frontmatter.description}
      path="/docs/concepts/realtime-events"
    >
      <Mdx />
    </DocsLayout>
  ),
});
