import { ConflictError, NotFoundError } from "@/kernel/errors.ts";
import type { UnitOfWork } from "@/kernel/uow.ts";
import type { WorkspaceId } from "@/workspaces/domain/workspace.ts";
import type { BillingProvider } from "./billing-provider.ts";

export interface OpenPortalCommand {
  workspaceId: WorkspaceId;
  returnUrl: string;
}

export class OpenPortalService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly provider: BillingProvider,
  ) {}

  async execute(cmd: OpenPortalCommand): Promise<{ redirectUrl: string }> {
    const customer = await this.uow.read((tx) =>
      tx.billingCustomers.findByWorkspaceId(cmd.workspaceId),
    );
    if (!customer) {
      throw new NotFoundError("billing_customer");
    }
    if (customer.provider !== this.provider.key) {
      throw new ConflictError(
        "billing.provider_mismatch",
        `workspace customer uses provider '${customer.provider}', but the current runtime is wired to '${this.provider.key}'`,
      );
    }
    return this.provider.openPortal({
      providerCustomerId: customer.providerCustomerId,
      returnUrl: cmd.returnUrl,
    });
  }
}
