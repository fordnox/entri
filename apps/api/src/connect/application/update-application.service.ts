import type { Clock } from "@/kernel/clock.ts";
import { stampActor } from "@/kernel/events.ts";
import type { UnitOfWork } from "@/kernel/uow.ts";
import type { WorkspaceMemberId } from "@/workspaces/domain/workspace-member.ts";
import type { WorkspaceId } from "@/workspaces/domain/workspace.ts";
import type { ApplicationSettings } from "../domain/application.ts";
import type { ApplicationWithDomainCount } from "../domain/repositories.ts";
import { loadApplicationInWorkspace } from "./load.ts";
import { assertWebhookUrlAllowed } from "./webhook-url-policy.ts";

export interface ApplicationCommand {
  workspaceId: WorkspaceId;
  applicationId: string;
  actorMemberId: WorkspaceMemberId | null;
}

export class UpdateApplicationService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly clock: Clock,
    private readonly opts: { production: boolean },
  ) {}

  async execute(
    cmd: ApplicationCommand & { settings: ApplicationSettings },
  ): Promise<ApplicationWithDomainCount> {
    return this.uow.run(async (tx) => {
      const app = await loadApplicationInWorkspace(tx, cmd.workspaceId, cmd.applicationId);
      app.update(cmd.settings, this.clock);
      assertWebhookUrlAllowed(app.webhookUrl, this.opts);
      await tx.connectApplications.save(app);
      tx.events.addMany(stampActor(app.pullEvents(), cmd.actorMemberId));
      return { application: app, domainCount: await tx.connectApplications.countDomains(app.id) };
    });
  }
}
