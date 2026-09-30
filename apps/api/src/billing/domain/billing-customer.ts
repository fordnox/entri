import type { Clock } from "@/kernel/clock.ts";
import { type Id, newId } from "@/kernel/id.ts";
import type { WorkspaceId } from "@/workspaces/domain/workspace.ts";

export type BillingCustomerId = Id<"billingCustomer">;

export class BillingCustomer {
  private constructor(
    public readonly id: BillingCustomerId,
    public readonly workspaceId: WorkspaceId,
    public readonly provider: string,
    public readonly providerCustomerId: string,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  static register(
    input: {
      workspaceId: WorkspaceId;
      provider: string;
      providerCustomerId: string;
    },
    clock: Clock,
  ): BillingCustomer {
    const now = clock.now();
    return new BillingCustomer(
      newId("billingCustomer"),
      input.workspaceId,
      input.provider,
      input.providerCustomerId,
      now,
      now,
    );
  }

  static rehydrate(props: {
    id: BillingCustomerId;
    workspaceId: WorkspaceId;
    provider: string;
    providerCustomerId: string;
    createdAt: Date;
    updatedAt: Date;
  }): BillingCustomer {
    return new BillingCustomer(
      props.id,
      props.workspaceId,
      props.provider,
      props.providerCustomerId,
      props.createdAt,
      props.updatedAt,
    );
  }
}
