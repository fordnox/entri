import { NotFoundError } from "@/kernel/errors.ts";
import type { UnitOfWork } from "@/kernel/uow.ts";
import type { WorkspaceId } from "@/workspaces/domain/workspace.ts";
import type { BillingProvider } from "./billing-provider.ts";

export interface CancelSubscriptionCommand {
  workspaceId: WorkspaceId;
  atPeriodEnd: boolean;
}

export class CancelSubscriptionService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly provider: BillingProvider,
  ) {}

  async execute(cmd: CancelSubscriptionCommand): Promise<void> {
    const sub = await this.uow.read((tx) =>
      tx.subscriptions.findByWorkspaceId(cmd.workspaceId),
    );
    if (!sub) throw new NotFoundError("subscription");
    // The provider is the source of truth. We tell the provider to
    // cancel and wait for the webhook to update our row; that way the
    // DB is never ahead of the provider (the risky direction).
    await this.provider.cancelSubscription({
      providerSubscriptionId: sub.providerSubscriptionId,
      atPeriodEnd: cmd.atPeriodEnd,
    });
  }
}
