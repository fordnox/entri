import type { DomainConnectionStatus } from "@orbit/shared/connect";
import { ValidationError } from "@/kernel/errors.ts";
import { isId } from "@/kernel/id.ts";
import type { UnitOfWork } from "@/kernel/uow.ts";
import type { WorkspaceId } from "@/workspaces/domain/workspace.ts";
import type { ConnectApplicationId } from "../domain/application.ts";
import type { DomainConnection, DomainConnectionId } from "../domain/domain-connection.ts";
import { type ConnectionScope, loadConnectionInScope } from "./load.ts";

const PAGE_SIZE = 50;

export interface ConnectionWithAppName {
  connection: DomainConnection;
  applicationName: string;
}

function encodeCursor(c: DomainConnection): string {
  const s = c.snapshot();
  return Buffer.from(`${s.createdAt.toISOString()}|${s.id}`).toString("base64url");
}

function decodeCursor(raw: string): { createdAt: Date; id: DomainConnectionId } {
  const [at, id] = Buffer.from(raw, "base64url").toString("utf8").split("|");
  const createdAt = new Date(at ?? "");
  if (!id || !isId("domainConnection", id) || Number.isNaN(createdAt.getTime())) {
    throw new ValidationError("cursor.invalid", "invalid cursor");
  }
  return { createdAt, id: id as DomainConnectionId };
}

export class ListDomainConnectionsService {
  constructor(private readonly uow: UnitOfWork) {}

  async execute(input: {
    workspaceId: WorkspaceId;
    applicationId?: string;
    status?: DomainConnectionStatus;
    q?: string;
    cursor?: string;
  }): Promise<{ items: ConnectionWithAppName[]; nextCursor: string | null }> {
    return this.uow.read(async (tx) => {
      const apps = await tx.connectApplications.listForWorkspace(input.workspaceId);
      const names = new Map<string, string>(apps.map((a) => [a.application.id, a.application.name]));
      if (input.applicationId && !names.has(input.applicationId)) {
        return { items: [], nextCursor: null };
      }
      const rows = await tx.domainConnections.list({
        workspaceId: input.workspaceId,
        applicationId: input.applicationId as ConnectApplicationId | undefined,
        status: input.status,
        q: input.q,
        cursor: input.cursor ? decodeCursor(input.cursor) : undefined,
        limit: PAGE_SIZE + 1,
      });
      const page = rows.slice(0, PAGE_SIZE);
      return {
        items: page.map((connection) => ({
          connection,
          applicationName: names.get(connection.applicationId) ?? "",
        })),
        nextCursor: rows.length > PAGE_SIZE ? encodeCursor(page[page.length - 1]!) : null,
      };
    });
  }

  async get(scope: ConnectionScope, connectionId: string): Promise<ConnectionWithAppName> {
    return this.uow.read(async (tx) => {
      const connection = await loadConnectionInScope(tx, scope, connectionId);
      const app = await tx.connectApplications.findById(connection.applicationId);
      return { connection, applicationName: app?.name ?? "" };
    });
  }
}
