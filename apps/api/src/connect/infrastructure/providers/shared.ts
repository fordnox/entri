/**
 * Helpers shared by every DNS provider adapter: credential checks,
 * HTTP error mapping, record-name translation, value normalization and
 * the upsert planner that implements the semantics documented on
 * `DnsProviderAdapter`.
 */
import type { DnsRecordType } from "@orbit/shared/connect";
import {
  ProviderApiError,
  type ZoneRecord,
} from "@/connect/domain/dns-provider.ts";

export type FetchLike = typeof fetch;

/** Record types Connect writes (and therefore may replace/remove). */
export const MANAGED_TYPES: readonly DnsRecordType[] = [
  "A",
  "AAAA",
  "CNAME",
  "TXT",
  "MX",
  "CAA",
];

// ── Credentials ──────────────────────────────────────────────────────────

/**
 * Returns the trimmed values of `keys`, throwing `invalid_credentials`
 * when any is missing or blank. Optional keys are returned as-is
 * (trimmed, or undefined).
 */
export function requireCredentials<K extends string>(
  credentials: Readonly<Record<string, string>>,
  keys: readonly K[],
  providerName: string,
): Record<K, string> {
  const out = {} as Record<K, string>;
  const missing: string[] = [];
  for (const key of keys) {
    const raw = credentials[key];
    const value = typeof raw === "string" ? raw.trim() : "";
    if (!value) missing.push(key);
    out[key] = value;
  }
  if (missing.length > 0) {
    throw new ProviderApiError(
      `Missing ${providerName} credentials: ${missing.join(", ")}.`,
      "invalid_credentials",
    );
  }
  return out;
}

export function optionalCredential(
  credentials: Readonly<Record<string, string>>,
  key: string,
): string | undefined {
  const raw = credentials[key];
  const value = typeof raw === "string" ? raw.trim() : "";
  return value || undefined;
}

// ── HTTP ─────────────────────────────────────────────────────────────────

export interface HttpResponse {
  status: number;
  text: string;
  /** Parsed JSON body, or undefined when the body is empty / not JSON. */
  json: unknown;
  headers: Headers;
}

export interface RequestOptions {
  providerName: string;
  /** Credential values to scrub from any error message. */
  secrets: readonly string[];
  /** Map a 404 to `zone_not_found` (default true). */
  notFoundIsZone?: boolean;
  /** Statuses returned to the caller instead of throwing. */
  allowStatuses?: readonly number[];
  /** Pull a human message out of an error body. */
  extractMessage?: (res: HttpResponse) => string | undefined;
  /**
   * Classify an error response beyond the default status mapping.
   * Return undefined to fall back to the default.
   */
  classify?: (res: HttpResponse) => ProviderApiError["code"] | undefined;
}

export async function httpRequest(
  fetchImpl: FetchLike,
  url: string,
  init: RequestInit,
  opts: RequestOptions,
): Promise<HttpResponse> {
  let response: Response;
  try {
    response = await fetchImpl(url, init);
  } catch {
    throw new ProviderApiError(
      `Could not reach ${opts.providerName}. Please try again in a moment.`,
      "provider_error",
    );
  }
  const text = await response.text().catch(() => "");
  let json: unknown;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = undefined;
    }
  }
  const res: HttpResponse = {
    status: response.status,
    text,
    json,
    headers: response.headers,
  };
  if (response.ok || opts.allowStatuses?.includes(response.status)) return res;
  throw errorFromResponse(res, opts);
}

export function errorFromResponse(
  res: HttpResponse,
  opts: RequestOptions,
): ProviderApiError {
  const detail = opts.extractMessage?.(res) ?? defaultExtractMessage(res);
  const code = opts.classify?.(res) ?? codeForStatus(res.status, opts);
  return new ProviderApiError(
    messageFor(code, opts.providerName, detail, opts.secrets),
    code,
  );
}

function codeForStatus(
  status: number,
  opts: RequestOptions,
): ProviderApiError["code"] {
  if (status === 401) return "invalid_credentials";
  if (status === 403) return "permission_denied";
  if (status === 404 && opts.notFoundIsZone !== false) return "zone_not_found";
  if (status === 429) return "rate_limited";
  return "provider_error";
}

