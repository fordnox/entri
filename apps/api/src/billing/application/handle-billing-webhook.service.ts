import { log } from "evlog";
import type { Clock } from "@/kernel/clock.ts";
import type { UnitOfWork } from "@/kernel/uow.ts";
import { Subscription } from "../domain/subscription.ts";
import {
  newBillingEventId,
  type BillingEventRow,
} from "../domain/billing-event.ts";
import type { WorkspaceId } from "@/workspaces/domain/workspace.ts";
import type { BillingCatalog } from "./billing-catalog.ts";
import {
  type BillingWebhookReceiver,
  type NormalizedBillingEvent,
} from "./billing-webhook-receiver.ts";

export interface HandleBillingWebhookInput {
  rawBody: string;
  headers: Record<string, string>;
}

export interface HandleBillingWebhookResult {
  ok: true;
  /** `true` iff the event was new (processed); `false` for duplicates. */
  processed: boolean;
  eventType: string;
}

/**
 * Orchestrates the full webhook flow:
 *
 *   1. Verify + parse (via the provider-specific receiver port).
 *   2. Ledger-dedupe against `BillingEvent.providerEventId` uniqueness.
 *   3. Resolve the workspace via our `BillingCustomer` row.
 *   4. Upsert the `Subscription` aggregate with the normalized sync
 *      input. Domain events emit on status change; projectors push
 *      `billing.subscription.updated` over realtime.
 */
export class HandleBillingWebhookService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly clock: Clock,
    private readonly receiver: BillingWebhookReceiver,
    private readonly catalog: BillingCatalog,
  ) {}

  async execute(
    input: HandleBillingWebhookInput,
  ): Promise<HandleBillingWebhookResult> {
    const event = await this.receiver.verifyAndParse(input);
    log.info({
      action: "billing.webhook.received",
      provider: this.receiver.provider,
      eventType: event.type,
      providerEventId: event.providerEventId,
    });

    const processed = await this.uow.run(async (tx) => {
      const { workspaceId, persisted } = await this.applyEvent(tx, event);
      const ledgerRow: BillingEventRow = {
        id: newBillingEventId(),
        provider: this.receiver.provider,
        providerEventId: event.providerEventId,
        type: event.type === "other" ? event.rawType : event.type,
        workspaceId,
        payload: event,
        processedAt: this.clock.now(),
      };
      const fresh = await tx.billingEvents.record(ledgerRow);
      if (persisted) {
        // Events are already queued via the aggregate's pullEvents()
        // in applyEvent — no further work here.
      }
      return fresh;
    });

    return {
      ok: true,
      processed,
      eventType: event.type === "other" ? event.rawType : event.type,
    };
  }

  private async applyEvent(
    tx: Parameters<Parameters<UnitOfWork["run"]>[0]>[0],
    event: NormalizedBillingEvent,
  ): Promise<{ workspaceId: WorkspaceId | null; persisted: boolean }> {
    if (event.type === "other") {
      return { workspaceId: null, persisted: false };
    }

    const customer = await tx.billingCustomers.findByProviderCustomerId(
      this.receiver.provider,
      event.providerCustomerId,
    );
    if (!customer) {
      // Receiving a webhook for a customer we don't know about means
      // the customer was created out-of-band. We record the event and
      // skip domain mutation — the next `startCheckout` will create
      // the customer row and catch up.
      log.warn({
        action: "billing.webhook.unknown_customer",
        provider: this.receiver.provider,
        providerCustomerId: event.providerCustomerId,
        eventType: event.type,
      });
      return { workspaceId: null, persisted: false };
    }

    if (event.type === "subscription.synced") {
      const existing = await tx.subscriptions.findByProviderSubscriptionId(
        this.receiver.provider,
        event.subscription.id,
      );
      const planKey =
        event.subscription.sync.planKey ??
        this.catalog.resolvePlanKey(event.subscription.sync.priceId);
      const sync = { ...event.subscription.sync, planKey };

      if (existing) {
        existing.sync(sync, this.clock);
        await tx.subscriptions.save(existing);
        tx.events.addMany(existing.pullEvents());
      } else {
        const created = Subscription.createFromProvider(
          {
            workspaceId: customer.workspaceId,
            billingCustomerId: customer.id,
            provider: this.receiver.provider,
            providerSubscriptionId: event.subscription.id,
            sync,
          },
          this.clock,
        );
        await tx.subscriptions.save(created);
        tx.events.addMany(created.pullEvents());
      }
      return { workspaceId: customer.workspaceId, persisted: true };
    }

    if (event.type === "subscription.deleted") {
      const existing = await tx.subscriptions.findByProviderSubscriptionId(
        this.receiver.provider,
        event.providerSubscriptionId,
      );
      if (!existing) {
        return { workspaceId: customer.workspaceId, persisted: false };
      }
      existing.sync(
        {
          status: "canceled",
          priceId: existing.priceId,
          planKey: existing.planKey,
          quantity: existing.quantity,
          currentPeriodStart: existing.currentPeriodStart,
          currentPeriodEnd: existing.currentPeriodEnd,
          cancelAtPeriodEnd: false,
          canceledAt: this.clock.now(),
          trialEndsAt: existing.trialEndsAt,
        },
        this.clock,
      );
      await tx.subscriptions.save(existing);
      tx.events.addMany(existing.pullEvents());
      return { workspaceId: customer.workspaceId, persisted: true };
    }

    return { workspaceId: customer.workspaceId, persisted: false };
  }
}
