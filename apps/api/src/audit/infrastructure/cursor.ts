/**
 * Opaque cursor for audit-log pagination. Encodes `occurredAt` plus the
 * row id so ties (multiple entries in the same millisecond) remain
 * stable: subsequent pages break on `(occurredAt, id)` lexicographic
 * order.
 *
 * Format: `base64url(iso8601 "|" id)`. Callers should treat this as
 * opaque — we do not guarantee the shape across deploys.
 */

export interface AuditCursor {
  readonly occurredAt: Date;
  readonly id: string;
}

export function encodeAuditCursor(cursor: AuditCursor): string {
  const raw = `${cursor.occurredAt.toISOString()}|${cursor.id}`;
  return Buffer.from(raw, "utf8").toString("base64url");
}

export function decodeAuditCursor(value: string): AuditCursor | null {
  let raw: string;
  try {
    raw = Buffer.from(value, "base64url").toString("utf8");
  } catch {
    return null;
  }
  const sep = raw.indexOf("|");
  if (sep <= 0) return null;
  const iso = raw.slice(0, sep);
  const id = raw.slice(sep + 1);
  const occurredAt = new Date(iso);
  if (Number.isNaN(occurredAt.getTime()) || !id) return null;
  return { occurredAt, id };
}

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 200;

export function clampLimit(limit: number | undefined): number {
  if (limit == null || !Number.isFinite(limit)) return DEFAULT_PAGE_SIZE;
  const n = Math.floor(limit);
  if (n < 1) return DEFAULT_PAGE_SIZE;
  return Math.min(n, MAX_PAGE_SIZE);
}