export function messageFor(
  code: ProviderApiError["code"],
  providerName: string,
  detail: string | undefined,
  secrets: readonly string[],
): string {
  const base = {
    invalid_credentials: `${providerName} rejected these credentials.`,
    permission_denied: `These ${providerName} credentials don't have permission to edit DNS for this domain.`,
    zone_not_found: `This domain wasn't found in your ${providerName} account.`,
    rate_limited: `${providerName} is rate limiting requests. Please wait a minute and try again.`,
    provider_error: `${providerName} returned an error.`,
  }[code];
  const clean = detail ? scrub(detail, secrets) : "";
  return clean ? `${base} (${clean})` : base;
}

/** Removes credential values from a string and caps its length. */
export function scrub(message: string, secrets: readonly string[]): string {
  let out = message;
  for (const secret of secrets) {
    if (secret && secret.length >= 4) out = out.split(secret).join("***");
  }
  out = out.replace(/\s+/g, " ").trim();
  return out.length > 240 ? `${out.slice(0, 237)}...` : out;
}

function defaultExtractMessage(res: HttpResponse): string | undefined {
  const j = res.json as Record<string, unknown> | undefined;
  if (j && typeof j === "object") {
    for (const key of ["message", "error_description", "detail", "error"]) {
      const v = j[key];
      if (typeof v === "string" && v) return v;
      if (v && typeof v === "object") {
        const m = (v as Record<string, unknown>).message;
        if (typeof m === "string" && m) return m;
      }
    }
  }
  return undefined;
}

export function providerError(
  providerName: string,
  detail: string,
  code: ProviderApiError["code"] = "provider_error",
  secrets: readonly string[] = [],
): ProviderApiError {
  return new ProviderApiError(
    messageFor(code, providerName, detail, secrets),
    code,
  );
}

// ── Names ────────────────────────────────────────────────────────────────

export function normalizeZone(zone: string): string {
  return zone.trim().toLowerCase().replace(/\.+$/, "");
}

/** `"@"`, `""` → `"@"`; otherwise lowercased relative label(s). */
export function normalizeRelative(name: string): string {
  const n = name.trim().toLowerCase().replace(/\.+$/, "");
  return n === "" || n === "@" ? "@" : n;
}

/** Relative name → FQDN without trailing dot. */
export function toFqdn(name: string, zone: string): string {
  const rel = normalizeRelative(name);
  return rel === "@" ? zone : `${rel}.${zone}`;
}

/** FQDN (with or without trailing dot) → relative name (`"@"` for apex). */
export function fromFqdn(fqdn: string, zone: string): string {
  const n = fqdn.trim().toLowerCase().replace(/\.+$/, "");
  if (n === "" || n === zone || n === "@") return "@";
  if (n.endsWith(`.${zone}`)) return n.slice(0, -(zone.length + 1));
  return n;
}

/** Relative name → `""` for apex (Vercel, Porkbun, DNSimple, name.com). */
export function toEmptyApex(name: string): string {
  const rel = normalizeRelative(name);
  return rel === "@" ? "" : rel;
}

export function withTrailingDot(host: string): string {
  const h = host.trim();
  return h.endsWith(".") ? h : `${h}.`;
}

export function withoutTrailingDot(host: string): string {
  return host.trim().replace(/\.+$/, "");
}

// ── Values ───────────────────────────────────────────────────────────────

/**
 * Parses a TXT value that may be presentation-format quoted
 * (`"abc" "def"`) into its raw string. Unquoted input is returned as-is.
 */
export function unquoteTxt(value: string): string {
  const v = value.trim();
  if (!v.startsWith('"')) return v;
  let out = "";
  let i = 0;
  while (i < v.length) {
    if (v[i] !== '"') {
      i++;
      continue;
    }
    i++;
    while (i < v.length && v[i] !== '"') {
      if (v[i] === "\\" && i + 1 < v.length) {
        out += v[i + 1];
        i += 2;
      } else {
        out += v[i];
        i++;
      }
    }
    i++;
  }
  return out;
}

/** Raw TXT string → presentation format, split into ≤255-char strings. */
export function quoteTxt(value: string): string {
  const raw = unquoteTxt(value);
  const chunks: string[] = [];
  for (let i = 0; i < raw.length; i += 255) chunks.push(raw.slice(i, i + 255));
  if (chunks.length === 0) chunks.push("");
  return chunks
    .map((c) => `"${c.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`)
    .join(" ");
}

export interface CaaParts {
  flags: number;
  tag: string;
  value: string;
}

/** `0 issue "letsencrypt.org"` → parts. */
export function parseCaa(value: string): CaaParts {
  const m = /^\s*(\d+)\s+([a-zA-Z0-9]+)\s+(.*)$/.exec(value);
  if (!m) return { flags: 0, tag: "issue", value: stripQuotes(value) };
  return { flags: Number(m[1]), tag: m[2]!.toLowerCase(), value: stripQuotes(m[3]!) };
}

