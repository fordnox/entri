import { asc, count, eq, inArray } from "drizzle-orm";
import { connectApplications, domainConnections } from "@/db/drizzle/schema.ts";
import type { Drizzle } from "@/infrastructure/drizzle.ts";
import type { WorkspaceId } from "@/workspaces/domain/workspace.ts";
import { ConnectApplication, type ConnectApplicationId } from "../domain/application.ts";
import type {
  ApplicationWithDomainCount,
  ConnectApplicationRepository,
} from "../domain/repositories.ts";

type Row = typeof connectApplications.$inferSelect;

function toDomain(row: Row): ConnectApplication {
  return ConnectApplication.rehydrate({
    id: row.id as ConnectApplicationId,
    workspaceId: row.workspaceId as WorkspaceId,
    name: row.name,
    iconUrl: row.iconUrl,
    secretHash: row.secretHash,
    secretPreview: row.secretPreview,
    secretVersion: row.secretVersion,
    secretRotatedAt: row.secretRotatedAt,
    allowedOrigins: row.allowedOrigins ?? [],
    webhookUrl: row.webhookUrl,
    webhookSecret: row.webhookSecret,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

export class DrizzleConnectApplicationRepository implements ConnectApplicationRepository {
  constructor(private readonly db: Drizzle) {}

  async findById(id: ConnectApplicationId): Promise<ConnectApplication | null> {
    const rows = await this.db
      .select()
      .from(connectApplications)
      .where(eq(connectApplications.id, id))
      .limit(1);
    return rows[0] ? toDomain(rows[0]) : null;
  }

  async listForWorkspace(workspaceId: WorkspaceId): Promise<ApplicationWithDomainCount[]> {
    const rows = await this.db
      .select()
      .from(connectApplications)
      .where(eq(connectApplications.workspaceId, workspaceId))
      .orderBy(asc(connectApplications.createdAt));
    if (rows.length === 0) return [];
    const counts = await this.db
      .select({ applicationId: domainConnections.applicationId, n: count() })
      .from(domainConnections)
      .where(
        inArray(
          domainConnections.applicationId,
          rows.map((r) => r.id),
        ),
      )
      .groupBy(domainConnections.applicationId);
    const byApp = new Map(counts.map((c) => [c.applicationId, Number(c.n)]));
    return rows.map((r) => ({ application: toDomain(r), domainCount: byApp.get(r.id) ?? 0 }));
  }

  async countDomains(id: ConnectApplicationId): Promise<number> {
    const [row] = await this.db
      .select({ n: count() })
      .from(domainConnections)
      .where(eq(domainConnections.applicationId, id));
    return Number(row?.n ?? 0);
  }

  async save(app: ConnectApplication): Promise<void> {
    const values = {
      id: app.id,
      workspaceId: app.workspaceId,
      name: app.name,
      iconUrl: app.iconUrl,
      secretHash: app.secretHash,
      secretPreview: app.secretPreview,
      secretVersion: app.secretVersion,
      secretRotatedAt: app.secretRotatedAt,
      allowedOrigins: [...app.allowedOrigins],
      webhookUrl: app.webhookUrl,
      webhookSecret: app.webhookSecret,
      createdAt: app.createdAt,
      updatedAt: app.updatedAt,
    };
    const { id: _id, workspaceId: _ws, createdAt: _c, ...mutable } = values;
    await this.db
      .insert(connectApplications)
      .values(values)
      .onConflictDoUpdate({ target: connectApplications.id, set: mutable });
  }

  async delete(id: ConnectApplicationId): Promise<void> {
    await this.db.delete(connectApplications).where(eq(connectApplications.id, id));
  }
}
