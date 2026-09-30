import type { Clock } from "@/kernel/clock.ts";
import type { UnitOfWork } from "@/kernel/uow.ts";
import type { DomainConnection } from "../domain/domain-connection.ts";
import { type ConnectionScope, loadConnectionInScope } from "./load.ts";
import type { DnsLookup } from "./ports.ts";
import { observeRecords } from "./record-verifier.ts";

/** The modal polls every few seconds; don't hit resolvers faster than this. */
const MIN_CHECK_INTERVAL_MS = 2_000;

export class VerifyConfigurationService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly clock: Clock,
    private readonly dns: DnsLookup,
  ) {}

  async execute(scope: ConnectionScope, connectionId: string): Promise<DomainConnection> {
    const current = await this.uow.read((tx) => loadConnectionInScope(tx, scope, connectionId));
    const last = current.snapshot().lastCheckedAt;
    if (last && this.clock.now().getTime() - last.getTime() < MIN_CHECK_INTERVAL_MS) {
      return current;
    }
    const observations = await observeRecords(this.dns, current.records);
    return this.uow.run(async (tx) => {
      const fresh = await loadConnectionInScope(tx, scope, connectionId);
      // Records can't change after creation, so observations still line up.
      fresh.applyVerification(observations, this.clock);
      await tx.domainConnections.save(fresh);
      tx.events.addMany(fresh.pullEvents());
      return fresh;
    });
  }
}
