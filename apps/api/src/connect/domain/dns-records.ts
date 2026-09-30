import { isIPv4, isIPv6 } from "node:net";
import { domainToASCII } from "node:url";
import { parse as parseDomain } from "tldts";
import {
  DNS_RECORD_TYPES,
  type DnsRecordInput,
  type DnsRecordsConfig,
  type DnsRecordStatus,
  type DnsRecordType,
} from "@orbit/shared/connect";
import { ValidationError } from "@/kernel/errors.ts";

/**
 * Pure helpers for the two inputs Connect trusts least: the domain an end
 * user types into the modal, and the record templates an integrator
 * passes to `showConnect({ dnsRecords })`. Everything here is sync and
 * side-effect free so it can be unit-tested exhaustively.
 */

export interface ParsedDomain {
  /** Normalized ASCII hostname, e.g. `shop.acme.com`. */
  domain: string;
  /** Registrable domain / zone apex, e.g. `acme.com`. */
  rootDomain: string;
  /** Labels left of the root, e.g. `shop`. Null for the apex. */
  subdomain: string | null;
}

export interface ResolvedRecord {
  type: DnsRecordType;
  /** Relative to the zone apex: `@`, `www`, `shop`, `_verify.shop`. */
  host: string;
  fqdn: string;
  value: string;
  ttl: number;
  priority?: number;
  status: DnsRecordStatus;
  observed: string[];
}

const MAX_DOMAIN_LEN = 253;
const MAX_RECORDS = 20;
const MAX_VALUE_LEN = 2048;
const DEFAULT_TTL = 300;
const MIN_TTL = 60;
const MAX_TTL = 86_400;
const LABEL_RE = /^(?!-)[a-z0-9_-]{1,63}(?<!-)$/;
const PLACEHOLDER_RE = /\{(DOMAIN|ROOT_DOMAIN|SUBDOMAIN)\}/g;

/**
 * Accepts what people actually paste — `HTTPS://Shop.Acme.com/pricing`,
 * `www.acme.com.`, `bücher.de` — and returns the normalized hostname
 * split at the registrable-domain boundary (Public Suffix List, ICANN
 * section only, so `acme.vercel.app` resolves to `vercel.app`: a zone
 * the user can't edit, which is what we want to surface).
 */
