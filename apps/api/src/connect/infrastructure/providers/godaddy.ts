import type {
  ApplyRecordsInput,
  ApplyRecordsResult,
  DnsProviderAdapter,
} from "@/connect/domain/dns-provider.ts";
import {
  clampTtl,
  countWritten,
  type ExistingRecord,
  httpRequest,
  type HttpResponse,
  normalizeRelative,
  normalizeZone,
  planChanges,
  requireCredentials,
  type RequestOptions,
  rrsetChanges,
  unsupportedType,
  withoutTrailingDot,
} from "./shared.ts";

const API = "https://api.godaddy.com";
const NAME = "GoDaddy";

interface GdRecord {
  type: string;
  name: string;
  data: string;
  ttl?: number;
  priority?: number;
}

/**
 * GoDaddy Domains API v1 with a production API key + secret.
 * `PUT /v1/domains/{domain}/records/{type}/{name}` replaces the whole
 * (type, name) set, so each touched set is re-sent with its merged
 * membership. https://developer.godaddy.com/doc/endpoint/domains
 *
 * Note: GoDaddy restricts DNS API access to accounts meeting its
 * eligibility rules (e.g. 10+ domains); others get 403 ACCESS_DENIED.
 */
export class GoDaddyAdapter implements DnsProviderAdapter {
  readonly key = "godaddy";

  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async applyRecords(input: ApplyRecordsInput): Promise<ApplyRecordsResult> {
    const { apiKey, apiSecret } = requireCredentials(
      input.credentials,
      ["apiKey", "apiSecret"],
      NAME,
    );
    for (const r of input.records) if (r.type === "CAA") throw unsupportedType(NAME, r.type);
    const zone = normalizeZone(input.zone);
    const opts: RequestOptions = {
      providerName: NAME,
      secrets: [apiKey, apiSecret],
      extractMessage,
      classify,
    };
    const headers = {
      Authorization: `sso-key ${apiKey}:${apiSecret}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    const base = `${API}/v1/domains/${encodeURIComponent(zone)}/records`;

    const existing: ExistingRecord<GdRecord>[] = [];
    const pageSize = 500;
    for (let offset = 0; ; offset += pageSize) {
      const res = await httpRequest(
        this.fetchImpl,
        `${base}?limit=${pageSize}&offset=${offset}`,
        { method: "GET", headers },
        opts,
      );
      const list = (res.json as GdRecord[] | undefined) ?? [];
      for (const r of list) {
        existing.push({
          type: r.type,
          name: normalizeRelative(r.name),
          value: r.data,
          ttl: r.ttl,
          priority: r.priority,
          raw: r,
        });
      }
      if (list.length < pageSize) break;
    }

    const ops = planChanges(input.records, existing);
    for (const set of rrsetChanges(existing, ops, 600)) {
      const path = `${base}/${set.type}/${encodeURIComponent(set.name)}`;
      if (set.records.length === 0) {
        await httpRequest(this.fetchImpl, path, { method: "DELETE", headers }, {
          ...opts,
          notFoundIsZone: false,
          allowStatuses: [404],
        });
        continue;
      }
      const body = set.records.map((r) => {
        const data =
          set.type === "CNAME" || set.type === "MX" ? withoutTrailingDot(r.value) : r.value;
        const rec: Record<string, unknown> = { data, ttl: clampTtl(r.ttl, 600) };
        if (set.type === "MX") rec.priority = r.priority ?? 10;
        return rec;
      });
      await httpRequest(
        this.fetchImpl,
        path,
        { method: "PUT", headers, body: JSON.stringify(body) },
        opts,
      );
    }
    return { written: countWritten(ops) };
  }
}

function extractMessage(res: HttpResponse): string | undefined {
  const j = res.json as { code?: string; message?: string } | undefined;
  return j?.message || j?.code || undefined;
}

function classify(res: HttpResponse) {
  const code = (res.json as { code?: string } | undefined)?.code;
  if (code === "UNABLE_TO_AUTHENTICATE" || code === "MALFORMED_CREDENTIALS") {
    return "invalid_credentials" as const;
  }
  if (code === "ACCESS_DENIED" || code === "NOT_AUTHORIZED") return "permission_denied" as const;
  if (code === "UNKNOWN_DOMAIN" || code === "NOT_FOUND") return "zone_not_found" as const;
  if (code === "TOO_MANY_REQUESTS") return "rate_limited" as const;
  return undefined;
}
