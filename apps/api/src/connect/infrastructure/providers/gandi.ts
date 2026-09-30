import type {
  ApplyRecordsInput,
  ApplyRecordsResult,
  DnsProviderAdapter,
} from "@/connect/domain/dns-provider.ts";
import {
  clampTtl,
  countWritten,
  type ExistingRecord,
  formatZoneFileValue,
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

const API = "https://api.gandi.net/v5/livedns";
const NAME = "Gandi";

interface GandiRRSet {
  rrset_name: string;
  rrset_type: string;
  rrset_ttl?: number;
  rrset_values: string[];
}

/**
 * Gandi LiveDNS v5 with a Personal Access Token ("Manage domain name
 * technical configurations" permission). RRset-based; values are in
 * zone-file presentation format.
 * https://api.gandi.net/docs/livedns/
 */
export class GandiAdapter implements DnsProviderAdapter {
  readonly key = "gandi";

  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async applyRecords(input: ApplyRecordsInput): Promise<ApplyRecordsResult> {
    const { apiToken } = requireCredentials(input.credentials, ["apiToken"], NAME);
    const zone = normalizeZone(input.zone);
    const opts: RequestOptions = { providerName: NAME, secrets: [apiToken], extractMessage };
    const headers = {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    };
    const base = `${API}/domains/${encodeURIComponent(zone)}/records`;

    const res = await httpRequest(this.fetchImpl, base, { method: "GET", headers }, opts);
    const sets = (res.json as GandiRRSet[] | undefined) ?? [];
    const existing: ExistingRecord<GandiRRSet>[] = [];
    for (const s of sets) {
      for (const v of s.rrset_values) {
        const mx = s.rrset_type === "MX" ? splitMx(v) : null;
        existing.push({
          type: s.rrset_type,
          name: normalizeRelative(s.rrset_name),
          value: mx ? mx.host : v,
          ttl: s.rrset_ttl,
          priority: mx?.priority,
          raw: s,
        });
      }
    }

    const ops = planChanges(input.records, existing);
    const mutate = { ...opts, notFoundIsZone: false };
    for (const set of rrsetChanges(existing, ops, 300)) {
      const path = `${base}/${encodeURIComponent(set.name)}/${set.type}`;
      if (set.records.length === 0) {
        await httpRequest(this.fetchImpl, path, { method: "DELETE", headers }, { ...mutate, allowStatuses: [404] });
        continue;
      }
      const values = [
        ...new Set(set.records.map((r) => formatZoneFileValue(set.type, r.value, r.priority, r.fromPlan))),
      ];
      await httpRequest(
        this.fetchImpl,
        path,
        {
          method: "PUT",
          headers,
          body: JSON.stringify({ rrset_values: values, rrset_ttl: clampTtl(set.records[0]!.ttl, 300) }),
        },
        mutate,
      );
    }
    return { written: countWritten(ops) };
  }
}

function extractMessage(res: HttpResponse): string | undefined {
  const j = res.json as
    | { message?: string; errors?: Array<{ description?: string; name?: string }> }
    | undefined;
  const errs = j?.errors?.map((e) => e.description ?? e.name).filter(Boolean);
  if (errs && errs.length > 0) return errs.join("; ");
  return j?.message || undefined;
}
