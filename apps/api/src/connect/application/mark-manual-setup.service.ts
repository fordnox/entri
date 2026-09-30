import type { Clock } from "@/kernel/clock.ts";
import type { UnitOfWork } from "@/kernel/uow.ts";
import type { ConnectApplicationId } from "../domain/application.ts";
import type { DomainConnection } from "../domain/domain-connection.ts";
import { loadConnectionInScope } from "./load.ts";

export class MarkManualSetupService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly clock: Clock,
    /** Dev-only sandbox hook that "types in" the records for `.test` domains. */
    private readonly onManualSetup?: (conn: DomainConnection) => void,
  ) {}

  async execute(cmd: {
    applicationId: ConnectApplicationId;
    connectionId: string;
  }): Promise<DomainConnection> {
    const conn = await this.uow.run(async (tx) => {
      const c = await loadConnectionInScope(
        tx,
        { applicationId: cmd.applicationId },
        cmd.connectionId,
      );
      c.markManualSetup(this.clock);
      await tx.domainConnections.save(c);
      tx.events.addMany(c.pullEvents());
      return c;
    });
    this.onManualSetup?.(conn);
    return conn;
  }
}
