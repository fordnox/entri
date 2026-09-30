// +feature:billing
import { and, eq } from "drizzle-orm";
import { billingCustomers } from "@/db/drizzle/schema.ts";
import type { Drizzle } from "@/infrastructure/drizzle.ts";
import type { WorkspaceId } from "@/workspaces/domain/workspace.ts";
import {
  BillingCustomer,
  type BillingCustomerId,
} from "../domain/billing-customer.ts";
import type { BillingCustomerRepository } from "../domain/repositories.ts";

type Row = {
  id: string;
  workspaceId: string;
  provider: string;
  providerCustomerId: string;
  createdAt: Date;
  updatedAt: Date;
};

function toDomain(row: Row): BillingCustomer {
  return BillingCustomer.rehydrate({
    id: row.id as BillingCustomerId,
    workspaceId: row.workspaceId as WorkspaceId,
    provider: row.provider,
    providerCustomerId: row.providerCustomerId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

export class DrizzleBillingCustomerRepository
  implements BillingCustomerRepository
{
  constructor(private readonly db: Drizzle) {}

  async findByWorkspaceId(
    workspaceId: WorkspaceId,
  ): Promise<BillingCustomer | null> {
    const [row] = await this.db
      .select()
      .from(billingCustomers)
      .where(eq(billingCustomers.workspaceId, workspaceId))
      .limit(1);
    return row ? toDomain(row) : null;
  }

  async findByProviderCustomerId(
    provider: string,
    providerCustomerId: string,
  ): Promise<BillingCustomer | null> {
    const [row] = await this.db
      .select()
      .from(billingCustomers)
      .where(
        and(
          eq(billingCustomers.provider, provider),
          eq(billingCustomers.providerCustomerId, providerCustomerId),
        ),
      )
      .limit(1);
    return row ? toDomain(row) : null;
  }

  async findById(id: BillingCustomerId): Promise<BillingCustomer | null> {
    const [row] = await this.db
      .select()
      .from(billingCustomers)
      .where(eq(billingCustomers.id, id))
      .limit(1);
    return row ? toDomain(row) : null;
  }

  async save(customer: BillingCustomer): Promise<void> {
    await this.db
      .insert(billingCustomers)
      .values({
        id: customer.id,
        workspaceId: customer.workspaceId,
        provider: customer.provider,
        providerCustomerId: customer.providerCustomerId,
        createdAt: customer.createdAt,
        updatedAt: customer.updatedAt,
      })
      .onConflictDoUpdate({
        target: billingCustomers.id,
        set: {
          providerCustomerId: customer.providerCustomerId,
          updatedAt: customer.updatedAt,
        },
      });
  }
}
// -feature:billing
