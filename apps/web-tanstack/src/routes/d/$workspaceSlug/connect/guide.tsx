import { createFileRoute } from "@tanstack/react-router";
import { WorkspacePage } from "@/components/workspace-page";
import { ConnectGuidePage } from "@/pages/connect/guide-page";

export const Route = createFileRoute("/d/$workspaceSlug/connect/guide")({
  component: () => (
    <WorkspacePage>
      <ConnectGuidePage />
    </WorkspacePage>
  ),
});
