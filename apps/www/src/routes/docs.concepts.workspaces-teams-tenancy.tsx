import { createFileRoute } from "@tanstack/react-router";
import Mdx, {
  frontmatter,
} from "@/pages/docs/concepts/workspaces-teams-tenancy.mdx";
import { DocsLayout } from "@/components/docs-layout";
import { docsRouteHead } from "@/lib/og";

export const Route = createFileRoute("/docs/concepts/workspaces-teams-tenancy")(
  {
    head: () =>
      docsRouteHead({
        ...frontmatter,
        path: "/docs/concepts/workspaces-teams-tenancy",
      }),
    component: () => (
      <DocsLayout
        kicker={frontmatter.kicker}
        title={frontmatter.title}
        description={frontmatter.description}
        path="/docs/concepts/workspaces-teams-tenancy"
      >
        <Mdx />
      </DocsLayout>
    ),
  },
);
