import { createFileRoute } from "@tanstack/react-router";
import { WorkspacePage } from "@/components/workspace-page";
import { WorkspaceBillingPage } from "@/pages/workspace-billing/workspace-billing-page";

export const Route = createFileRoute("/d/$workspaceSlug/billing")({
  component: () => (
    <WorkspacePage>
      <WorkspaceBillingPage />
    </WorkspacePage>
  ),
});
