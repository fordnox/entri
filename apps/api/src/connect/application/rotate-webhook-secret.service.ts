import type { Clock } from "@/kernel/clock.ts";
import { stampActor } from "@/kernel/events.ts";
import type { UnitOfWork } from "@/kernel/uow.ts";
import type { ApplicationWithDomainCount } from "../domain/repositories.ts";
import { loadApplicationInWorkspace } from "./load.ts";
import type { ApplicationCommand } from "./update-application.service.ts";

export class RotateWebhookSecretService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: ApplicationCommand): Promise<ApplicationWithDomainCount> {
    return this.uow.run(async (tx) => {
      const app = await loadApplicationInWorkspace(tx, cmd.workspaceId, cmd.applicationId);
      app.rotateWebhookSecret(this.clock);
      await tx.connectApplications.save(app);
      tx.events.addMany(stampActor(app.pullEvents(), cmd.actorMemberId));
      return { application: app, domainCount: await tx.connectApplications.countDomains(app.id) };
    });
  }
}
