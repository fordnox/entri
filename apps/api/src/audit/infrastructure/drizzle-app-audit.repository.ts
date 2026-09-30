// +feature:audit-log
import { and, desc, eq, gte, ilike, inArray, lt, lte, or, type SQL } from "drizzle-orm";
import { appAuditEntries } from "@/db/drizzle/schema.ts";
import type { Drizzle } from "@/infrastructure/drizzle.ts";
import type { UserId } from "@/identity/domain/user.ts";
import type { AuditPage } from "../domain/audit-entry.ts";
import type {
  AppAuditEntry,
  AppAuditEntryId,
  AppAuditFilter,
} from "../domain/app-audit-entry.ts";
import type { AppAuditRepository } from "../domain/repositories.ts";
import {
  clampLimit,
  decodeAuditCursor,
  encodeAuditCursor,
} from "./cursor.ts";

type Row = {
  id: string;
  actorUserId: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  occurredAt: Date;
};

function toDomain(row: Row): AppAuditEntry {
  return {
    id: row.id as AppAuditEntryId,
    actorKind: row.actorUserId ? "user" : "system",
    actorUserId: (row.actorUserId as UserId | null) ?? null,
    action: row.action,
    targetType: row.targetType,
    targetId: row.targetId,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    ipAddress: row.ipAddress,
    userAgent: row.userAgent,
    occurredAt: row.occurredAt,
  };
}

export class DrizzleAppAuditRepository implements AppAuditRepository {
  constructor(private readonly db: Drizzle) {}

  async append(entry: AppAuditEntry): Promise<void> {
    await this.db.insert(appAuditEntries).values({
      id: entry.id,
      actorUserId: entry.actorUserId,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      metadata: entry.metadata as unknown,
      ipAddress: entry.ipAddress,
      userAgent: entry.userAgent,
      occurredAt: entry.occurredAt,
    });
  }

  async list(filter: AppAuditFilter): Promise<AuditPage<AppAuditEntry>> {
    const take = clampLimit(filter.limit);
    const clauses: SQL[] = [];

    if (filter.actorUserId) {
      clauses.push(eq(appAuditEntries.actorUserId, filter.actorUserId));
    }
    if (filter.action) {
      if (Array.isArray(filter.action)) {
        clauses.push(inArray(appAuditEntries.action, filter.action as string[]));
      } else {
        clauses.push(eq(appAuditEntries.action, filter.action as string));
      }
    }
    if (filter.q) {
      clauses.push(ilike(appAuditEntries.action, `%${filter.q}%`));
    }
    if (filter.from) clauses.push(gte(appAuditEntries.occurredAt, filter.from));
    if (filter.to) clauses.push(lte(appAuditEntries.occurredAt, filter.to));

    const cursor = filter.cursor ? decodeAuditCursor(filter.cursor) : null;
    if (cursor) {
      const keyset = or(
        lt(appAuditEntries.occurredAt, cursor.occurredAt),
        and(
          eq(appAuditEntries.occurredAt, cursor.occurredAt),
          lt(appAuditEntries.id, cursor.id),
        ),
      );
      if (keyset) clauses.push(keyset);
    }

    const where = clauses.length ? and(...clauses) : undefined;
    const rows = await this.db
      .select()
      .from(appAuditEntries)
      .where(where)
      .orderBy(desc(appAuditEntries.occurredAt), desc(appAuditEntries.id))
      .limit(take + 1);

    const hasMore = rows.length > take;
    const page = hasMore ? rows.slice(0, take) : rows;
    const items = page.map(toDomain);
    const last = items[items.length - 1];
    const nextCursor =
      hasMore && last
        ? encodeAuditCursor({ occurredAt: last.occurredAt, id: last.id })
        : null;
    return { items, nextCursor };
  }

  async deleteOlderThan(before: Date): Promise<number> {
    const result = await this.db
      .delete(appAuditEntries)
      .where(lt(appAuditEntries.occurredAt, before));
    return result.rowCount ?? 0;
  }
}
// -feature:audit-log
