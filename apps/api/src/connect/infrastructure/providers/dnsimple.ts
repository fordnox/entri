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
  planChanges,
  requireCredentials,
  type RequestOptions,
  toEmptyApex,
  withoutTrailingDot,
} from "./shared.ts";

const API = "https://api.dnsimple.com/v2";
const NAME = "DNSimple";

interface DsRecord {
  id: number;
  name: string;
  type: string;
  content: string;
  ttl: number;
  priority: number | null;
  system_record?: boolean;
}

/**
 * DNSimple API v2 with an account (or user) access token plus the
 * numeric account ID. https://developer.dnsimple.com/v2/zones/records/
 */
export class DnsimpleAdapter implements DnsProviderAdapter {
  readonly key = "dnsimple";

  constructor(
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly baseUrl: string = API,
  ) {}

  async applyRecords(input: ApplyRecordsInput): Promise<ApplyRecordsResult> {
    const { apiToken, accountId } = requireCredentials(
      input.credentials,
      ["apiToken", "accountId"],
      NAME,
    );
    const zone = normalizeZone(input.zone);
    const opts: RequestOptions = { providerName: NAME, secrets: [apiToken] };
    const headers = {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    const base = `${this.baseUrl}/${encodeURIComponent(accountId)}/zones/${encodeURIComponent(zone)}/records`;

    const existing: ExistingRecord<DsRecord>[] = [];
    for (let page = 1; page < 100; page++) {
      const res = await httpRequest(
        this.fetchImpl,
        `${base}?per_page=100&page=${page}`,
        { method: "GET", headers },
        opts,
      );
      const body = res.json as {
        data?: DsRecord[];
        pagination?: { current_page: number; total_pages: number };
      };
      for (const r of body?.data ?? []) {
        if (r.system_record) continue;
        existing.push({
          type: r.type,
          name: normalizeRelative(r.name),
          value: r.content,
          ttl: r.ttl,
          priority: r.priority ?? undefined,
          raw: r,
        });
      }
      const p = body?.pagination;
      if (!p || p.current_page >= p.total_pages) break;
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
          { method: "PATCH", headers, body: JSON.stringify(toDsBody(op.record)) },
          mutate,
        );
      } else {
        await httpRequest(
          this.fetchImpl,
          base,
          { method: "POST", headers, body: JSON.stringify(toDsBody(op.record)) },
          mutate,
        );
      }
    }
    return { written: countWritten(ops) };
  }
}

function toDsBody(record: ZoneRecord): Record<string, unknown> {
  const body: Record<string, unknown> = {
    name: toEmptyApex(record.name),
    type: record.type,
    content:
      record.type === "CNAME" || record.type === "MX"
        ? withoutTrailingDot(record.value)
        : record.value,
    ttl: clampTtl(record.ttl, 60),
  };
  if (record.type === "MX") body.priority = record.priority ?? 10;
  return body;
}
