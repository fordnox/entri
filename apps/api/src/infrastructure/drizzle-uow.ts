import { BaseUnitOfWork } from "@/kernel/base-uow.ts";
import type { EventBus } from "@/kernel/events.ts";
import type { TxContext } from "@/kernel/uow.ts";
import { DrizzleUserRepository } from "@/identity/infrastructure/drizzle-user.repository.ts";
import { DrizzleWorkspaceInviteRepository } from "@/workspaces/infrastructure/drizzle-invite.repository.ts";
import { DrizzleWorkspaceMemberRepository } from "@/workspaces/infrastructure/drizzle-workspace-member.repository.ts";
import { DrizzleWorkspaceRoleRepository } from "@/workspaces/infrastructure/drizzle-workspace-role.repository.ts";
import { DrizzleWorkspaceRepository } from "@/workspaces/infrastructure/drizzle-workspace.repository.ts";
// +feature:billing
import { DrizzleBillingCustomerRepository } from "@/billing/infrastructure/drizzle-billing-customer.repository.ts";
import { DrizzleBillingEventRepository } from "@/billing/infrastructure/drizzle-billing-event.repository.ts";
import { DrizzleSubscriptionRepository } from "@/billing/infrastructure/drizzle-subscription.repository.ts";
// -feature:billing
// +feature:audit-log
import { DrizzleAppAuditRepository } from "@/audit/infrastructure/drizzle-app-audit.repository.ts";
import { DrizzleWorkspaceAuditRepository } from "@/audit/infrastructure/drizzle-workspace-audit.repository.ts";
// -feature:audit-log
import type { Drizzle } from "./drizzle.ts";

type RepoContext = Omit<TxContext, "events">;

/**
 * Drizzle flavour of the UoW. Uses `db.transaction()`; the inner
 * callback receives a transactional handle that's structurally
 * compatible with the top-level `Drizzle` type so the same repository
 * constructors accept both.
 */
export class DrizzleUnitOfWork extends BaseUnitOfWork<Drizzle> {
  constructor(
    private readonly db: Drizzle,
    bus: EventBus,
  ) {
    super(bus);
  }

  protected readHandle(): Drizzle {
    return this.db;
  }

  protected openTransaction<T>(
    fn: (handle: Drizzle) => Promise<T>,
  ): Promise<T> {
    return this.db.transaction((tx) => fn(tx as unknown as Drizzle));
  }

  protected buildContext(db: Drizzle): RepoContext {
    return {
      users: new DrizzleUserRepository(db),
      workspaces: new DrizzleWorkspaceRepository(db),
      workspaceMembers: new DrizzleWorkspaceMemberRepository(db),
      workspaceInvites: new DrizzleWorkspaceInviteRepository(db),
      workspaceRoles: new DrizzleWorkspaceRoleRepository(db),
      // +feature:billing
      billingCustomers: new DrizzleBillingCustomerRepository(db),
      subscriptions: new DrizzleSubscriptionRepository(db),
      billingEvents: new DrizzleBillingEventRepository(db),
      // -feature:billing
      // +feature:audit-log
      appAudit: new DrizzleAppAuditRepository(db),
      workspaceAudit: new DrizzleWorkspaceAuditRepository(db),
      // -feature:audit-log
    };
  }
}
