import type { Clock } from "@/kernel/clock.ts";
import { NotFoundError, ValidationError } from "@/kernel/errors.ts";
import type { UnitOfWork } from "@/kernel/uow.ts";
import type { WorkspaceId } from "@/workspaces/domain/workspace.ts";
import { BillingCustomer } from "../domain/billing-customer.ts";
import type { BillingCatalog } from "./billing-catalog.ts";
import type { BillingProvider } from "./billing-provider.ts";

export interface StartCheckoutCommand {
  workspaceId: WorkspaceId;
  planKey: string;
  actorEmail: string;
  successUrl: string;
  cancelUrl: string;
}

export interface StartCheckoutResult {
  redirectUrl: string;
  sessionId: string;
}

export class StartCheckoutService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly clock: Clock,
    private readonly provider: BillingProvider,
    private readonly catalog: BillingCatalog,
  ) {}

  async execute(cmd: StartCheckoutCommand): Promise<StartCheckoutResult> {
    const plan = this.catalog.findByKey(cmd.planKey);
    if (!plan) {
      throw new ValidationError(
        "billing.unknown_plan",
        `unknown plan: ${cmd.planKey}`,
      );
    }

    // Ensure a provider customer exists; persist it inside a uow.run so
    // the BillingCustomer row is atomic with whatever else the caller
    // may do (none today, but the boundary stays clean).
    const customer = await this.uow.run(async (tx) => {
      const workspace = await tx.workspaces.findById(cmd.workspaceId);
      if (!workspace) throw new NotFoundError("workspace");

      const existing = await tx.billingCustomers.findByWorkspaceId(
        cmd.workspaceId,
      );
      if (existing && existing.provider === this.provider.key) {
        return existing;
      }

      const created = await this.provider.createCustomer({
        workspaceId: cmd.workspaceId,
        email: cmd.actorEmail,
        name: workspace.name,
        metadata: {
          workspaceId: cmd.workspaceId,
          workspaceSlug: workspace.slug.value,
        },
      });
      const row = BillingCustomer.register(
        {
          workspaceId: cmd.workspaceId,
          provider: this.provider.key,
          providerCustomerId: created.id,
        },
        this.clock,
      );
      await tx.billingCustomers.save(row);
      return row;
    });

    const { redirectUrl, sessionId } = await this.provider.startCheckout({
      workspaceId: cmd.workspaceId,
      providerCustomerId: customer.providerCustomerId,
      priceId: plan.priceId,
      successUrl: cmd.successUrl,
      cancelUrl: cmd.cancelUrl,
    });

    return { redirectUrl, sessionId };
  }
}
