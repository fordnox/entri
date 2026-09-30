import {
  type ApplyRecordsInput,
  type ApplyRecordsResult,
  type DnsProviderAdapter,
  ProviderApiError,
} from "@/connect/domain/dns-provider.ts";
import { signV4 } from "./aws-sigv4.ts";
import {
  clampTtl,
  countWritten,
  decodeXml,
  formatZoneFileValue,
  type ExistingRecord,
  fromFqdn,
  httpRequest,
  type HttpResponse,
  normalizeZone,
  optionalCredential,
  planChanges,
  requireCredentials,
  type RequestOptions,
  rrsetChanges,
  splitMx,
  toFqdn,
  withTrailingDot,
} from "./shared.ts";

const HOST = "https://route53.amazonaws.com";
const VERSION = "2013-04-01";
const NAME = "Amazon Route 53";

export interface R53RRSet {
  name: string;
  type: string;
  ttl?: number;
  values: string[];
  alias: boolean;
  setIdentifier?: string;
}

/**
 * Amazon Route 53 with an IAM access key (needs
 * `route53:ListHostedZonesByName`, `route53:ListResourceRecordSets`,
 * `route53:ChangeResourceRecordSets`). Requests are SigV4-signed by
 * hand. UPSERT replaces the whole RRset, so TXT/MX/CAA values are
 * merged with the existing set first.
 * https://docs.aws.amazon.com/Route53/latest/APIReference/API_ChangeResourceRecordSets.html
 */
export class Route53Adapter implements DnsProviderAdapter {
  readonly key = "route53";

