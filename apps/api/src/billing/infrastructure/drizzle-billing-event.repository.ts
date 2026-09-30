// +feature:billing
import { and, eq } from "drizzle-orm";
import { billingEvents } from "@/db/drizzle/schema.ts";
import type { Drizzle } from "@/infrastructure/drizzle.ts";
import type { WorkspaceId } from "@/workspaces/domain/workspace.ts";
import type {
  BillingEventId,
  BillingEventRow,
} from "../domain/billing-event.ts";
import type { BillingEventRepository } from "../domain/repositories.ts";

export class DrizzleBillingEventRepository implements BillingEventRepository {
  constructor(private readonly db: Drizzle) {}

  async findByProviderEventId(
    provider: string,
    providerEventId: string,
  ): Promise<BillingEventRow | null> {
    const [row] = await this.db
      .select()
      .from(billingEvents)
      .where(
        and(
          eq(billingEvents.provider, provider),
          eq(billingEvents.providerEventId, providerEventId),
        ),
      )
      .limit(1);
    if (!row) return null;
    return {
      id: row.id as BillingEventId,
      provider: row.provider,
      providerEventId: row.providerEventId,
      type: row.type,
      workspaceId: (row.workspaceId as WorkspaceId | null) ?? null,
      payload: row.payload,
      processedAt: row.processedAt,
    };
  }

  async record(event: BillingEventRow): Promise<boolean> {
    try {
      const result = await this.db
        .insert(billingEvents)
        .values({
          id: event.id,
          provider: event.provider,
          providerEventId: event.providerEventId,
          type: event.type,
          workspaceId: event.workspaceId,
          payload: event.payload as unknown,
          processedAt: event.processedAt,
        })
        .onConflictDoNothing({
          target: [
            billingEvents.provider,
            billingEvents.providerEventId,
          ],
        })
        .returning({ id: billingEvents.id });
      return result.length > 0;
    } catch (err) {
      throw err;
    }
  }
}
// -feature:billing
