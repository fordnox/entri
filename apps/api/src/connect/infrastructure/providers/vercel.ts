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
  type ExistingRecord,
  httpRequest,
  type HttpResponse,
  normalizeRelative,
  normalizeZone,
  optionalCredential,
  planChanges,
  requireCredentials,
  type RequestOptions,
  toEmptyApex,
  withoutTrailingDot,
} from "./shared.ts";

const API = "https://api.vercel.com";
const NAME = "Vercel";

interface VcRecord {
  id: string;
  name: string;
  type: string;
  value: string;
  ttl?: number;
  mxPriority?: number;
  creator?: string;
}

/**
 * Vercel DNS with an access token (optionally scoped to a team).
 * https://vercel.com/docs/rest-api/reference/endpoints/dns
 */
export class VercelAdapter implements DnsProviderAdapter {
  readonly key = "vercel";

  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async applyRecords(input: ApplyRecordsInput): Promise<ApplyRecordsResult> {
    const { apiToken } = requireCredentials(input.credentials, ["apiToken"], NAME);
    const teamId = optionalCredential(input.credentials, "teamId");
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
    const team = teamId ? `teamId=${encodeURIComponent(teamId)}` : "";
    const qs = (extra = "") => {
      const parts = [extra, team].filter(Boolean).join("&");
      return parts ? `?${parts}` : "";
    };
    const d = encodeURIComponent(zone);

    const existing: ExistingRecord<VcRecord>[] = [];
    let until: number | null = null;
    for (let i = 0; i < 50; i++) {
      const res = await httpRequest(
        this.fetchImpl,
        `${API}/v4/domains/${d}/records${qs(`limit=100${until ? `&until=${until}` : ""}`)}`,
        { method: "GET", headers },
        opts,
      );
      const body = res.json as {
        records?: VcRecord[];
        pagination?: { next?: number | null };
      };
      for (const r of body?.records ?? []) {
        existing.push({
          type: r.type,
          name: normalizeRelative(r.name),
          value: r.value,
          ttl: r.ttl,
          priority: r.mxPriority,
          raw: r,
        });
      }
      until = body?.pagination?.next ?? null;
      if (!until) break;
    }

    const ops = planChanges(input.records, existing);
    const mutate = { ...opts, notFoundIsZone: false };
    for (const op of ops) {
      if (op.kind === "delete") {
        await httpRequest(
          this.fetchImpl,
          `${API}/v2/domains/${d}/records/${op.existing.raw.id}${qs()}`,
          { method: "DELETE", headers },
          mutate,
        );
      } else if (op.kind === "update") {
        await httpRequest(
          this.fetchImpl,
          `${API}/v1/domains/records/${op.existing.raw.id}${qs()}`,
          { method: "PATCH", headers, body: JSON.stringify(toVcBody(op.record)) },
          mutate,
        );
      } else {
        await httpRequest(
          this.fetchImpl,
          `${API}/v2/domains/${d}/records${qs()}`,
          { method: "POST", headers, body: JSON.stringify(toVcBody(op.record)) },
          mutate,
        );
      }
    }
    return { written: countWritten(ops) };
  }
}

function toVcBody(record: ZoneRecord): Record<string, unknown> {
  const body: Record<string, unknown> = {
    name: toEmptyApex(record.name),
    type: record.type,
    value:
      record.type === "CNAME" || record.type === "MX"
        ? withoutTrailingDot(record.value)
        : record.value,
    ttl: clampTtl(record.ttl, 60),
  };
  if (record.type === "MX") body.mxPriority = record.priority ?? 10;
  return body;
}

function extractMessage(res: HttpResponse): string | undefined {
  const e = (res.json as { error?: { message?: string; code?: string } } | undefined)?.error;
  return e?.message || e?.code || undefined;
}

function classify(res: HttpResponse): ProviderApiError["code"] | undefined {
  const code = (res.json as { error?: { code?: string } } | undefined)?.error?.code;
  if (code === "forbidden" && res.status === 403) {
    const m = (extractMessage(res) ?? "").toLowerCase();
    if (m.includes("token") && (m.includes("invalid") || m.includes("expired"))) {
      return "invalid_credentials";
    }
  }
  if (code === "not_found") return "zone_not_found";
  return undefined;
}
