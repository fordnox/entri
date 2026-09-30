import { and, asc, eq, inArray, sql } from "drizzle-orm";
import {
  workspaceMembers,
  workspaceRolePermissions,
  workspaceRoles,
} from "@/db/drizzle/schema.ts";
import type { Drizzle } from "@/infrastructure/drizzle.ts";
import type { WorkspaceRoleSystemKey } from "@orbit/shared/permissions";
import type {
  WorkspaceRoleRepository,
  WorkspaceRoleWithMemberCount,
} from "../domain/repositories.ts";
import {
  WorkspaceRole,
  type WorkspaceRoleId,
} from "../domain/workspace-role.ts";
import type { WorkspaceId } from "../domain/workspace.ts";

type Row = {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  systemKey: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

function toDomain(row: Row, permissions: string[]): WorkspaceRole {
  return WorkspaceRole.rehydrate({
    id: row.id as WorkspaceRoleId,
    workspaceId: row.workspaceId as WorkspaceId,
    name: row.name,
    description: row.description,
    isSystem: row.isSystem,
    systemKey: row.systemKey as WorkspaceRoleSystemKey | null,
    sortOrder: row.sortOrder,
    permissions,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

async function hydrate(
  db: Drizzle,
  rows: Row[],
): Promise<WorkspaceRole[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const perms = await db
    .select()
    .from(workspaceRolePermissions)
    .where(inArray(workspaceRolePermissions.roleId, ids));
  const byRole = new Map<string, string[]>();
  for (const p of perms) {
    const list = byRole.get(p.roleId) ?? [];
    list.push(p.permission);
    byRole.set(p.roleId, list);
  }
  return rows.map((r) => toDomain(r, byRole.get(r.id) ?? []));
}

export class DrizzleWorkspaceRoleRepository implements WorkspaceRoleRepository {
  constructor(private readonly db: Drizzle) {}

  async findById(id: WorkspaceRoleId): Promise<WorkspaceRole | null> {
    const rows = await this.db
      .select()
      .from(workspaceRoles)
      .where(eq(workspaceRoles.id, id))
      .limit(1);
    const hydrated = await hydrate(this.db, rows);
    return hydrated[0] ?? null;
  }

  async findManyByIds(
    ids: readonly WorkspaceRoleId[],
  ): Promise<WorkspaceRole[]> {
    if (ids.length === 0) return [];
    const rows = await this.db
      .select()
      .from(workspaceRoles)
      .where(inArray(workspaceRoles.id, [...ids]));
    return hydrate(this.db, rows);
  }

  async findByWorkspaceAndSystemKey(
    workspaceId: WorkspaceId,
    key: WorkspaceRoleSystemKey,
  ): Promise<WorkspaceRole | null> {
    const rows = await this.db
      .select()
      .from(workspaceRoles)
      .where(
        and(
          eq(workspaceRoles.workspaceId, workspaceId),
          eq(workspaceRoles.systemKey, key),
        ),
      )
      .limit(1);
    const hydrated = await hydrate(this.db, rows);
    return hydrated[0] ?? null;
  }

  async listForWorkspace(
    workspaceId: WorkspaceId,
  ): Promise<WorkspaceRoleWithMemberCount[]> {
    const rows = await this.db
      .select()
      .from(workspaceRoles)
      .where(eq(workspaceRoles.workspaceId, workspaceId))
      .orderBy(asc(workspaceRoles.sortOrder), asc(workspaceRoles.createdAt));
    const hydrated = await hydrate(this.db, rows);
    // Per-role member count in one round-trip.
    const counts = await this.db
      .select({
        roleId: workspaceMembers.roleId,
        count: sql<number>`count(*)::int`,
      })
      .from(workspaceMembers)
      .where(
        inArray(
          workspaceMembers.roleId,
          rows.map((r) => r.id),
        ),
      )
      .groupBy(workspaceMembers.roleId);
    const countsByRole = new Map(counts.map((c) => [c.roleId, c.count]));
    return hydrated.map((role) => ({
      role,
      memberCount: countsByRole.get(role.id) ?? 0,
    }));
  }

  async save(role: WorkspaceRole): Promise<void> {
    // Run the role row + permission replacement in one transaction so a
    // partial write can never expose an empty permission set.
    await this.db.transaction(async (tx) => {
      await tx
        .insert(workspaceRoles)
        .values({
          id: role.id,
          workspaceId: role.workspaceId,
          name: role.name,
          description: role.description,
          isSystem: role.isSystem,
          systemKey: role.systemKey,
          sortOrder: role.sortOrder,
          createdAt: role.createdAt,
          updatedAt: role.updatedAt,
        })
        .onConflictDoUpdate({
          target: workspaceRoles.id,
          set: {
            name: role.name,
            description: role.description,
            sortOrder: role.sortOrder,
            updatedAt: role.updatedAt,
          },
        });
      await tx
        .delete(workspaceRolePermissions)
        .where(eq(workspaceRolePermissions.roleId, role.id));
      if (role.permissions.length > 0) {
        await tx
          .insert(workspaceRolePermissions)
          .values(role.permissions.map((p) => ({ roleId: role.id, permission: p })));
      }
    });
  }

  async delete(id: WorkspaceRoleId): Promise<void> {
    await this.db.delete(workspaceRoles).where(eq(workspaceRoles.id, id));
  }
}
