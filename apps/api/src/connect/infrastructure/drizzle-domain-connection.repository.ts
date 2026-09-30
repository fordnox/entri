import { and, desc, eq, ilike, lt, or, type SQL } from "drizzle-orm";
import type { DomainConnectionStatus, SetupMethod } from "@orbit/shared/connect";
import { domainConnections } from "@/db/drizzle/schema.ts";
import type { Drizzle } from "@/infrastructure/drizzle.ts";
import type { WorkspaceId } from "@/workspaces/domain/workspace.ts";
import type { ConnectApplicationId } from "../domain/application.ts";
import type { ResolvedRecord } from "../domain/dns-records.ts";
import { DomainConnection, type DomainConnectionId } from "../domain/domain-connection.ts";
import type {
  DomainConnectionQuery,
  DomainConnectionRepository,
} from "../domain/repositories.ts";

type Row = typeof domainConnections.$inferSelect;

function toDomain(row: Row): DomainConnection {
  return DomainConnection.rehydrate({
    id: row.id as DomainConnectionId,
    applicationId: row.applicationId as ConnectApplicationId,
    workspaceId: row.workspaceId as WorkspaceId,
    domain: row.domain,
    rootDomain: row.rootDomain,
    subdomain: row.subdomain,
    userId: row.userId,
    metadata: row.metadata ?? null,
    providerKey: row.providerKey,
    setupMethod: row.setupMethod as SetupMethod | null,
    status: row.status as DomainConnectionStatus,
    records: row.records as ResolvedRecord[],
    lastError: row.lastError,
    lastCheckedAt: row.lastCheckedAt,
    connectedAt: row.connectedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export class DrizzleDomainConnectionRepository implements DomainConnectionRepository {
  constructor(private readonly db: Drizzle) {}

  async findById(id: DomainConnectionId): Promise<DomainConnection | null> {
    const rows = await this.db
      .select()
      .from(domainConnections)
      .where(eq(domainConnections.id, id))
      .limit(1);
    return rows[0] ? toDomain(rows[0]) : null;
  }

  async list(query: DomainConnectionQuery): Promise<DomainConnection[]> {
    const where: SQL[] = [eq(domainConnections.workspaceId, query.workspaceId)];
    if (query.applicationId) where.push(eq(domainConnections.applicationId, query.applicationId));
    if (query.status) where.push(eq(domainConnections.status, query.status));
    if (query.q) {
      const pattern = `%${escapeLike(query.q)}%`;
      where.push(
        or(ilike(domainConnections.domain, pattern), ilike(domainConnections.userId, pattern))!,
      );
    }
    if (query.cursor) {
      where.push(
        or(
          lt(domainConnections.createdAt, query.cursor.createdAt),
          and(
            eq(domainConnections.createdAt, query.cursor.createdAt),
            lt(domainConnections.id, query.cursor.id),
          ),
        )!,
      );
    }
    const rows = await this.db
      .select()
      .from(domainConnections)
      .where(and(...where))
      .orderBy(desc(domainConnections.createdAt), desc(domainConnections.id))
      .limit(query.limit);
    return rows.map(toDomain);
  }

  async save(conn: DomainConnection): Promise<void> {
    const s = conn.snapshot();
    const mutable = {
      providerKey: s.providerKey,
      setupMethod: s.setupMethod,
      status: s.status,
      records: s.records,
      lastError: s.lastError,
      lastCheckedAt: s.lastCheckedAt,
      connectedAt: s.connectedAt,
      updatedAt: s.updatedAt,
    };
    await this.db
      .insert(domainConnections)
      .values({
        id: s.id,
        applicationId: s.applicationId,
        workspaceId: s.workspaceId,
        domain: s.domain,
        rootDomain: s.rootDomain,
        subdomain: s.subdomain,
        userId: s.userId,
        metadata: s.metadata,
        createdAt: s.createdAt,
        ...mutable,
      })
      .onConflictDoUpdate({ target: domainConnections.id, set: mutable });
  }

  async delete(id: DomainConnectionId): Promise<void> {
    await this.db.delete(domainConnections).where(eq(domainConnections.id, id));
  }
}