export function formatCaa(parts: CaaParts): string {
  return `${parts.flags} ${parts.tag} "${parts.value}"`;
}

function stripQuotes(v: string): string {
  const t = v.trim();
  return t.length >= 2 && t.startsWith('"') && t.endsWith('"') ? t.slice(1, -1) : t;
}

/** Comparison key for a record value (priority folded in for MX). */
export function valueKey(
  type: string,
  value: string,
  priority?: number,
): string {
  switch (type) {
    case "CNAME":
      return withoutTrailingDot(value).toLowerCase();
    case "MX":
      return `${priority ?? 0} ${withoutTrailingDot(value).toLowerCase()}`;
    case "TXT":
      return unquoteTxt(value);
    case "CAA": {
      const p = parseCaa(value);
      return `${p.flags} ${p.tag} ${p.value.toLowerCase()}`;
    }
    default:
      return value.trim().toLowerCase();
  }
}

/** Splits `10 mail.example.com.` into priority + host. */
export function splitMx(value: string): { priority: number; host: string } {
  const m = /^\s*(\d+)\s+(\S+)\s*$/.exec(value);
  if (!m) return { priority: 0, host: value.trim() };
  return { priority: Number(m[1]), host: m[2]! };
}

// ── Planner ──────────────────────────────────────────────────────────────

/** A record currently in the zone, as read back from the provider. */
export interface ExistingRecord<R = unknown> {
  type: string;
  /** Relative name, `"@"` for apex. */
  name: string;
  /** Provider value, in the provider's own format (normalized for comparison). */
  value: string;
  ttl?: number;
  priority?: number;
  raw: R;
}

export type PlanOp<R = unknown> =
  | { kind: "create"; record: ZoneRecord }
  | { kind: "update"; existing: ExistingRecord<R>; record: ZoneRecord }
  | { kind: "delete"; existing: ExistingRecord<R> };

/**
 * Computes the minimal set of per-record changes implementing the
 * `DnsProviderAdapter` upsert semantics. Deletes come first so a
 * conflicting A/CNAME is gone before its replacement is created.
 */
export function planChanges<R>(
  desiredIn: readonly ZoneRecord[],
  existingIn: readonly ExistingRecord<R>[],
): PlanOp<R>[] {
  const desired = dedupe(
    desiredIn.map((r) => ({ ...r, name: normalizeRelative(r.name) })),
  );
  const existing = existingIn.map((e) => ({
    e,
    name: normalizeRelative(e.name),
    type: e.type.toUpperCase(),
    key: valueKey(e.type.toUpperCase(), e.value, e.priority),
  }));

  const ops: PlanOp<R>[] = [];
  const deletes: PlanOp<R>[] = [];
  const names = [...new Set(desired.map((d) => d.name))];

  for (const name of names) {
    const want = desired.filter((d) => d.name === name);
    const here = existing.filter((x) => x.name === name);
    const remove = new Set<(typeof here)[number]>();

    const wantKeys = new Set(want.map((w) => `${w.type}|${valueKey(w.type, w.value, w.priority)}`));
    const wantsCname = want.some((w) => w.type === "CNAME");

    if (wantsCname) {
      for (const x of here) {
        if (!MANAGED_TYPES.includes(x.type as DnsRecordType)) continue;
        if (!wantKeys.has(`${x.type}|${x.key}`)) remove.add(x);
      }
    }
    for (const t of ["A", "AAAA"] as const) {
      if (!want.some((w) => w.type === t)) continue;
      for (const x of here) {
        if (x.type === "CNAME") remove.add(x);
        if (x.type === t && !wantKeys.has(`${t}|${x.key}`)) remove.add(x);
      }
    }

    const toWrite = want.filter(
      (w) =>
        !here.some(
          (x) =>
            !remove.has(x) &&
            x.type === w.type &&
            x.key === valueKey(w.type, w.value, w.priority),
        ),
    );

    const pool = [...remove];
    for (const record of toWrite) {
      const idx = pool.findIndex((x) => x.type === record.type);
      if (idx >= 0) {
        const [x] = pool.splice(idx, 1);
        ops.push({ kind: "update", existing: x!.e, record });
      } else {
        ops.push({ kind: "create", record });
      }
    }
    for (const x of pool) deletes.push({ kind: "delete", existing: x.e });
  }

  return [...deletes, ...ops.filter((o) => o.kind === "update"), ...ops.filter((o) => o.kind === "create")];
}

