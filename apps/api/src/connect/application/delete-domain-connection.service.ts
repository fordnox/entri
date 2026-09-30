import type { Clock } from "@/kernel/clock.ts";
import type { UnitOfWork } from "@/kernel/uow.ts";
import type { WorkspaceId } from "@/workspaces/domain/workspace.ts";
import { loadConnectionInScope } from "./load.ts";

/**
 * Forgets the connection and tells the integrator via
 * `domain.disconnected`. DNS records on the user's side are left alone —
 * we don't hold credentials to remove them.
 */
export class DeleteDomainConnectionService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly clock: Clock,
  ) {}

  async execute(workspaceId: WorkspaceId, connectionId: string): Promise<void> {
    await this.uow.run(async (tx) => {
      const conn = await loadConnectionInScope(tx, { workspaceId }, connectionId);
      conn.markDeleted(this.clock);
      await tx.domainConnections.delete(conn.id);
      tx.events.addMany(conn.pullEvents());
    });
  }
}
