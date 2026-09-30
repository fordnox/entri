import type { DnsRecordsConfig } from "@orbit/shared/connect";
import type { Clock } from "@/kernel/clock.ts";
import type { UnitOfWork } from "@/kernel/uow.ts";
import type { ConnectApplication } from "../domain/application.ts";
import type { ProviderCatalog } from "../domain/dns-provider.ts";
import { parseUserDomain, resolveRecords } from "../domain/dns-records.ts";
import { DomainConnection } from "../domain/domain-connection.ts";
import type { DnsLookup } from "./ports.ts";

export interface CreateConfigurationCommand {
  application: ConnectApplication;
  domain: string;
  dnsRecords: DnsRecordsConfig;
  userId?: string;
  metadata?: Record<string, unknown>;
}

export class CreateConfigurationService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly clock: Clock,
    private readonly dns: DnsLookup,
    private readonly catalog: ProviderCatalog,
  ) {}

  async execute(cmd: CreateConfigurationCommand): Promise<DomainConnection> {
    const domain = parseUserDomain(cmd.domain);
    const records = resolveRecords(cmd.dnsRecords, domain);
    // Provider detection is a network call; keep it outside the transaction.
    const nameservers = await this.dns.nameservers(domain.rootDomain).catch(() => []);
    const provider = this.catalog.detect(nameservers);
    return this.uow.run(async (tx) => {
      const conn = DomainConnection.create(
        {
          applicationId: cmd.application.id,
          workspaceId: cmd.application.workspaceId,
          domain,
          records,
          providerKey: provider?.descriptor.key ?? null,
          userId: cmd.userId,
          metadata: cmd.metadata,
        },
        this.clock,
      );
      await tx.domainConnections.save(conn);
      tx.events.addMany(conn.pullEvents());
      return conn;
    });
  }
}
