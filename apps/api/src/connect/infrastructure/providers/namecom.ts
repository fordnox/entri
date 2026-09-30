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
  unsupportedType,
  withoutTrailingDot,
} from "./shared.ts";

const API = "https://api.name.com/core/v1";
const NAME = "Name.com";

interface NcomRecord {
  id: number;
  host?: string;
  type: string;
  answer: string;
  ttl?: number;
  priority?: number | null;
}

/**
 * name.com Core API v1 (successor to the deprecated v4 API) with HTTP
 * Basic auth `username:token`. Accounts with two-step verification must
 * enable API access for the token in the name.com dashboard.
 * https://docs.name.com/api/v1/reference/dns/create-record
 */
export class NameComAdapter implements DnsProviderAdapter {
  readonly key = "namecom";

  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async applyRecords(input: ApplyRecordsInput): Promise<ApplyRecordsResult> {
    const { username, apiToken } = requireCredentials(
      input.credentials,
      ["username", "apiToken"],
      NAME,
    );
    for (const r of input.records) if (r.type === "CAA") throw unsupportedType(NAME, r.type);
    const zone = normalizeZone(input.zone);
    const opts: RequestOptions = { providerName: NAME, secrets: [apiToken] };
    const headers = {
      Authorization: `Basic ${Buffer.from(`${username}:${apiToken}`).toString("base64")}`,
      "Content-Type": "application/json",
    };
    const base = `${API}/domains/${encodeURIComponent(zone)}/records`;

    const existing: ExistingRecord<NcomRecord>[] = [];
    for (let page = 1; page < 100; ) {
      const res = await httpRequest(
        this.fetchImpl,
        `${base}?perPage=1000&page=${page}`,
        { method: "GET", headers },
        opts,
      );
      const body = res.json as { records?: NcomRecord[]; nextPage?: number };
      for (const r of body?.records ?? []) {
        existing.push({
          type: r.type,
          name: normalizeRelative(r.host ?? ""),
          value: r.answer,
          ttl: r.ttl,
          priority: r.priority ?? undefined,
          raw: r,
        });
      }
      if (!body?.nextPage || body.nextPage <= page) break;
      page = body.nextPage;
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
          { method: "PUT", headers, body: JSON.stringify(toBody(op.record)) },
          mutate,
        );
      } else {
        await httpRequest(
          this.fetchImpl,
          base,
          { method: "POST", headers, body: JSON.stringify(toBody(op.record)) },
          mutate,
        );
      }
    }
    return { written: countWritten(ops) };
  }
}

function toBody(record: ZoneRecord): Record<string, unknown> {
  const body: Record<string, unknown> = {
    host: toEmptyApex(record.name),
    type: record.type,
    answer:
      record.type === "CNAME" || record.type === "MX"
        ? withoutTrailingDot(record.value)
        : record.value,
    ttl: clampTtl(record.ttl, 300),
  };
  if (record.type === "MX") body.priority = record.priority ?? 10;
  return body;
}
