import type { Clock } from "@/kernel/clock.ts";
import { stampActor } from "@/kernel/events.ts";
import type { UnitOfWork } from "@/kernel/uow.ts";
import type { ApplicationWithDomainCount } from "../domain/repositories.ts";
import { loadApplicationInWorkspace } from "./load.ts";
import type { ApplicationCommand } from "./update-application.service.ts";

/** Rotating bumps `secretVersion`, which revokes every outstanding SDK token. */
export class RotateApplicationSecretService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: ApplicationCommand): Promise<ApplicationWithDomainCount & { secret: string }> {
    return this.uow.run(async (tx) => {
      const app = await loadApplicationInWorkspace(tx, cmd.workspaceId, cmd.applicationId);
      const secret = app.rotateSecret(this.clock);
      await tx.connectApplications.save(app);
      tx.events.addMany(stampActor(app.pullEvents(), cmd.actorMemberId));
      return {
        application: app,
        secret,
        domainCount: await tx.connectApplications.countDomains(app.id),
      };
    });
  }
}
