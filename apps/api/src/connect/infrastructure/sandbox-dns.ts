import type { DnsRecordType } from "@orbit/shared/connect";
import type { DnsLookup } from "../application/ports.ts";
import {
  ProviderApiError,
  type ApplyRecordsInput,
  type ApplyRecordsResult,
  type DnsProviderAdapter,
  type ProviderCatalog,
  type ProviderCatalogEntry,
} from "../domain/dns-provider.ts";
import type { DomainConnection } from "../domain/domain-connection.ts";

export const SANDBOX_TLD = "test";
const SANDBOX_NS = ["ns1.sandbox.connect.test", "ns2.sandbox.connect.test"];
const MANUAL_PROPAGATION_MS = 8_000;

function isSandbox(name: string): boolean {
  return name === SANDBOX_TLD || name.endsWith(`.${SANDBOX_TLD}`);
}

/**
 * Development-only fake DNS for `*.test` domains (RFC 2606 reserves the
 * TLD, so it never collides with a real zone). Lets the whole modal
 * flow — detection, automatic setup, manual setup, propagation,
 * webhooks — run locally without owning a domain:
 *
 *  - automatic: any token works; the token `fail` is rejected, and
 *    `denied` simulates a token without DNS-edit scope.
 *  - manual: records "appear" ~8 s after the user clicks "I've added
 *    these records".
 *
 * State is in-process and lost on restart.
 */
export class SandboxDns implements DnsProviderAdapter {
  readonly key = "sandbox";
  private readonly zones = new Map<string, Map<string, string[]>>();

  readonly entry: ProviderCatalogEntry = {
    descriptor: {
      key: "sandbox",
      name: "Sandbox DNS",
      automated: true,
      credentialFields: [
        {
          key: "token",
          label: "Sandbox API token",
          secret: true,
          placeholder: "anything",
          help: "Any value works. Use \"fail\" or \"denied\" to simulate errors.",
        },
      ],
      credentialsUrl: null,
      dnsPanelUrl: null,
    },
    nameserverSuffixes: ["sandbox.connect.test"],
    adapter: this,
  };

  async applyRecords(input: ApplyRecordsInput): Promise<ApplyRecordsResult> {
    const token = input.credentials.token?.trim();
    if (!token || token === "fail") {
      throw new ProviderApiError("Sandbox DNS rejected that API token.", "invalid_credentials");
    }
    if (token === "denied") {
      throw new ProviderApiError(
        "That token can't edit DNS for this zone. Create one with DNS edit permission.",
        "permission_denied",
      );
    }
    for (const r of input.records) {
      const fqdn = r.name === "@" ? input.zone : `${r.name}.${input.zone}`;
      const value = r.type === "MX" ? `${r.priority ?? 10} ${r.value}` : r.value;
      this.put(r.type, fqdn, value, r.type === "CNAME" || r.type === "A" || r.type === "AAAA");
    }
    return { written: input.records.length };
  }

  simulateManualEntry(conn: DomainConnection): void {
    if (!isSandbox(conn.rootDomain)) return;
    const records = conn.records.map((r) => ({ ...r }));
    setTimeout(() => {
      for (const r of records) {
        this.put(r.type, r.fqdn, r.type === "MX" ? `${r.priority ?? 10} ${r.value}` : r.value, false);
      }
    }, MANUAL_PROPAGATION_MS).unref?.();
  }

  lookup(type: DnsRecordType, fqdn: string): string[] {
    return [...(this.zones.get(fqdn)?.get(type) ?? [])];
  }

  private put(type: DnsRecordType, fqdn: string, value: string, replace: boolean): void {
    let byType = this.zones.get(fqdn);
    if (!byType) {
      byType = new Map();
      this.zones.set(fqdn, byType);
    }
    const existing = replace ? [] : (byType.get(type) ?? []);
    if (!existing.includes(value)) existing.push(value);
    byType.set(type, existing);
  }
}

/** Routes `*.test` names to the sandbox, everything else to real DNS. */
export class SandboxAwareDnsLookup implements DnsLookup {
  constructor(
    private readonly real: DnsLookup,
    private readonly sandbox: SandboxDns,
  ) {}

  nameservers(zone: string): Promise<string[]> {
    return isSandbox(zone) ? Promise.resolve([...SANDBOX_NS]) : this.real.nameservers(zone);
  }

  lookup(type: DnsRecordType, fqdn: string): Promise<string[]> {
    return isSandbox(fqdn)
      ? Promise.resolve(this.sandbox.lookup(type, fqdn))
      : this.real.lookup(type, fqdn);
  }
}

/** Real catalog plus the sandbox entry, which is listed first in dev. */
export class SandboxAwareCatalog implements ProviderCatalog {
  constructor(
    private readonly real: ProviderCatalog,
    private readonly sandbox: SandboxDns,
  ) {}

  list(): readonly ProviderCatalogEntry[] {
    return [this.sandbox.entry, ...this.real.list()];
  }

  get(key: string): ProviderCatalogEntry | null {
    return key === this.sandbox.key ? this.sandbox.entry : this.real.get(key);
  }

  detect(nameservers: readonly string[]): ProviderCatalogEntry | null {
    if (nameservers.some((ns) => ns.endsWith(".sandbox.connect.test"))) return this.sandbox.entry;
    return this.real.detect(nameservers);
  }
}
