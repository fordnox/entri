import { and, asc, eq, sql } from "drizzle-orm";
import {
  users,
  workspaceMembers,
  workspaceRolePermissions,
  workspaceRoles,
  workspaces,
} from "@/db/drizzle/schema.ts";
import type { UserId } from "@/identity/domain/user.ts";
import type { Drizzle } from "@/infrastructure/drizzle.ts";
import {
  isWorkspacePermission,
  type WorkspacePermission,
  type WorkspaceRoleSystemKey,
} from "@orbit/shared/permissions";
import type {
  WorkspaceMemberRepository,
  WorkspaceMembershipSummary,
} from "../domain/repositories.ts";
import {
  WorkspaceMember,
  type WorkspaceMemberId,
  type WorkspaceMemberRoleSnapshot,
} from "../domain/workspace-member.ts";
import type { WorkspaceRoleId } from "../domain/workspace-role.ts";
import type { WorkspaceId } from "../domain/workspace.ts";

type MemberRow = {
  id: string;
  workspaceId: string;
  userId: string;
  roleId: string;
  tone: number;
  createdAt: Date;
};

type RoleRow = {
  id: string;
  systemKey: string | null;
};

function toSnapshot(
  role: RoleRow,
  permissions: string[],
): WorkspaceMemberRoleSnapshot {
  const perms: WorkspacePermission[] = [];
  for (const p of permissions) {
    if (isWorkspacePermission(p)) perms.push(p);
  }
  return {
    id: role.id as WorkspaceRoleId,
    systemKey: role.systemKey as WorkspaceRoleSystemKey | null,
    permissions: perms,
  };
}

function buildMember(
  member: MemberRow,
  role: RoleRow,
  permissions: string[],
): WorkspaceMember {
  return WorkspaceMember.rehydrate({
    id: member.id as WorkspaceMemberId,
    workspaceId: member.workspaceId as WorkspaceId,
    userId: member.userId as UserId,
    role: toSnapshot(role, permissions),
    tone: member.tone,
    createdAt: member.createdAt,
  });
}

async function hydrateMember(
  db: Drizzle,
  member: MemberRow,
): Promise<WorkspaceMember> {
  const [role] = await db
    .select({ id: workspaceRoles.id, systemKey: workspaceRoles.systemKey })
    .from(workspaceRoles)
    .where(eq(workspaceRoles.id, member.roleId))
    .limit(1);
  if (!role) {
    throw new Error(
      `workspace member ${member.id} references missing role ${member.roleId}`,
    );
  }
  const perms = await db
    .select({ permission: workspaceRolePermissions.permission })
    .from(workspaceRolePermissions)
    .where(eq(workspaceRolePermissions.roleId, role.id));
  return buildMember(member, role, perms.map((p) => p.permission));
}

export class DrizzleWorkspaceMemberRepository
  implements WorkspaceMemberRepository
{
  constructor(private readonly db: Drizzle) {}

  async findById(id: WorkspaceMemberId): Promise<WorkspaceMember | null> {
    const [row] = await this.db
      .select()
      .from(workspaceMembers)
      .where(eq(workspaceMembers.id, id))
      .limit(1);
    return row ? hydrateMember(this.db, row) : null;
  }

  async findByWorkspaceAndUser(
    workspaceId: WorkspaceId,
    userId: UserId,
  ): Promise<WorkspaceMember | null> {
    const [row] = await this.db
      .select()
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.userId, userId),
        ),
      )
      .limit(1);
    return row ? hydrateMember(this.db, row) : null;
  }

  async findByWorkspaceAndEmail(
    workspaceId: WorkspaceId,
    email: string,
  ): Promise<WorkspaceMember | null> {
    const [row] = await this.db
      .select({
        id: workspaceMembers.id,
        workspaceId: workspaceMembers.workspaceId,
        userId: workspaceMembers.userId,
        roleId: workspaceMembers.roleId,
        tone: workspaceMembers.tone,
        createdAt: workspaceMembers.createdAt,
      })
      .from(workspaceMembers)
      .innerJoin(users, eq(users.id, workspaceMembers.userId))
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(users.email, email.toLowerCase()),
        ),
      )
      .limit(1);
    return row ? hydrateMember(this.db, row) : null;
  }

  async listForWorkspace(workspaceId: WorkspaceId): Promise<WorkspaceMember[]> {
    const rows = await this.db
      .select()
      .from(workspaceMembers)
      .where(eq(workspaceMembers.workspaceId, workspaceId))
      .orderBy(asc(workspaceMembers.createdAt));
    return Promise.all(rows.map((r) => hydrateMember(this.db, r)));
  }

  async listSummariesForUser(
    userId: UserId,
  ): Promise<WorkspaceMembershipSummary[]> {
    const rows = await this.db
      .select({
        id: workspaceMembers.id,
        workspaceId: workspaceMembers.workspaceId,
        slug: workspaces.slug,
        name: workspaces.name,
        roleName: workspaceRoles.name,
        roleSystemKey: workspaceRoles.systemKey,
        createdAt: workspaceMembers.createdAt,
      })
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
      .innerJoin(
        workspaceRoles,
        eq(workspaceRoles.id, workspaceMembers.roleId),
      )
      .where(eq(workspaceMembers.userId, userId))
      .orderBy(asc(workspaceMembers.createdAt));
    return rows.map((r) => ({
      id: r.id as WorkspaceMemberId,
      workspaceId: r.workspaceId as WorkspaceId,
      slug: r.slug,
      name: r.name,
      roleName: r.roleName,
      roleSystemKey: r.roleSystemKey as WorkspaceRoleSystemKey | null,
    }));
  }

  async countByRole(roleId: WorkspaceRoleId): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(workspaceMembers)
      .where(eq(workspaceMembers.roleId, roleId));
    return row?.count ?? 0;
  }

  async countOwners(workspaceId: WorkspaceId): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(workspaceMembers)
      .innerJoin(
        workspaceRoles,
        eq(workspaceRoles.id, workspaceMembers.roleId),
      )
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceRoles.systemKey, "OWNER"),
        ),
      );
    return row?.count ?? 0;
  }

  async save(member: WorkspaceMember): Promise<void> {
    await this.db
      .insert(workspaceMembers)
      .values({
        id: member.id,
        workspaceId: member.workspaceId,
        userId: member.userId,
        roleId: member.roleId,
        tone: member.tone,
        createdAt: member.createdAt,
      })
      .onConflictDoUpdate({
        target: workspaceMembers.id,
        set: {
          roleId: member.roleId,
        },
      });
  }

  async delete(id: WorkspaceMemberId): Promise<void> {
    await this.db.delete(workspaceMembers).where(eq(workspaceMembers.id, id));
  }
}
