import type {
  ApplyRecordsInput,
  ApplyRecordsResult,
  DnsProviderAdapter,
  ProviderApiError,
  ZoneRecord,
} from "@/connect/domain/dns-provider.ts";
import {
  clampTtl,
  countWritten,
  errorFromResponse,
  type ExistingRecord,
  fromFqdn,
  httpRequest,
  type HttpResponse,
  normalizeZone,
  planChanges,
  requireCredentials,
  type RequestOptions,
  toEmptyApex,
  withoutTrailingDot,
} from "./shared.ts";

const API = "https://api.porkbun.com/api/json/v3";
const NAME = "Porkbun";

interface PbRecord {
  id: string;
  name: string;
  type: string;
  content: string;
  ttl: string;
  prio: string | null;
}

/**
 * Porkbun API v3. Credentials travel in the JSON body; the domain must
 * have "API Access" switched on in the Porkbun dashboard.
 * https://porkbun.com/api/json/v3/documentation
 */
export class PorkbunAdapter implements DnsProviderAdapter {
  readonly key = "porkbun";

  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async applyRecords(input: ApplyRecordsInput): Promise<ApplyRecordsResult> {
    const { apiKey, secretApiKey } = requireCredentials(
      input.credentials,
      ["apiKey", "secretApiKey"],
      NAME,
    );
    const zone = normalizeZone(input.zone);
    const opts: RequestOptions = {
      providerName: NAME,
      secrets: [apiKey, secretApiKey],
      notFoundIsZone: false,
      extractMessage,
      classify,
    };
    const auth = { apikey: apiKey, secretapikey: secretApiKey };
    const post = async (path: string, extra: Record<string, unknown> = {}) => {
      const res = await httpRequest(
        this.fetchImpl,
        `${API}${path}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...auth, ...extra }),
        },
        opts,
      );
      const body = res.json as { status?: string } | undefined;
      if (body?.status !== "SUCCESS") throw errorFromResponse(res, opts);
      return res.json as Record<string, unknown>;
    };

    const d = encodeURIComponent(zone);
    const list = await post(`/dns/retrieve/${d}`);
    const records = (list.records as PbRecord[] | undefined) ?? [];
    const existing: ExistingRecord<PbRecord>[] = records.map((r) => ({
      type: r.type,
      name: fromFqdn(r.name, zone),
      value: r.content,
      ttl: Number(r.ttl),
      priority: r.prio != null && r.prio !== "" ? Number(r.prio) : undefined,
      raw: r,
    }));

    const ops = planChanges(input.records, existing);
    for (const op of ops) {
      if (op.kind === "delete") await post(`/dns/delete/${d}/${op.existing.raw.id}`);
      else if (op.kind === "update") await post(`/dns/edit/${d}/${op.existing.raw.id}`, toPbBody(op.record));
      else await post(`/dns/create/${d}`, toPbBody(op.record));
    }
    return { written: countWritten(ops) };
  }
}

function toPbBody(record: ZoneRecord): Record<string, unknown> {
  const body: Record<string, unknown> = {
    name: toEmptyApex(record.name),
    type: record.type,
    content:
      record.type === "CNAME" || record.type === "MX"
        ? withoutTrailingDot(record.value)
        : record.value,
    ttl: String(clampTtl(record.ttl, 600)),
  };
  if (record.type === "MX") body.prio = String(record.priority ?? 10);
  return body;
}

function extractMessage(res: HttpResponse): string | undefined {
  const m = (res.json as { message?: string } | undefined)?.message;
  return typeof m === "string" ? m : undefined;
}

function classify(res: HttpResponse): ProviderApiError["code"] | undefined {
  const m = (extractMessage(res) ?? "").toLowerCase();
  if (res.status === 429 || m.includes("rate limit")) return "rate_limited";
  if (m.includes("invalid api key") || m.includes("invalid secret") || m.includes("api key")) {
    return "invalid_credentials";
  }
  if (m.includes("not opted in") || m.includes("api access")) return "permission_denied";
  if (m.includes("invalid domain") || m.includes("domain not found") || m.includes("not found")) {
    return "zone_not_found";
  }
  return undefined;
}
