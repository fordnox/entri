import { Resolver } from "node:dns/promises";
import type { DnsRecordType } from "@orbit/shared/connect";
import type { DnsLookup } from "../application/ports.ts";

const NO_ANSWER = new Set(["ENOTFOUND", "ENODATA", "ESERVFAIL", "ENONAME", "NXDOMAIN"]);

function host(s: string): string {
  return s.toLowerCase().replace(/\.+$/, "");
}

/**
 * Queries public recursive resolvers directly (Cloudflare + Google by
 * default, override with `CONNECT_DNS_RESOLVERS`) instead of the OS stub
 * resolver, so a record cached in the API host's resolver can't make a
 * domain look connected before the rest of the internet sees it.
 */
export class NodeDnsLookup implements DnsLookup {
  private readonly resolver: Resolver;

  constructor(servers: readonly string[]) {
    this.resolver = new Resolver({ timeout: 3_000, tries: 2 });
    if (servers.length > 0) this.resolver.setServers([...servers]);
  }

  async nameservers(zone: string): Promise<string[]> {
    return this.guard(async () => (await this.resolver.resolveNs(zone)).map(host).sort());
  }

  async lookup(type: DnsRecordType, fqdn: string): Promise<string[]> {
    return this.guard(async () => {
      switch (type) {
        case "A":
          return this.resolver.resolve4(fqdn);
        case "AAAA":
          return (await this.resolver.resolve6(fqdn)).map((v) => v.toLowerCase());
        case "CNAME":
          return (await this.resolver.resolveCname(fqdn)).map(host);
        case "TXT":
          return (await this.resolver.resolveTxt(fqdn)).map((chunks) => chunks.join(""));
        case "MX":
          return (await this.resolver.resolveMx(fqdn)).map((mx) => `${mx.priority} ${host(mx.exchange)}`);
        case "CAA":
          return (await this.resolver.resolveCaa(fqdn)).flatMap((r) => {
            const flags = r.critical ?? 0;
            const out: string[] = [];
            if (r.issue !== undefined) out.push(`${flags} issue "${r.issue}"`);
            if (r.issuewild !== undefined) out.push(`${flags} issuewild "${r.issuewild}"`);
            if (r.iodef !== undefined) out.push(`${flags} iodef "${r.iodef}"`);
            return out;
          });
      }
    });
  }

  private async guard(fn: () => Promise<string[]>): Promise<string[]> {
    try {
      return await fn();
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code && NO_ANSWER.has(code)) return [];
      throw err;
    }
  }
}
