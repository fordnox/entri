import type { DnsProviderDTO, DnsRecordType } from "@orbit/shared/connect";

/**
 * A record ready to be written to a DNS zone. `name` is relative to the
 * zone apex — `"@"` for the apex itself, otherwise the label(s) left of
 * the zone (`"www"`, `"shop"`, `"_verify.shop"`). Adapters translate to
 * whatever their API expects (FQDN, trailing dot, empty string, …).
 */
export interface ZoneRecord {
  type: DnsRecordType;
  name: string;
  value: string;
  ttl: number;
  priority?: number;
}

export interface ApplyRecordsInput {
  /** Registrable domain / zone apex, e.g. `acme.com`. */
  zone: string;
  records: readonly ZoneRecord[];
  /** Keyed by `ProviderCredentialFieldDTO.key`. Never persisted or logged. */
  credentials: Readonly<Record<string, string>>;
}

export interface ApplyRecordsResult {
  /** Records created or updated. */
  written: number;
}

/**
 * Thrown by adapters for any failure the end user can act on (bad
 * token, zone not in this account, insufficient scope). `message` is
 * shown verbatim in the modal, so keep it human and never echo
 * credentials back.
 */
export class ProviderApiError extends Error {
  constructor(
    message: string,
    readonly code:
      | "invalid_credentials"
      | "zone_not_found"
      | "permission_denied"
      | "rate_limited"
      | "provider_error",
  ) {
    super(message);
    this.name = "ProviderApiError";
  }
}

/**
 * Upsert semantics: for each record, a record with the same
 * (type, name) that Connect is responsible for is replaced; for
 * CNAME any existing record at that name is replaced (CNAME can't
 * coexist); for TXT/MX/CAA/A/AAAA an identical value is a no-op and a
 * different value is ADDED alongside, except A/AAAA/CNAME on the same
 * name which are REPLACED (so a parked-domain A record doesn't linger).
 */
export interface DnsProviderAdapter {
  readonly key: string;
  applyRecords(input: ApplyRecordsInput): Promise<ApplyRecordsResult>;
}

export interface ProviderCatalogEntry {
  descriptor: DnsProviderDTO;
  /**
   * Lowercased nameserver suffixes that identify this provider, matched
   * against each NS host with `host === s || host.endsWith("." + s)`.
   */
  nameserverSuffixes: readonly string[];
  /** Present iff `descriptor.automated`. */
  adapter?: DnsProviderAdapter;
}

export interface ProviderCatalog {
  list(): readonly ProviderCatalogEntry[];
  get(key: string): ProviderCatalogEntry | null;
  /** First entry whose suffix matches any of the given NS hosts. */
  detect(nameservers: readonly string[]): ProviderCatalogEntry | null;
}
