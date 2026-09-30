import type { RecordObservation } from "../domain/domain-connection.ts";
import type { ResolvedRecord } from "../domain/dns-records.ts";
import type { DnsLookup } from "./ports.ts";

/**
 * Looks every record up in parallel and reports whether its expected
 * value is among what resolvers currently return. Presence, not
 * equality: an apex that also carries the integrator's A record plus
 * an unrelated TXT is still "verified" for the TXT we care about.
 */
export async function observeRecords(
  lookup: DnsLookup,
  records: readonly ResolvedRecord[],
): Promise<RecordObservation[]> {
  return Promise.all(
    records.map(async (r) => {
      let observed: string[];
      try {
        observed = await lookup.lookup(r.type, r.fqdn);
      } catch {
        observed = [];
      }
      const expected = r.type === "MX" ? `${r.priority ?? 10} ${r.value}` : r.value;
      return { observed, matches: observed.includes(expected) };
    }),
  );
}
