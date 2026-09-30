import {
  type ApplyRecordsInput,
  type ApplyRecordsResult,
  type DnsProviderAdapter,
  ProviderApiError,
} from "@/connect/domain/dns-provider.ts";
import {
  clampTtl,
  countWritten,
  decodeXml,
  type ExistingRecord,
  httpRequest,
  messageFor,
  normalizeRelative,
  normalizeZone,
  planChanges,
  requireCredentials,
  withTrailingDot,
} from "./shared.ts";

const API = "https://api.namecheap.com/xml.response";
const NAME = "Namecheap";

export interface NcHost {
  name: string;
  type: string;
  address: string;
  mxPref?: string;
  ttl?: string;
}

/**
 * Namecheap XML API. `namecheap.domains.dns.setHosts` REPLACES every
 * host record on the domain, so we always `getHosts` first, merge, and
 * send back the complete list (including record types Connect doesn't
 * manage, e.g. URL redirects). Requires API access to be enabled and
 * the caller's IP whitelisted — `clientIp` is that whitelisted IP.
 * https://www.namecheap.com/support/api/methods/domains-dns/set-hosts/
 */
export class NamecheapAdapter implements DnsProviderAdapter {
  readonly key = "namecheap";

  constructor(
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly endpoint: string = API,
  ) {}

  async applyRecords(input: ApplyRecordsInput): Promise<ApplyRecordsResult> {
    const creds = requireCredentials(
      input.credentials,
      ["apiUser", "apiKey", "username", "clientIp"],
      NAME,
    );
    const secrets = [creds.apiKey];
    const zone = normalizeZone(input.zone);
    const dot = zone.indexOf(".");
    if (dot <= 0) throw new ProviderApiError(`"${zone}" is not a valid domain.`, "zone_not_found");
    const sld = zone.slice(0, dot);
    const tld = zone.slice(dot + 1);

    const call = async (command: string, params: Record<string, string>) => {
      const body = new URLSearchParams({
        ApiUser: creds.apiUser,
        ApiKey: creds.apiKey,
        UserName: creds.username,
        ClientIp: creds.clientIp,
        Command: command,
        SLD: sld,
        TLD: tld,
        ...params,
      });
      const res = await httpRequest(
        this.fetchImpl,
        this.endpoint,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: body.toString(),
        },
        { providerName: NAME, secrets, notFoundIsZone: false },
      );
      assertOk(res.text, secrets);
      return res.text;
    };

    const xml = await call("namecheap.domains.dns.getHosts", {});
    const result = /<DomainDNSGetHostsResult\b([^>]*)>/i.exec(xml);
    const resultAttrs = parseAttrs(result?.[1] ?? "");
    if (resultAttrs.isusingourdns?.toLowerCase() === "false") {
      throw new ProviderApiError(
        "This domain isn't using Namecheap BasicDNS, so its records can't be edited through Namecheap.",
        "provider_error",
      );
    }
    const hosts = parseHosts(xml);
    const existing: ExistingRecord<NcHost>[] = hosts.map((h) => ({
      type: h.type.toUpperCase(),
      name: normalizeRelative(h.name),
      value: h.address,
      ttl: h.ttl ? Number(h.ttl) : undefined,
      priority: h.type.toUpperCase() === "MX" && h.mxPref ? Number(h.mxPref) : undefined,
      raw: h,
    }));

    const ops = planChanges(input.records, existing);
    if (ops.length === 0) return { written: 0 };

    const removed = new Set<NcHost>();
    const next: NcHost[] = [];
    for (const op of ops) if (op.kind !== "create") removed.add(op.existing.raw);
    for (const h of hosts) if (!removed.has(h)) next.push(h);
    for (const op of ops) {
      if (op.kind === "delete") continue;
      const r = op.record;
      next.push({
        name: normalizeRelative(r.name),
        type: r.type,
        address: r.type === "CNAME" || r.type === "MX" ? withTrailingDot(r.value) : r.value,
        mxPref: r.type === "MX" ? String(r.priority ?? 10) : undefined,
        ttl: String(clampTtl(r.ttl, 60, 60000)),
      });
    }

    await call("namecheap.domains.dns.setHosts", buildSetHostsParams(next, resultAttrs.emailtype));
    return { written: countWritten(ops) };
  }
}

export function buildSetHostsParams(
  hosts: readonly NcHost[],
  currentEmailType?: string,
): Record<string, string> {
  const params: Record<string, string> = {};
  hosts.forEach((h, i) => {
    const n = i + 1;
    params[`HostName${n}`] = h.name;
    params[`RecordType${n}`] = h.type;
    params[`Address${n}`] = h.address;
    if (h.ttl) params[`TTL${n}`] = h.ttl;
    if (h.type.toUpperCase() === "MX") params[`MXPref${n}`] = h.mxPref ?? "10";
  });
  const hasMx = hosts.some((h) => h.type.toUpperCase() === "MX");
  if (hasMx) params.EmailType = "MX";
  else if (currentEmailType && currentEmailType.toUpperCase() !== "MX") {
    params.EmailType = currentEmailType;
  }
  return params;
}

export function parseHosts(xml: string): NcHost[] {
  const out: NcHost[] = [];
  const re = /<host\b([^>]*?)\/?>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const a = parseAttrs(m[1]!);
    if (!a.type || a.name === undefined) continue;
    out.push({
      name: a.name,
      type: a.type,
      address: a.address ?? "",
      mxPref: a.mxpref,
      ttl: a.ttl,
    });
  }
  return out;
}

/** Attribute names are lowercased. */
export function parseAttrs(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([A-Za-z_:][\w:.-]*)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) out[m[1]!.toLowerCase()] = decodeXml(m[3] ?? m[4] ?? "");
  return out;
}

function assertOk(xml: string, secrets: readonly string[]): void {
  const status = /<ApiResponse\b[^>]*\bStatus\s*=\s*"([^"]*)"/i.exec(xml)?.[1];
  if (status?.toUpperCase() === "OK") return;
  const err = /<Error\b([^>]*)>([\s\S]*?)<\/Error>/i.exec(xml);
  const number = err ? parseAttrs(err[1]!).number : undefined;
  const text = err ? decodeXml(err[2]!.trim()) : "unexpected response";
  const code = classifyError(number, text);
  throw new ProviderApiError(messageFor(code, NAME, text, secrets), code);
}

function classifyError(number: string | undefined, text: string): ProviderApiError["code"] {
  const t = text.toLowerCase();
  // 1011102: API key invalid / API access disabled. 1011150: request IP not whitelisted.
  // 1010101/1010102/1010104/1011101: missing or invalid ApiUser/ApiKey/UserName.
  if (
    number === "1011102" ||
    number === "1011150" ||
    number === "1010101" ||
    number === "1010102" ||
    number === "1010104" ||
    number === "1011101" ||
    t.includes("api key is invalid") ||
    t.includes("invalid request ip")
  ) {
    return "invalid_credentials";
  }
  // 2019166: domain not found. 2016166: domain not associated with this account.
  if (number === "2019166" || number === "2016166" || t.includes("domain not found")) {
    return "zone_not_found";
  }
  if (t.includes("too many requests") || t.includes("rate limit")) return "rate_limited";
  if (t.includes("permission") || t.includes("not allowed")) return "permission_denied";
  return "provider_error";
}
