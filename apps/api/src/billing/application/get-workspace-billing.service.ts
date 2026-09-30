import type { UnitOfWork } from "@/kernel/uow.ts";
import type { WorkspaceId } from "@/workspaces/domain/workspace.ts";
import type { BillingCustomer } from "../domain/billing-customer.ts";
import type { BillingPlan } from "../domain/billing-plan.ts";
import type { Subscription } from "../domain/subscription.ts";
import type { BillingCatalog } from "./billing-catalog.ts";

export interface WorkspaceBillingView {
  customer: BillingCustomer | null;
  subscription: Subscription | null;
  availablePlans: readonly BillingPlan[];
}

export class GetWorkspaceBillingService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly catalog: BillingCatalog,
  ) {}

  async execute(workspaceId: WorkspaceId): Promise<WorkspaceBillingView> {
    return this.uow.read(async (tx) => {
      const customer = await tx.billingCustomers.findByWorkspaceId(workspaceId);
      const subscription = await tx.subscriptions.findByWorkspaceId(workspaceId);
      return {
        customer,
        subscription,
        availablePlans: this.catalog.list(),
      };
    });
  }
}
