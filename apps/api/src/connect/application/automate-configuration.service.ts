import { log } from "evlog";
import type { Clock } from "@/kernel/clock.ts";
import { ConflictError, DomainError, type HttpStatus } from "@/kernel/errors.ts";
import type { UnitOfWork } from "@/kernel/uow.ts";
import type { ConnectApplicationId } from "../domain/application.ts";
import { ProviderApiError, type ProviderCatalog } from "../domain/dns-provider.ts";
import type { DomainConnection } from "../domain/domain-connection.ts";
import { loadConnectionInScope } from "./load.ts";

export class ProviderSetupError extends DomainError {
  constructor(code: ProviderApiError["code"], message: string) {
    const status: HttpStatus = code === "rate_limited" ? 429 : 422;
    super(`provider.${code}`, message, status);
  }
}

/**
 * Writes the connection's records through the detected provider's API
 * with credentials the end user pastes into the modal. The credentials
 * live only on this call's stack: never persisted, never logged, never
 * put on an event.
 */
export class AutomateConfigurationService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly clock: Clock,
    private readonly catalog: ProviderCatalog,
  ) {}

  async execute(cmd: {
    applicationId: ConnectApplicationId;
    connectionId: string;
    credentials: Record<string, string>;
  }): Promise<DomainConnection> {
    const scope = { applicationId: cmd.applicationId };
    const conn = await this.uow.read((tx) => loadConnectionInScope(tx, scope, cmd.connectionId));
    if (conn.status === "connected") {
      throw new ConflictError("connection.already_connected", "this domain is already connected");
    }
    const entry = conn.providerKey ? this.catalog.get(conn.providerKey) : null;
    if (!entry?.adapter) {
      throw new ConflictError(
        "provider.not_automated",
        "automatic setup isn't available for this DNS provider — add the records manually",
      );
    }

    let failure: ProviderApiError | null = null;
    try {
      await entry.adapter.applyRecords({
        zone: conn.rootDomain,
        records: conn.records.map((r) => ({
          type: r.type,
          name: r.host,
          value: r.value,
          ttl: r.ttl,
          ...(r.priority !== undefined ? { priority: r.priority } : {}),
        })),
        credentials: cmd.credentials,
      });
    } catch (err) {
      if (err instanceof ProviderApiError) {
        failure = err;
      } else {
        log.error({
          action: "connect.automate.unexpected_error",
          provider: entry.descriptor.key,
          connectionId: conn.id,
          error: err instanceof Error ? err.message : String(err),
        });
        failure = new ProviderApiError(
          `${entry.descriptor.name} didn't accept the changes. Try again, or add the records manually.`,
          "provider_error",
        );
      }
    }

    const updated = await this.uow.run(async (tx) => {
      const fresh = await loadConnectionInScope(tx, scope, cmd.connectionId);
      if (failure) fresh.markAutomaticSetupFailed(failure.message, this.clock);
      else fresh.markAutomaticSetupSucceeded(this.clock);
      await tx.domainConnections.save(fresh);
      tx.events.addMany(fresh.pullEvents());
      return fresh;
    });
    if (failure) throw new ProviderSetupError(failure.code, failure.message);
    return updated;
  }
}
