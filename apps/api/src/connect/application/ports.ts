import type { DnsRecordType } from "@orbit/shared/connect";

/**
 * Live DNS reads. Implementations should query public recursive
 * resolvers (not the host's stub resolver) so verification reflects
 * what the rest of the internet sees.
 */
export interface DnsLookup {
  /** Lowercased NS hosts without trailing dots; `[]` when none. */
  nameservers(zone: string): Promise<string[]>;
  /**
   * Current values for `fqdn`, normalized to the same shape as
   * `ResolvedRecord.value`: lowercased targets without trailing dots,
   * TXT chunks joined, MX as `"<priority> <exchange>"`, CAA as
   * `<flags> <tag> "<value>"`. `[]` for NXDOMAIN / NODATA.
   */
  lookup(type: DnsRecordType, fqdn: string): Promise<string[]>;
}

export interface WebhookSendResult {
  ok: boolean;
  statusCode: number | null;
  error: string | null;
}

export interface WebhookSender {
  send(url: string, body: string, headers: Record<string, string>): Promise<WebhookSendResult>;
}