export function parseUserDomain(raw: string): ParsedDomain {
  let host = raw.trim().toLowerCase();
  host = host.replace(/^[a-z][a-z0-9+.-]*:\/\//, "");
  host = host.split(/[/?#]/, 1)[0] ?? "";
  host = host.replace(/^[^@]*@/, "");
  host = host.replace(/:\d+$/, "");
  host = host.replace(/\.+$/, "");
  const ascii = domainToASCII(host);
  if (!ascii || ascii.length > MAX_DOMAIN_LEN) {
    throw invalidDomain();
  }
  const labels = ascii.split(".");
  if (labels.length < 2 || !labels.every((l) => LABEL_RE.test(l) && !l.includes("_"))) {
    throw invalidDomain();
  }
  const parsed = parseDomain(ascii);
  if (parsed.isIp || !parsed.domain || !parsed.publicSuffix) {
    throw invalidDomain();
  }
  return {
    domain: ascii,
    rootDomain: parsed.domain,
    subdomain: parsed.subdomain ? parsed.subdomain : null,
  };
}

function invalidDomain(): ValidationError {
  return new ValidationError(
    "domain.invalid",
    "Enter a domain you own, like example.com or shop.example.com.",
  );
}

function invalidRecords(message: string): ValidationError {
  return new ValidationError("dns_records.invalid", message);
}

/** Picks the record set for this domain from a flat or split config. */
export function selectRecordTemplates(
  config: DnsRecordsConfig,
  domain: ParsedDomain,
): readonly DnsRecordInput[] {
  if (Array.isArray(config)) return config;
  return domain.subdomain === null ? config.domain : config.subDomain;
}

/**
 * Substitutes placeholders and validates each record, returning them
 * relative to the zone apex so provider adapters and the verifier share
 * one representation. Duplicate (type, fqdn, value) rows are collapsed.
 */
export function resolveRecords(
  config: DnsRecordsConfig,
  domain: ParsedDomain,
): ResolvedRecord[] {
  const templates = selectRecordTemplates(config, domain);
  if (!Array.isArray(templates) || templates.length === 0) {
    throw invalidRecords("dnsRecords must contain at least one record for this domain");
  }
  if (templates.length > MAX_RECORDS) {
    throw invalidRecords(`dnsRecords supports at most ${MAX_RECORDS} records`);
  }
  const vars: Record<string, string> = {
    DOMAIN: domain.domain,
    ROOT_DOMAIN: domain.rootDomain,
    SUBDOMAIN: domain.subdomain ?? "",
  };
  const fill = (s: string) => s.replace(PLACEHOLDER_RE, (_, k: string) => vars[k] ?? "");

  const seen = new Set<string>();
  const out: ResolvedRecord[] = [];
  templates.forEach((t, i) => {
    const where = `dnsRecords[${i}]`;
    if (!t || typeof t !== "object") throw invalidRecords(`${where} must be an object`);
    const type = String(t.type ?? "").toUpperCase() as DnsRecordType;
    if (!DNS_RECORD_TYPES.includes(type)) {
      throw invalidRecords(`${where}.type must be one of ${DNS_RECORD_TYPES.join(", ")}`);
    }
    if (typeof t.host !== "string" || typeof t.value !== "string") {
      throw invalidRecords(`${where} needs string host and value`);
    }

    const fqdn = hostToFqdn(fill(t.host), domain.domain, where);
    if (fqdn !== domain.rootDomain && !fqdn.endsWith(`.${domain.rootDomain}`)) {
      throw invalidRecords(`${where}.host must stay inside ${domain.rootDomain}`);
    }
    const host = fqdn === domain.rootDomain ? "@" : fqdn.slice(0, -(domain.rootDomain.length + 1));
    const value = normalizeValue(type, fill(t.value).trim(), where);

    if (type === "CNAME" && host === "@") {
      throw invalidRecords(
        `${where}: a CNAME can't live on the apex of ${domain.rootDomain}; use an A record for the root domain (see the { domain, subDomain } form)`,
      );
    }

    const ttl = t.ttl ?? DEFAULT_TTL;
    if (!Number.isInteger(ttl) || ttl < MIN_TTL || ttl > MAX_TTL) {
      throw invalidRecords(`${where}.ttl must be an integer between ${MIN_TTL} and ${MAX_TTL}`);
    }
    let priority: number | undefined;
    if (type === "MX") {
      const p = t.priority ?? 10;
      if (!Number.isInteger(p) || p < 0 || p > 65_535) {
        throw invalidRecords(`${where}.priority must be an integer between 0 and 65535`);
      }
      priority = p;
    }

    const key = `${type}|${fqdn}|${value}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({
      type,
      host,
      fqdn,
      value,
      ttl,
      ...(priority !== undefined ? { priority } : {}),
      status: "pending",
      observed: [],
    });
  });

  const cnameNames = new Set(out.filter((r) => r.type === "CNAME").map((r) => r.fqdn));
  for (const r of out) {
    if (cnameNames.has(r.fqdn) && r.type !== "CNAME") {
      throw invalidRecords(`${r.fqdn} can't have a CNAME alongside other records`);
    }
  }
  if (out.filter((r) => r.type === "CNAME").length !== cnameNames.size) {
    throw invalidRecords("a name can only have one CNAME record");
  }
  return out;
}

function hostToFqdn(rawHost: string, base: string, where: string): string {
  const host = rawHost.trim().toLowerCase().replace(/\.+$/, "");
  if (host === "" || host === "@") return base;
  // A host that already ends in the base domain is treated as absolute.
  if (host === base || host.endsWith(`.${base}`)) return host;
  const labels = host.split(".");
  if (!labels.every((l) => l === "*" || LABEL_RE.test(l))) {
    throw invalidRecords(`${where}.host '${rawHost}' is not a valid DNS name`);
  }
  if (labels.slice(1).includes("*")) {
    throw invalidRecords(`${where}.host: '*' is only allowed as the left-most label`);
  }
  return `${host}.${base}`;
}

function normalizeValue(type: DnsRecordType, value: string, where: string): string {
  if (!value) throw invalidRecords(`${where}.value is required`);
  if (value.length > MAX_VALUE_LEN) throw invalidRecords(`${where}.value is too long`);
  switch (type) {
    case "A":
      if (!isIPv4(value)) throw invalidRecords(`${where}.value must be an IPv4 address`);
      return value;
    case "AAAA":
      if (!isIPv6(value)) throw invalidRecords(`${where}.value must be an IPv6 address`);
      return value.toLowerCase();
    case "CNAME":
    case "MX": {
      const target = value.toLowerCase().replace(/\.+$/, "");
      const labels = target.split(".");
      if (labels.length < 2 || !labels.every((l) => LABEL_RE.test(l))) {
        throw invalidRecords(`${where}.value must be a hostname`);
      }
      return target;
    }
    case "CAA": {
      const m = /^(\d{1,3})\s+(issue|issuewild|iodef)\s+"?([^"]*)"?$/i.exec(value);
      if (!m || Number(m[1]) > 255) {
        throw invalidRecords(`${where}.value must look like: 0 issue "letsencrypt.org"`);
      }
      return `${Number(m[1])} ${m[2]!.toLowerCase()} "${m[3]}"`;
    }
    case "TXT":
      // Resolvers hand TXT back as unquoted chunks; store it the same way.
      return value.replace(/^"(.*)"$/s, "$1");
  }
}
