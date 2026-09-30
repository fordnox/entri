import { createFileRoute } from "@tanstack/react-router";
import { WorkspacePage } from "@/components/workspace-page";
import { ConnectPlaygroundPage } from "@/pages/connect/playground-page";

export const Route = createFileRoute("/d/$workspaceSlug/connect/playground")({
  validateSearch: (search: Record<string, unknown>): { applicationId?: string } => ({
    applicationId:
      typeof search.applicationId === "string" && search.applicationId
        ? search.applicationId
        : undefined,
  }),
  component: PlaygroundRoute,
});

function PlaygroundRoute() {
  const { applicationId } = Route.useSearch();
  return (
    <WorkspacePage width="wide">
      <ConnectPlaygroundPage initialApplicationId={applicationId} />
    </WorkspacePage>
  );
}
