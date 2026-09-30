import { type Id, newId } from "@/kernel/id.ts";
import type { WorkspaceId } from "@/workspaces/domain/workspace.ts";

export type BillingEventId = Id<"billingEvent">;

/**
 * Append-only provider-webhook ledger row. Uniqueness on
 * (provider, providerEventId) gives us idempotency "for free" —
 * duplicate webhook POSTs (retries, at-least-once delivery) insert
 * nothing and short-circuit before touching the domain.
 */
export interface BillingEventRow {
  id: BillingEventId;
  provider: string;
  providerEventId: string;
  type: string;
  workspaceId: WorkspaceId | null;
  payload: unknown;
  processedAt: Date;
}

export function newBillingEventId(): BillingEventId {
  return newId("billingEvent");
}
