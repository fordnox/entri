import type {
  ApplyRecordsInput,
  ApplyRecordsResult,
  DnsProviderAdapter,
} from "@/connect/domain/dns-provider.ts";
import {
  clampTtl,
  countWritten,
  formatZoneFileValue,
  type ExistingRecord,
  httpRequest,
  type HttpResponse,
  normalizeRelative,
  normalizeZone,
  planChanges,
  requireCredentials,
  type RequestOptions,
  rrsetChanges,
  splitMx,
} from "./shared.ts";

const API = "https://api.hetzner.cloud/v1";
const NAME = "Hetzner";

interface HzRRSet {
  id: string;
  name: string;
  type: string;
  ttl: number | null;
  records: Array<{ value: string; comment?: string | null }>;
}

/**
 * Hetzner DNS via the Hetzner Cloud API (the legacy dns.hetzner.com API
 * was shut down in May 2026; zones now live in Hetzner Console
 * projects). Uses a project API token with Read & Write permission.
 * The API is RRset-based. https://docs.hetzner.cloud/reference/cloud#dns
 */
export class HetznerAdapter implements DnsProviderAdapter {
  readonly key = "hetzner";

  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async applyRecords(input: ApplyRecordsInput): Promise<ApplyRecordsResult> {
    const { apiToken } = requireCredentials(input.credentials, ["apiToken"], NAME);
    const zone = normalizeZone(input.zone);
    const opts: RequestOptions = { providerName: NAME, secrets: [apiToken], extractMessage, classify };
    const headers = {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    };
    const z = encodeURIComponent(zone);

    await httpRequest(this.fetchImpl, `${API}/zones/${z}`, { method: "GET", headers }, opts);

    const existing: ExistingRecord<HzRRSet>[] = [];
    for (let page = 1; page < 100; page++) {
      const res = await httpRequest(
        this.fetchImpl,
        `${API}/zones/${z}/rrsets?per_page=100&page=${page}`,
        { method: "GET", headers },
        opts,
      );
      const body = res.json as {
        rrsets?: HzRRSet[];
        meta?: { pagination?: { next_page?: number | null } };
      };
      for (const set of body?.rrsets ?? []) {
        for (const r of set.records) {
          const mx = set.type === "MX" ? splitMx(r.value) : null;
          existing.push({
            type: set.type,
            name: normalizeRelative(set.name),
            value: mx ? mx.host : r.value,
            ttl: set.ttl ?? undefined,
            priority: mx?.priority,
            raw: set,
          });
        }
      }
      if (!body?.meta?.pagination?.next_page) break;
    }

    const ops = planChanges(input.records, existing);
    const mutate = { ...opts, notFoundIsZone: false };
    for (const set of rrsetChanges(existing, ops, 300)) {
      const path = `${API}/zones/${z}/rrsets/${encodeURIComponent(set.name)}/${set.type}`;
      if (set.records.length === 0) {
        await httpRequest(this.fetchImpl, path, { method: "DELETE", headers }, { ...mutate, allowStatuses: [404] });
        continue;
      }
      const records = [
        ...new Set(set.records.map((r) => formatZoneFileValue(set.type, r.value, r.priority, r.fromPlan))),
      ].map((value) => ({ value }));
      if (set.before.length === 0) {
        await httpRequest(
          this.fetchImpl,
          `${API}/zones/${z}/rrsets`,
          {
            method: "POST",
            headers,
            body: JSON.stringify({
              name: set.name,
              type: set.type,
              ttl: clampTtl(set.records[0]!.ttl, 60),
              records,
            }),
          },
          mutate,
        );
      } else {
        await httpRequest(
          this.fetchImpl,
          `${path}/actions/set_records`,
          { method: "POST", headers, body: JSON.stringify({ records }) },
          mutate,
        );
      }
    }
    return { written: countWritten(ops) };
  }
}

function extractMessage(res: HttpResponse): string | undefined {
  const e = (res.json as { error?: { message?: string } } | undefined)?.error;
  return e?.message || undefined;
}

function classify(res: HttpResponse) {
  const code = (res.json as { error?: { code?: string } } | undefined)?.error?.code;
  if (code === "unauthorized") return "invalid_credentials" as const;
  if (code === "forbidden" || code === "token_readonly") return "permission_denied" as const;
  if (code === "rate_limit_exceeded") return "rate_limited" as const;
  return undefined;
}
