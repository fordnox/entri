import { NotFoundError } from "@/kernel/errors.ts";
import { isId } from "@/kernel/id.ts";
import type { TxContext } from "@/kernel/uow.ts";
import type { WorkspaceId } from "@/workspaces/domain/workspace.ts";
import type { ConnectApplication, ConnectApplicationId } from "../domain/application.ts";
import type { DomainConnection, DomainConnectionId } from "../domain/domain-connection.ts";

/**
 * Tenant-scoped loaders. A row that exists but belongs to another
 * workspace/application is reported as not found, so ids can't be
 * probed across tenants.
 */
export async function loadApplicationInWorkspace(
  tx: TxContext,
  workspaceId: WorkspaceId,
  applicationId: string,
): Promise<ConnectApplication> {
  const app = isId("connectApplication", applicationId)
    ? await tx.connectApplications.findById(applicationId as ConnectApplicationId)
    : null;
  if (!app || app.workspaceId !== workspaceId) throw new NotFoundError("application");
  return app;
}

export type ConnectionScope =
  | { applicationId: ConnectApplicationId }
  | { workspaceId: WorkspaceId };

export async function loadConnectionInScope(
  tx: TxContext,
  scope: ConnectionScope,
  connectionId: string,
): Promise<DomainConnection> {
  const conn = isId("domainConnection", connectionId)
    ? await tx.domainConnections.findById(connectionId as DomainConnectionId)
    : null;
  const inScope =
    conn &&
    ("applicationId" in scope
      ? conn.applicationId === scope.applicationId
      : conn.workspaceId === scope.workspaceId);
  if (!conn || !inScope) throw new NotFoundError("connection");
  return conn;
}
