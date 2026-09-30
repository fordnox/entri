import type { Clock } from "@/kernel/clock.ts";
import { stampActor } from "@/kernel/events.ts";
import type { UnitOfWork } from "@/kernel/uow.ts";
import { loadApplicationInWorkspace } from "./load.ts";
import type { ApplicationCommand } from "./update-application.service.ts";

/** Cascades to the app's domain connections and delivery log (FK on delete cascade). */
export class DeleteApplicationService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: ApplicationCommand): Promise<void> {
    await this.uow.run(async (tx) => {
      const app = await loadApplicationInWorkspace(tx, cmd.workspaceId, cmd.applicationId);
      app.markDeleted(this.clock);
      await tx.connectApplications.delete(app.id);
      tx.events.addMany(stampActor(app.pullEvents(), cmd.actorMemberId));
    });
  }
}
