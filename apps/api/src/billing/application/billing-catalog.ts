import type { BillingPlan } from "../domain/billing-plan.ts";

/**
 * A provider-agnostic plan catalog. Built once from config at boot.
 * Used by the DTO layer (`listAvailablePlans`) and by the sync path
 * to resolve a `priceId` → `planKey` so Subscription.planKey can be
 * stamped when the webhook arrives.
 */
export class BillingCatalog {
  private readonly byPriceId: Map<string, BillingPlan>;
  private readonly byKey: Map<string, BillingPlan>;

  constructor(private readonly plans: readonly BillingPlan[]) {
    this.byPriceId = new Map();
    this.byKey = new Map();
    for (const plan of plans) {
      this.byPriceId.set(plan.priceId, plan);
      this.byKey.set(plan.key, plan);
    }
  }

  list(): readonly BillingPlan[] {
    return this.plans;
  }

  findByPriceId(priceId: string): BillingPlan | null {
    return this.byPriceId.get(priceId) ?? null;
  }

  findByKey(key: string): BillingPlan | null {
    return this.byKey.get(key) ?? null;
  }

  resolvePlanKey(priceId: string): string | null {
    return this.byPriceId.get(priceId)?.key ?? null;
  }
}
