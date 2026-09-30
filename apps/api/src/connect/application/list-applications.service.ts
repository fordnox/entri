import type { UnitOfWork } from "@/kernel/uow.ts";
import type { WorkspaceId } from "@/workspaces/domain/workspace.ts";
import type { ApplicationWithDomainCount } from "../domain/repositories.ts";
import type { WebhookDelivery } from "../domain/webhook-delivery.ts";
import { loadApplicationInWorkspace } from "./load.ts";

export class ListApplicationsService {
  constructor(private readonly uow: UnitOfWork) {}

  async execute(workspaceId: WorkspaceId): Promise<ApplicationWithDomainCount[]> {
    return this.uow.read((tx) => tx.connectApplications.listForWorkspace(workspaceId));
  }

  async get(workspaceId: WorkspaceId, applicationId: string): Promise<ApplicationWithDomainCount> {
    return this.uow.read(async (tx) => {
      const app = await loadApplicationInWorkspace(tx, workspaceId, applicationId);
      return { application: app, domainCount: await tx.connectApplications.countDomains(app.id) };
    });
  }

  async deliveries(workspaceId: WorkspaceId, applicationId: string): Promise<WebhookDelivery[]> {
    return this.uow.read(async (tx) => {
      const app = await loadApplicationInWorkspace(tx, workspaceId, applicationId);
      return tx.webhookDeliveries.listForApplication(app.id, 50);
    });
  }
}
