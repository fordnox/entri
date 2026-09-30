import { and, desc, eq, ilike, isNull } from "drizzle-orm";
import { workspaceInvites } from "@/db/drizzle/schema.ts";
import type { Drizzle } from "@/infrastructure/drizzle.ts";
import { WorkspaceInvite, type WorkspaceInviteId } from "../domain/invite.ts";
import type { WorkspaceInviteRepository } from "../domain/repositories.ts";
import type { WorkspaceMemberId } from "../domain/workspace-member.ts";
import type { WorkspaceRoleId } from "../domain/workspace-role.ts";
import type { WorkspaceId } from "../domain/workspace.ts";

type Row = {
  id: string;
  workspaceId: string;
  email: string;
  token: string;
  invitedById: string;
  roleId: string | null;
  createdAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
};

function toDomain(row: Row): WorkspaceInvite {
  return WorkspaceInvite.rehydrate({
    id: row.id as WorkspaceInviteId,
    workspaceId: row.workspaceId as WorkspaceId,
    email: row.email,
    token: row.token,
    invitedById: row.invitedById as WorkspaceMemberId,
    roleId: (row.roleId as WorkspaceRoleId | null) ?? null,
    createdAt: row.createdAt,
    acceptedAt: row.acceptedAt,
    revokedAt: row.revokedAt,
  });
}

export class DrizzleWorkspaceInviteRepository
  implements WorkspaceInviteRepository
{
  constructor(private readonly db: Drizzle) {}

  async findById(id: WorkspaceInviteId): Promise<WorkspaceInvite | null> {
    const [row] = await this.db
      .select()
      .from(workspaceInvites)
      .where(eq(workspaceInvites.id, id))
      .limit(1);
    return row ? toDomain(row) : null;
  }

  async findByToken(token: string): Promise<WorkspaceInvite | null> {
    const [row] = await this.db
      .select()
      .from(workspaceInvites)
      .where(eq(workspaceInvites.token, token))
      .limit(1);
    return row ? toDomain(row) : null;
  }

  async findActiveByEmail(
    workspaceId: WorkspaceId,
    email: string,
  ): Promise<WorkspaceInvite | null> {
    const [row] = await this.db
      .select()
      .from(workspaceInvites)
      .where(
        and(
          eq(workspaceInvites.workspaceId, workspaceId),
          eq(workspaceInvites.email, email.toLowerCase()),
          isNull(workspaceInvites.acceptedAt),
          isNull(workspaceInvites.revokedAt),
        ),
      )
      .orderBy(desc(workspaceInvites.createdAt))
      .limit(1);
    return row ? toDomain(row) : null;
  }

  async listPendingForWorkspace(
    workspaceId: WorkspaceId,
    opts?: { query?: string },
  ): Promise<WorkspaceInvite[]> {
    const q = opts?.query?.trim();
    const base = and(
      eq(workspaceInvites.workspaceId, workspaceId),
      isNull(workspaceInvites.acceptedAt),
      isNull(workspaceInvites.revokedAt),
    );
    const rows = await this.db
      .select()
      .from(workspaceInvites)
      .where(q ? and(base, ilike(workspaceInvites.email, `%${q}%`)) : base)
      .orderBy(desc(workspaceInvites.createdAt));
    return rows.map(toDomain);
  }

  async hasPendingInviteForEmail(email: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: workspaceInvites.id })
      .from(workspaceInvites)
      .where(
        and(
          eq(workspaceInvites.email, email.toLowerCase()),
          isNull(workspaceInvites.acceptedAt),
          isNull(workspaceInvites.revokedAt),
        ),
      )
      .limit(1);
    return row != null;
  }

  async save(invite: WorkspaceInvite): Promise<void> {
    await this.db
      .insert(workspaceInvites)
      .values({
        id: invite.id,
        workspaceId: invite.workspaceId,
        email: invite.email,
        token: invite.token,
        invitedById: invite.invitedById,
        roleId: invite.roleId,
        createdAt: invite.createdAt,
        acceptedAt: invite.acceptedAt,
        revokedAt: invite.revokedAt,
      })
      .onConflictDoUpdate({
        target: workspaceInvites.id,
        set: {
          acceptedAt: invite.acceptedAt,
          revokedAt: invite.revokedAt,
        },
      });
  }
}
