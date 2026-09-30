import { asc, eq } from "drizzle-orm";
import { workspaces } from "@/db/drizzle/schema.ts";
import type { UserId } from "@/identity/domain/user.ts";
import type { Drizzle } from "@/infrastructure/drizzle.ts";
import type { WorkspaceRepository } from "../domain/repositories.ts";
import { WorkspaceSlug } from "../domain/workspace-slug.ts";
import { Workspace, type WorkspaceId } from "../domain/workspace.ts";

type Row = {
  id: string;
  slug: string;
  name: string;
  ownerId: string;
  createdAt: Date;
};

function toDomain(row: Row): Workspace {
  return Workspace.rehydrate({
    id: row.id as WorkspaceId,
    slug: WorkspaceSlug.parse(row.slug),
    name: row.name,
    ownerId: row.ownerId as UserId,
    createdAt: row.createdAt,
  });
}

export class DrizzleWorkspaceRepository implements WorkspaceRepository {
  constructor(private readonly db: Drizzle) {}

  async findById(id: WorkspaceId): Promise<Workspace | null> {
    const rows = await this.db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, id))
      .limit(1);
    return rows[0] ? toDomain(rows[0]) : null;
  }

  async findBySlug(slug: string): Promise<Workspace | null> {
    const rows = await this.db
      .select()
      .from(workspaces)
      .where(eq(workspaces.slug, slug))
      .limit(1);
    return rows[0] ? toDomain(rows[0]) : null;
  }

  async findOwnedBy(userId: UserId) {
    const rows = await this.db
      .select({
        id: workspaces.id,
        name: workspaces.name,
        slug: workspaces.slug,
      })
      .from(workspaces)
      .where(eq(workspaces.ownerId, userId))
      .orderBy(asc(workspaces.createdAt));
    return rows.map((r) => ({
      id: r.id as WorkspaceId,
      name: r.name,
      slug: r.slug,
    }));
  }

  async save(workspace: Workspace): Promise<void> {
    await this.db
      .insert(workspaces)
      .values({
        id: workspace.id,
        slug: workspace.slug.value,
        name: workspace.name,
        ownerId: workspace.ownerId,
        createdAt: workspace.createdAt,
      })
      .onConflictDoUpdate({
        target: workspaces.id,
        set: {
          slug: workspace.slug.value,
          name: workspace.name,
        },
      });
  }

  async delete(id: WorkspaceId): Promise<void> {
    await this.db.delete(workspaces).where(eq(workspaces.id, id));
  }
}
