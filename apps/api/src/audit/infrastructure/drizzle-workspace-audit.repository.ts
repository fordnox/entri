// +feature:audit-log
import {
  and,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNull,
  lt,
  lte,
  or,
  type SQL,
} from "drizzle-orm";
import { workspaceAuditEntries } from "@/db/drizzle/schema.ts";
import type { Drizzle } from "@/infrastructure/drizzle.ts";
import type { UserId } from "@/identity/domain/user.ts";
import type { WorkspaceMemberId } from "@/workspaces/domain/workspace-member.ts";
import type { WorkspaceId } from "@/workspaces/domain/workspace.ts";
import type { AuditPage } from "../domain/audit-entry.ts";
import type { WorkspaceAuditRepository } from "../domain/repositories.ts";
import type {
  WorkspaceAuditEntry,
  WorkspaceAuditEntryId,
  WorkspaceAuditFilter,
} from "../domain/workspace-audit-entry.ts";
import {
  clampLimit,
  decodeAuditCursor,
  encodeAuditCursor,
} from "./cursor.ts";

type Row = {
  id: string;
  workspaceId: string;
  teamId: string | null;
  actorMemberId: string | null;
  actorUserId: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: unknown;
  occurredAt: Date;
};

function toDomain(row: Row): WorkspaceAuditEntry {
  return {
    id: row.id as WorkspaceAuditEntryId,
    workspaceId: row.workspaceId as WorkspaceId,
    actorKind: row.actorMemberId || row.actorUserId ? "user" : "system",
    actorMemberId: (row.actorMemberId as WorkspaceMemberId | null) ?? null,
    actorUserId: (row.actorUserId as UserId | null) ?? null,
    action: row.action,
    targetType: row.targetType,
    targetId: row.targetId,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    occurredAt: row.occurredAt,
  };
}

export class DrizzleWorkspaceAuditRepository
  implements WorkspaceAuditRepository
{
  constructor(private readonly db: Drizzle) {}

  async append(entry: WorkspaceAuditEntry): Promise<void> {
    await this.db.insert(workspaceAuditEntries).values({
      id: entry.id,
      workspaceId: entry.workspaceId,
      actorMemberId: entry.actorMemberId,
      actorUserId: entry.actorUserId,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      metadata: entry.metadata as unknown,
      occurredAt: entry.occurredAt,
    });
  }

  async list(
    filter: WorkspaceAuditFilter,
  ): Promise<AuditPage<WorkspaceAuditEntry>> {
    const take = clampLimit(filter.limit);
    const clauses: SQL[] = [
      eq(workspaceAuditEntries.workspaceId, filter.workspaceId),
    ];

    if (filter.actorUserId) {
      clauses.push(eq(workspaceAuditEntries.actorUserId, filter.actorUserId));
    }
    if (filter.action) {
      if (Array.isArray(filter.action)) {
        clauses.push(
          inArray(workspaceAuditEntries.action, filter.action as string[]),
        );
      } else {
        clauses.push(eq(workspaceAuditEntries.action, filter.action as string));
      }
    }
    if (filter.q) {
      clauses.push(ilike(workspaceAuditEntries.action, `%${filter.q}%`));
    }
    if (filter.from) {
      clauses.push(gte(workspaceAuditEntries.occurredAt, filter.from));
    }
    if (filter.to) {
      clauses.push(lte(workspaceAuditEntries.occurredAt, filter.to));
    }

    const cursor = filter.cursor ? decodeAuditCursor(filter.cursor) : null;
    if (cursor) {
      const keyset = or(
        lt(workspaceAuditEntries.occurredAt, cursor.occurredAt),
        and(
          eq(workspaceAuditEntries.occurredAt, cursor.occurredAt),
          lt(workspaceAuditEntries.id, cursor.id),
        ),
      );
      if (keyset) clauses.push(keyset);
    }

    const rows = await this.db
      .select()
      .from(workspaceAuditEntries)
      .where(and(...clauses))
      .orderBy(
        desc(workspaceAuditEntries.occurredAt),
        desc(workspaceAuditEntries.id),
      )
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
      .delete(workspaceAuditEntries)
      .where(lt(workspaceAuditEntries.occurredAt, before));
    return result.rowCount ?? 0;
  }
}
// -feature:audit-log