  constructor(
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async applyRecords(input: ApplyRecordsInput): Promise<ApplyRecordsResult> {
    const { accessKeyId, secretAccessKey } = requireCredentials(
      input.credentials,
      ["accessKeyId", "secretAccessKey"],
      NAME,
    );
    const sessionToken = optionalCredential(input.credentials, "sessionToken");
    const zone = normalizeZone(input.zone);
    const opts: RequestOptions = {
      providerName: NAME,
      secrets: [accessKeyId, secretAccessKey, ...(sessionToken ? [sessionToken] : [])],
      notFoundIsZone: false,
      extractMessage,
      classify,
    };

    const call = (method: string, path: string, body?: string) => {
      const url = `${HOST}/${VERSION}${path}`;
      const signed = signV4({
        method,
        url,
        headers: body ? { "content-type": "application/xml" } : {},
        body,
        accessKeyId,
        secretAccessKey,
        sessionToken,
        region: "us-east-1",
        service: "route53",
        date: this.now(),
      });
      return httpRequest(this.fetchImpl, url, { method, headers: signed.headers, body }, opts);
    };

    // 1. Find the public hosted zone.
    const zonesXml = (
      await call("GET", `/hostedzonesbyname?dnsname=${encodeURIComponent(zone)}&maxitems=20`)
    ).text;
    const zoneId = findHostedZoneId(zonesXml, zone);
    if (!zoneId) {
      throw new ProviderApiError(
        `This domain wasn't found as a public hosted zone in your ${NAME} account.`,
        "zone_not_found",
      );
    }

    // 2. Read existing record sets.
    const sets: R53RRSet[] = [];
    let next: { name: string; type: string; id?: string } | null = null;
    for (let i = 0; i < 100; i++) {
      let qs = "maxitems=300";
      if (next) {
        qs += `&name=${encodeURIComponent(next.name)}&type=${next.type}`;
        if (next.id) qs += `&identifier=${encodeURIComponent(next.id)}`;
      }
      const xml = (await call("GET", `/hostedzone/${zoneId}/rrset?${qs}`)).text;
      sets.push(...parseRRSets(xml));
      if (tag(xml, "IsTruncated") !== "true") break;
      const nn = tag(xml, "NextRecordName");
      const nt = tag(xml, "NextRecordType");
      if (!nn || !nt) break;
      next = { name: nn, type: nt, id: tag(xml, "NextRecordIdentifier") ?? undefined };
    }

    const existing: ExistingRecord<R53RRSet>[] = [];
    for (const s of sets) {
      if (s.alias || s.setIdentifier) continue;
      for (const v of s.values) {
        const mx = s.type === "MX" ? splitMx(v) : null;
        existing.push({
          type: s.type,
          name: fromFqdn(s.name, zone),
          value: mx ? mx.host : v,
          ttl: s.ttl,
          priority: mx?.priority,
          raw: s,
        });
      }
    }

    // 3. Plan and submit one atomic change batch.
    const ops = planChanges(input.records, existing);
    const changes = rrsetChanges(existing, ops, 300);
    if (changes.length === 0) return { written: 0 };

    const changeXml = changes.map((c) => {
      if (c.records.length === 0) {
        const raw = c.before[0]!.raw;
        return changeElement("DELETE", raw.name, raw.type, raw.ttl ?? 300, raw.values);
      }
      const values = [
        ...new Set(c.records.map((r) => formatZoneFileValue(c.type, r.value, r.priority, r.fromPlan))),
      ];
      return changeElement(
        "UPSERT",
        withTrailingDot(toFqdn(c.name, zone)),
        c.type,
        clampTtl(c.records[0]!.ttl, 0),
        values,
      );
    });
    const body =
      `<?xml version="1.0" encoding="UTF-8"?>` +
      `<ChangeResourceRecordSetsRequest xmlns="https://route53.amazonaws.com/doc/${VERSION}/">` +
      `<ChangeBatch><Comment>Connect domain setup</Comment><Changes>${changeXml.join("")}</Changes></ChangeBatch>` +
      `</ChangeResourceRecordSetsRequest>`;
    await call("POST", `/hostedzone/${zoneId}/rrset`, body);
    return { written: countWritten(ops) };
  }
}

function changeElement(
  action: "UPSERT" | "DELETE",
  name: string,
  type: string,
  ttl: number,
  values: readonly string[],
): string {
  return (
    `<Change><Action>${action}</Action><ResourceRecordSet>` +
    `<Name>${escapeXml(name)}</Name><Type>${type}</Type><TTL>${ttl}</TTL>` +
    `<ResourceRecords>${values
      .map((v) => `<ResourceRecord><Value>${escapeXml(v)}</Value></ResourceRecord>`)
      .join("")}</ResourceRecords>` +
    `</ResourceRecordSet></Change>`
  );
}

export function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function tag(xml: string, name: string): string | null {
  const m = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`).exec(xml);
  return m ? decodeXml(m[1]!.trim()) : null;
}

/** Route 53 escapes special characters in names as `\DDD` octal. */
function decodeR53Name(s: string): string {
  return s.replace(/\\(\d{3})/g, (_, o: string) => String.fromCharCode(parseInt(o, 8)));
}

export function findHostedZoneId(xml: string, zone: string): string | null {
  const re = /<HostedZone>([\s\S]*?)<\/HostedZone>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const block = m[1]!;
    const name = decodeR53Name(tag(block, "Name") ?? "").toLowerCase().replace(/\.$/, "");
    const priv = tag(block, "PrivateZone");
    if (name === zone && priv !== "true") {
      return (tag(block, "Id") ?? "").replace(/^\/hostedzone\//, "") || null;
    }
  }
  return null;
}

export function parseRRSets(xml: string): R53RRSet[] {
  const out: R53RRSet[] = [];
  const re = /<ResourceRecordSet>([\s\S]*?)<\/ResourceRecordSet>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const block = m[1]!;
    const values: string[] = [];
    const vr = /<Value>([\s\S]*?)<\/Value>/g;
    let v: RegExpExecArray | null;
    while ((v = vr.exec(block))) values.push(decodeXml(v[1]!));
    const ttl = tag(block, "TTL");
    out.push({
      name: decodeR53Name(tag(block, "Name") ?? ""),
      type: tag(block, "Type") ?? "",
      ttl: ttl ? Number(ttl) : undefined,
      values,
      alias: block.includes("<AliasTarget>"),
      setIdentifier: tag(block, "SetIdentifier") ?? undefined,
    });
  }
  return out;
}

function extractMessage(res: HttpResponse): string | undefined {
  return tag(res.text, "Message") ?? undefined;
}

function classify(res: HttpResponse): ProviderApiError["code"] | undefined {
  const code = tag(res.text, "Code");
  switch (code) {
    case "InvalidClientTokenId":
    case "SignatureDoesNotMatch":
    case "UnrecognizedClientException":
    case "IncompleteSignature":
    case "MissingAuthenticationToken":
    case "ExpiredToken":
      return "invalid_credentials";
    case "AccessDenied":
    case "AccessDeniedException":
      return "permission_denied";
    case "NoSuchHostedZone":
      return "zone_not_found";
    case "Throttling":
    case "ThrottlingException":
    case "PriorRequestNotComplete":
      return "rate_limited";
    default:
      return undefined;
  }
}
