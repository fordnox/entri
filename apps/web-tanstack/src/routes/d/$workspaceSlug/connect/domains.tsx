import { createFileRoute } from "@tanstack/react-router";
import type { DomainConnectionStatus } from "@orbit/shared/connect";
import { WorkspacePage } from "@/components/workspace-page";
import { ConnectDomainsPage, type DomainsSearch } from "@/pages/connect/domains-page";

const STATUSES: readonly DomainConnectionStatus[] = ["pending", "propagating", "connected", "failed"];

export const Route = createFileRoute("/d/$workspaceSlug/connect/domains")({
  validateSearch: (search: Record<string, unknown>): DomainsSearch => ({
    applicationId:
      typeof search.applicationId === "string" && search.applicationId
        ? search.applicationId
        : undefined,
    status: STATUSES.includes(search.status as DomainConnectionStatus)
      ? (search.status as DomainConnectionStatus)
      : undefined,
  }),
  component: DomainsRoute,
});

function DomainsRoute() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <WorkspacePage width="full">
      <ConnectDomainsPage
        search={search}
        onSearchChange={(next) => void navigate({ search: next, replace: true })}
      />
    </WorkspacePage>
  );
}
