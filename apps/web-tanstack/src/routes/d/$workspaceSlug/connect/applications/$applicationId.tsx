import { createFileRoute } from "@tanstack/react-router";
import { WorkspacePage } from "@/components/workspace-page";
import { ConnectApplicationDetailPage } from "@/pages/connect/application-detail-page";

export const Route = createFileRoute("/d/$workspaceSlug/connect/applications/$applicationId")({
  component: ApplicationDetailRoute,
});

function ApplicationDetailRoute() {
  const { applicationId } = Route.useParams();
  return (
    <WorkspacePage width="wide">
      <ConnectApplicationDetailPage key={applicationId} applicationId={applicationId} />
    </WorkspacePage>
  );
}