function dedupe(records: ZoneRecord[]): ZoneRecord[] {
  const seen = new Set<string>();
  const out: ZoneRecord[] = [];
  for (const r of records) {
    const k = `${r.type}|${r.name}|${valueKey(r.type, r.value, r.priority)}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}

export function countWritten(ops: readonly PlanOp[]): number {
  return ops.filter((o) => o.kind !== "delete").length;
}

/** Final state of one (type, name) RRset after applying a plan. */
export interface RRSetChange<R = unknown> {
  type: string;
  name: string;
  /** Records remaining in the set. Empty → delete the set. */
  records: Array<{ value: string; ttl: number; priority?: number; fromPlan: boolean }>;
  /** Existing members before the change. */
  before: ExistingRecord<R>[];
}

/**
 * For providers whose API writes whole RRsets (GoDaddy, Route 53,
 * Gandi, Hetzner): groups a plan into the RRsets it touches, with each
 * set's full post-change membership. Desired values are kept in the
 * caller's format (`ZoneRecord.value`); surviving existing values are
 * kept in the provider's format — adapters convert both via `fromPlan`.
 */
export function rrsetChanges<R>(
  existing: readonly ExistingRecord<R>[],
  ops: readonly PlanOp<R>[],
  defaultTtl = 300,
): RRSetChange<R>[] {
  const touched = new Map<string, { type: string; name: string }>();
  const keyOf = (type: string, name: string) => `${type.toUpperCase()}|${normalizeRelative(name)}`;
  const removed = new Set<ExistingRecord<R>>();
  const added: ZoneRecord[] = [];
  for (const op of ops) {
    if (op.kind === "delete" || op.kind === "update") {
      removed.add(op.existing);
      touched.set(keyOf(op.existing.type, op.existing.name), {
        type: op.existing.type.toUpperCase(),
        name: normalizeRelative(op.existing.name),
      });
    }
    if (op.kind === "create" || op.kind === "update") {
      added.push(op.record);
      touched.set(keyOf(op.record.type, op.record.name), {
        type: op.record.type,
        name: normalizeRelative(op.record.name),
      });
    }
  }
  const out: RRSetChange<R>[] = [];
  for (const [k, { type, name }] of touched) {
    const before = existing.filter((e) => keyOf(e.type, e.name) === k);
    const newRecords = added.filter((r) => keyOf(r.type, r.name) === k);
    const ttl = newRecords[0]?.ttl ?? before[0]?.ttl ?? defaultTtl;
    const records: RRSetChange<R>["records"] = [
      ...before
        .filter((e) => !removed.has(e))
        .map((e) => ({ value: e.value, ttl, priority: e.priority, fromPlan: false })),
      ...newRecords.map((r) => ({ value: r.value, ttl, priority: r.priority, fromPlan: true })),
    ];
    out.push({ type, name, records, before });
  }
  return out;
}

export function clampTtl(ttl: number, min: number, max = 2_147_483_647): number {
  if (!Number.isFinite(ttl)) return min;
  return Math.min(max, Math.max(min, Math.round(ttl)));
}

export function unsupportedType(providerName: string, type: string): ProviderApiError {
  return new ProviderApiError(
    `${providerName} doesn't support creating ${type} records through its API. Please add this record manually.`,
    "provider_error",
  );
}

// ── Zone-file presentation values (Route 53, Hetzner, Gandi) ─────────────

/**
 * Formats a value in zone-file presentation form: TXT quoted, CNAME/MX
 * targets with a trailing dot, MX prefixed with its priority. Values
 * already read back from the provider (`fromPlan: false`) are kept.
 */
export function formatZoneFileValue(
  type: string,
  value: string,
  priority: number | undefined,
  fromPlan: boolean,
): string {
  switch (type) {
    case "TXT":
      return fromPlan ? quoteTxt(value) : value;
    case "CNAME":
      return withTrailingDot(value);
    case "MX":
      return `${priority ?? 10} ${withTrailingDot(value)}`;
    case "CAA":
      return fromPlan ? formatCaa(parseCaa(value)) : value;
    default:
      return value;
  }
}


export function decodeXml(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e: string) => {
    const l = e.toLowerCase();
    if (l === "amp") return "&";
    if (l === "lt") return "<";
    if (l === "gt") return ">";
    if (l === "quot") return '"';
    if (l === "apos") return "'";
    if (l.startsWith("#x")) return String.fromCodePoint(parseInt(l.slice(2), 16));
    return String.fromCodePoint(parseInt(l.slice(1), 10));
  });
}

