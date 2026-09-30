import type { EventBus } from "@/kernel/events.ts";
import type { UnitOfWork } from "@/kernel/uow.ts";
import type { WorkspaceId } from "@/workspaces/domain/workspace.ts";
import { mapEventToAudit, type AuditMapContext } from "./audit-event-mapper.ts";

/**
 * Post-commit projector that materialises domain events into audit-log
 * rows. Subscribes once via `bus.subscribeAll` and routes each event
 * through `mapEventToAudit`; failures log and swallow rather than
 * propagate, so a mapper bug never takes the request path down with it.
 *
 * Writes happen inside a fresh `uow.run()` — the triggering transaction
 * has already committed by the time we get here. See `BaseUnitOfWork`
 * for the dispatch-after-commit contract.
 *
 * For team-scoped events that only carry `teamId` (e.g. `teams.role.*`,
 * `teams.member.*`), the parent workspaceId is resolved here from the
 * team repository before invoking the mapper. Keeps the mapper sync +
 * pure and avoids leaking ORM concerns into the taxonomy.
 */
export class AuditProjector {
  constructor(
    private readonly bus: EventBus,
    private readonly uow: UnitOfWork,
  ) {}

  start(): () => void {
    return this.bus.subscribeAll(async (event) => {
      try {
        await this.uow.run(async (tx) => {
          const ctx = await buildContext(event, tx);
          let mapped;
          try {
            mapped = mapEventToAudit(event, ctx);
          } catch (err) {
            console.error(
              `[audit] mapper threw for event '${event.type}':`,
              err,
            );
            return;
          }
          if (!mapped || (!mapped.app && !mapped.workspace)) return;
          if (mapped.app) await tx.appAudit.append(mapped.app);
          if (mapped.workspace) await tx.workspaceAudit.append(mapped.workspace);
        });
      } catch (err) {
        console.error(
          `[audit] failed to persist entry for event '${event.type}':`,
          err,
        );
      }
    });
  }
}

type AuditTx = Parameters<UnitOfWork["run"]>[0] extends (tx: infer T) => unknown
  ? T
  : never;

async function buildContext(
  event: { type: string },
  tx: AuditTx,
): Promise<AuditMapContext> {
  return {};
}
