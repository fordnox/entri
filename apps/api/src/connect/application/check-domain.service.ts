import type { CheckDomainResponse } from "@orbit/shared/connect";
import type { ProviderCatalog } from "../domain/dns-provider.ts";
import { parseUserDomain } from "../domain/dns-records.ts";
import type { DnsLookup } from "./ports.ts";

export class CheckDomainService {
  constructor(
    private readonly dns: DnsLookup,
    private readonly catalog: ProviderCatalog,
  ) {}

  async execute(rawDomain: string): Promise<CheckDomainResponse> {
    const parsed = parseUserDomain(rawDomain);
    const nameservers = await this.dns.nameservers(parsed.rootDomain).catch(() => []);
    return {
      domain: parsed.domain,
      rootDomain: parsed.rootDomain,
      subdomain: parsed.subdomain,
      nameservers,
      provider: this.catalog.detect(nameservers)?.descriptor ?? null,
    };
  }
}
