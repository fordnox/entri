import type {
  ApplyRecordsInput,
  ApplyRecordsResult,
  DnsProviderAdapter,
  ZoneRecord,
} from "@/connect/domain/dns-provider.ts";
import {
  clampTtl,
  countWritten,
  type ExistingRecord,
  fromFqdn,
  httpRequest,
  normalizeZone,
  parseCaa,
  planChanges,
  providerError,
  requireCredentials,
  type RequestOptions,
  toFqdn,
  withoutTrailingDot,
} from "./shared.ts";

const API = "https://api.netlify.com/api/v1";
const NAME = "Netlify";

interface NlRecord {
  id: string;
  hostname: string;
  type: string;
  value: string;
  ttl?: number;
  priority?: number | null;
  flag?: number | null;
  tag?: string | null;
  managed?: boolean;
}

/**
 * Netlify DNS with a personal access token. Netlify has no record
 * update endpoint, so replacements are delete + create.
 * https://open-api.netlify.com/#tag/dnsZone
 */
export class NetlifyAdapter implements DnsProviderAdapter {
  readonly key = "netlify";

  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async applyRecords(input: ApplyRecordsInput): Promise<ApplyRecordsResult> {
    const { apiToken } = requireCredentials(input.credentials, ["apiToken"], NAME);
    const zone = normalizeZone(input.zone);
    const opts: RequestOptions = { providerName: NAME, secrets: [apiToken] };
    const headers = {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    };

    const zonesRes = await httpRequest(this.fetchImpl, `${API}/dns_zones`, { method: "GET", headers }, opts);
    const zones = (zonesRes.json as Array<{ id: string; name: string }> | undefined) ?? [];
    const found = zones.find((z) => z.name.toLowerCase().replace(/\.$/, "") === zone);
    if (!found) throw providerError(NAME, zone, "zone_not_found");
    const base = `${API}/dns_zones/${encodeURIComponent(found.id)}/dns_records`;

    const listRes = await httpRequest(this.fetchImpl, base, { method: "GET", headers }, opts);
    const list = (listRes.json as NlRecord[] | undefined) ?? [];
    const existing: ExistingRecord<NlRecord>[] = list
      .filter((r) => !r.managed && r.type !== "NETLIFY" && r.type !== "NETLIFYv6")
      .map((r) => ({
        type: r.type,
        name: fromFqdn(r.hostname, zone),
        value: r.type === "CAA" ? `${r.flag ?? 0} ${r.tag ?? "issue"} "${r.value}"` : r.value,
        ttl: r.ttl,
        priority: r.priority ?? undefined,
        raw: r,
      }));

    const ops = planChanges(input.records, existing);
    const mutate = { ...opts, notFoundIsZone: false };
    const del = (id: string) =>
      httpRequest(this.fetchImpl, `${base}/${encodeURIComponent(id)}`, { method: "DELETE", headers }, { ...mutate, allowStatuses: [404] });
    const create = (record: ZoneRecord) =>
      httpRequest(
        this.fetchImpl,
        base,
        { method: "POST", headers, body: JSON.stringify(toNlBody(record, zone)) },
        mutate,
      );
    for (const op of ops) {
      if (op.kind === "delete") await del(op.existing.raw.id);
      else if (op.kind === "update") {
        await del(op.existing.raw.id);
        await create(op.record);
      } else await create(op.record);
    }
    return { written: countWritten(ops) };
  }
}

function toNlBody(record: ZoneRecord, zone: string): Record<string, unknown> {
  const body: Record<string, unknown> = {
    type: record.type,
    hostname: toFqdn(record.name, zone),
    ttl: clampTtl(record.ttl, 60),
  };
  switch (record.type) {
    case "CNAME":
      return { ...body, value: withoutTrailingDot(record.value) };
    case "MX":
      return { ...body, value: withoutTrailingDot(record.value), priority: record.priority ?? 10 };
    case "CAA": {
      const caa = parseCaa(record.value);
      return { ...body, value: caa.value, flag: caa.flags, tag: caa.tag };
    }
    default:
      return { ...body, value: record.value };
  }
}
