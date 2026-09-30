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
  type HttpResponse,
  normalizeZone,
  parseCaa,
  planChanges,
  providerError,
  requireCredentials,
  type RequestOptions,
  toFqdn,
  withoutTrailingDot,
} from "./shared.ts";

const API = "https://api.cloudflare.com/client/v4";
const NAME = "Cloudflare";

interface CfRecord {
  id: string;
  type: string;
  name: string;
  content: string;
  ttl: number;
  priority?: number;
}

interface CfEnvelope<T> {
  success: boolean;
  errors?: Array<{ code: number; message: string }>;
  result: T;
  result_info?: { page: number; total_pages: number };
}

/**
 * Cloudflare API v4 with a scoped API token (Zone → DNS → Edit).
 * https://developers.cloudflare.com/api/resources/dns/subresources/records/
 */
export class CloudflareAdapter implements DnsProviderAdapter {
  readonly key = "cloudflare";

  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async applyRecords(input: ApplyRecordsInput): Promise<ApplyRecordsResult> {
    const { apiToken } = requireCredentials(input.credentials, ["apiToken"], NAME);
    const zone = normalizeZone(input.zone);
    const opts: RequestOptions = {
      providerName: NAME,
      secrets: [apiToken],
      extractMessage,
      classify,
    };
    const headers = {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    };
    const call = async <T>(path: string, init: RequestInit = {}) => {
      const res = await httpRequest(
        this.fetchImpl,
        `${API}${path}`,
        { ...init, headers },
        opts,
      );
      const body = res.json as CfEnvelope<T> | undefined;
      if (!body || body.success === false) {
        throw providerError(NAME, extractMessage(res) ?? "unexpected response", "provider_error", [apiToken]);
      }
      return body;
    };

    const zones = await call<Array<{ id: string; name: string }>>(
      `/zones?name=${encodeURIComponent(zone)}&per_page=5`,
    );
    const found = zones.result.find((z) => z.name.toLowerCase() === zone);
    if (!found) throw providerError(NAME, zone, "zone_not_found");
    const zoneId = found.id;

    const existing: ExistingRecord<CfRecord>[] = [];
    for (let page = 1; ; page++) {
      const res = await call<CfRecord[]>(
        `/zones/${zoneId}/dns_records?per_page=500&page=${page}`,
      );
      for (const r of res.result) {
        existing.push({
          type: r.type,
          name: fromFqdn(r.name, zone),
          value: r.content,
          ttl: r.ttl,
          priority: r.priority,
          raw: r,
        });
      }
      const info = res.result_info;
      if (!info || page >= info.total_pages || res.result.length === 0) break;
    }

    const ops = planChanges(input.records, existing);
    for (const op of ops) {
      if (op.kind === "delete") {
        await call(`/zones/${zoneId}/dns_records/${op.existing.raw.id}`, { method: "DELETE" });
      } else if (op.kind === "update") {
        await call(`/zones/${zoneId}/dns_records/${op.existing.raw.id}`, {
          method: "PUT",
          body: JSON.stringify(toCfBody(op.record, zone)),
        });
      } else {
        await call(`/zones/${zoneId}/dns_records`, {
          method: "POST",
          body: JSON.stringify(toCfBody(op.record, zone)),
        });
      }
    }
    return { written: countWritten(ops) };
  }
}

export function toCfBody(record: ZoneRecord, zone: string): Record<string, unknown> {
  const base: Record<string, unknown> = {
    type: record.type,
    name: toFqdn(record.name, zone),
    ttl: clampTtl(record.ttl, 60, 86400),
  };
  switch (record.type) {
    case "CAA":
      return { ...base, data: parseCaa(record.value) };
    case "MX":
      return { ...base, content: withoutTrailingDot(record.value), priority: record.priority ?? 10 };
    case "CNAME":
      return { ...base, content: withoutTrailingDot(record.value), proxied: false };
    case "A":
    case "AAAA":
      return { ...base, content: record.value, proxied: false };
    default:
      return { ...base, content: record.value };
  }
}

function extractMessage(res: HttpResponse): string | undefined {
  const body = res.json as CfEnvelope<unknown> | undefined;
  const msgs = body?.errors?.map((e) => e.message).filter(Boolean);
  return msgs && msgs.length > 0 ? msgs.join("; ") : undefined;
}

function classify(res: HttpResponse) {
  const codes = (res.json as CfEnvelope<unknown> | undefined)?.errors?.map((e) => e.code) ?? [];
  // 9109 / 10000: invalid or unauthorized token; 6003/6111: malformed auth header.
  if (codes.some((c) => c === 9109 || c === 6003 || c === 6111 || c === 1000)) {
    return "invalid_credentials" as const;
  }
  if (codes.includes(10000)) return res.status === 401 ? ("invalid_credentials" as const) : ("permission_denied" as const);
  if (codes.includes(7003) || codes.includes(1001)) return "zone_not_found" as const;
  if (res.status === 400 && codes.includes(9106)) return "invalid_credentials" as const;
  return undefined;
}
