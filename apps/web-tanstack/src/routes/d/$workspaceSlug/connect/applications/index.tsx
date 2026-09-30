import { createFileRoute } from "@tanstack/react-router";
import { WorkspacePage } from "@/components/workspace-page";
import { ConnectApplicationsPage } from "@/pages/connect/applications-page";

export const Route = createFileRoute("/d/$workspaceSlug/connect/applications/")({
  component: () => (
    <WorkspacePage width="wide">
      <ConnectApplicationsPage />
    </WorkspacePage>
  ),
});
