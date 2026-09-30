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
  httpRequest,
  normalizeRelative,
  normalizeZone,
  parseCaa,
  planChanges,
  requireCredentials,
  type RequestOptions,
  withTrailingDot,
} from "./shared.ts";

const API = "https://api.digitalocean.com/v2";
const NAME = "DigitalOcean";

interface DoRecord {
  id: number;
  type: string;
  name: string;
  data: string;
  priority: number | null;
  ttl: number;
  flags?: number | null;
  tag?: string | null;
}

/**
 * DigitalOcean API v2 with a personal access token (read + write, or
 * the `domain:*` custom scopes).
 * https://docs.digitalocean.com/reference/api/digitalocean/#tag/Domain-Records
 */
export class DigitalOceanAdapter implements DnsProviderAdapter {
  readonly key = "digitalocean";

  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async applyRecords(input: ApplyRecordsInput): Promise<ApplyRecordsResult> {
    const { apiToken } = requireCredentials(input.credentials, ["apiToken"], NAME);
    const zone = normalizeZone(input.zone);
    const opts: RequestOptions = { providerName: NAME, secrets: [apiToken] };
    const headers = {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    };
    const base = `${API}/domains/${encodeURIComponent(zone)}/records`;

    const existing: ExistingRecord<DoRecord>[] = [];
    for (let page = 1; ; page++) {
      const res = await httpRequest(
        this.fetchImpl,
        `${base}?per_page=200&page=${page}`,
        { method: "GET", headers },
        opts,
      );
      const body = res.json as {
        domain_records?: DoRecord[];
        links?: { pages?: { next?: string } };
      };
      const list = body?.domain_records ?? [];
      for (const r of list) {
        existing.push({
          type: r.type,
          name: normalizeRelative(r.name),
          value: r.type === "CAA" ? `${r.flags ?? 0} ${r.tag ?? "issue"} "${r.data}"` : r.data,
          ttl: r.ttl,
          priority: r.priority ?? undefined,
          raw: r,
        });
      }
      if (!body?.links?.pages?.next || list.length === 0) break;
    }

    const ops = planChanges(input.records, existing);
    const mutate = { ...opts, notFoundIsZone: false };
    for (const op of ops) {
      if (op.kind === "delete") {
        await httpRequest(this.fetchImpl, `${base}/${op.existing.raw.id}`, { method: "DELETE", headers }, mutate);
      } else if (op.kind === "update") {
        await httpRequest(
          this.fetchImpl,
          `${base}/${op.existing.raw.id}`,
          { method: "PUT", headers, body: JSON.stringify(toDoBody(op.record)) },
          mutate,
        );
      } else {
        await httpRequest(
          this.fetchImpl,
          base,
          { method: "POST", headers, body: JSON.stringify(toDoBody(op.record)) },
          mutate,
        );
      }
    }
    return { written: countWritten(ops) };
  }
}

function toDoBody(record: ZoneRecord): Record<string, unknown> {
  const body: Record<string, unknown> = {
    type: record.type,
    name: normalizeRelative(record.name),
    ttl: clampTtl(record.ttl, 30),
  };
  switch (record.type) {
    case "CNAME":
      return { ...body, data: withTrailingDot(record.value) };
    case "MX":
      return { ...body, data: withTrailingDot(record.value), priority: record.priority ?? 10 };
    case "CAA": {
      const caa = parseCaa(record.value);
      return { ...body, data: caa.value, flags: caa.flags, tag: caa.tag };
    }
    default:
      return { ...body, data: record.value };
  }
}
