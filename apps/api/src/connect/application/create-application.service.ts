import type { Clock } from "@/kernel/clock.ts";
import { stampActor } from "@/kernel/events.ts";
import type { UnitOfWork } from "@/kernel/uow.ts";
import type { WorkspaceMemberId } from "@/workspaces/domain/workspace-member.ts";
import type { WorkspaceId } from "@/workspaces/domain/workspace.ts";
import { ConnectApplication, type ApplicationSettings } from "../domain/application.ts";
import { assertWebhookUrlAllowed } from "./webhook-url-policy.ts";

export interface CreateApplicationCommand {
  workspaceId: WorkspaceId;
  actorMemberId: WorkspaceMemberId | null;
  settings: ApplicationSettings & { name: string };
}

export class CreateApplicationService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly clock: Clock,
    private readonly opts: { production: boolean },
  ) {}

  async execute(
    cmd: CreateApplicationCommand,
  ): Promise<{ application: ConnectApplication; secret: string }> {
    return this.uow.run(async (tx) => {
      const created = ConnectApplication.create(
        { workspaceId: cmd.workspaceId, ...cmd.settings },
        this.clock,
      );
      assertWebhookUrlAllowed(created.application.webhookUrl, this.opts);
      await tx.connectApplications.save(created.application);
      tx.events.addMany(stampActor(created.application.pullEvents(), cmd.actorMemberId));
      return created;
    });
  }
}
