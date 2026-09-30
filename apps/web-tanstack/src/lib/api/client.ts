import type {
  // +feature:audit-log
  AuditPageDTO,
  // -feature:audit-log
  // +feature:billing
  BillingPlanDTO,
  // -feature:billing
  RuntimeConfigDTO,
  // +feature:billing
  SubscriptionDTO,
  // -feature:billing
  UserDTO,
  // +feature:billing
  WorkspaceBillingDTO,
  // -feature:billing
  WorkspaceDTO,
  WorkspaceInviteDTO,
  WorkspaceMemberDTO,
  WorkspaceMemberId,
  WorkspaceRoleDTO,
  WorkspaceRoleId,
} from "@orbit/shared/dto";
import type {
  WorkspacePermission,
  WorkspaceRoleSystemKey,
} from "@orbit/shared/permissions";
import type { OrbitThemeMode, OrbitThemePalette } from "@orbit/shared/themes";
import { API_URL } from "@/lib/urls";


export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly issues?: unknown;

  constructor(status: number, code: string, message: string, issues?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.issues = issues;
  }
}

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...(init.headers as Record<string, string> | undefined),
  };
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers,
  });
  if (!res.ok) {
    let code = "http_error";
    let message = res.statusText;
    let issues: unknown = undefined;
    try {
      const body = await res.json();
      if (body?.error) {
        code = body.error.code ?? code;
        message = body.error.message ?? message;
        issues = body.error.issues;
      }
    } catch {
      // ignore
    }
    throw new ApiError(res.status, code, message, issues);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export interface MeResponse {
  user: UserDTO;
  workspaces: Array<{
    id: string;
    memberId: WorkspaceMemberId;
    slug: string;
    name: string;
    roleName: string;
    roleSystemKey: WorkspaceRoleSystemKey | null;
  }>;
}

/**
 * Snapshot returned by `GET /v1/workspaces/:slug`. The backend layer
 * returns enough to render the shell: the workspace row, the caller's
 * membership (with inline role + permissions), and the full member
 * roster. Teams/roles/billing are fetched lazily from their own
 * endpoints when the matching settings page mounts — keeps the
 * snapshot small and predictable.
 */
export interface WorkspaceSnapshot {
  workspace: WorkspaceDTO;
  you: WorkspaceMemberDTO | null;
  members: WorkspaceMemberDTO[];
}

export interface CreateWorkspaceResponse {
  workspace: WorkspaceDTO;
  you: WorkspaceMemberDTO | null;
  invites: WorkspaceInviteDTO[];
}

export interface ActiveProvidersDTO {
  nodeEnv: string;
  mailer: string;
  // +feature:billing
  billing: { enabled: boolean; provider: string | null };
  // -feature:billing
  // +feature:jobs
  jobs: {
    enabled: boolean;
    provider: string | null;
    registered: {
      name: string;
      schedule: string | null;
      maxAttempts: number | null;
    }[];
  };
  // -feature:jobs
  // +feature:uploads
  uploads: { enabled: boolean; provider: string };
  // -feature:uploads
}

export const api = {
  config: () => request<RuntimeConfigDTO>("/v1/config"),


  dev: {
    // +feature:auth-magic-link
    getLastMagicLink: (email: string) =>
      request<{ link: string | null }>(
        `/v1/dev/last-magic-link?email=${encodeURIComponent(email)}`,
      ),
    // -feature:auth-magic-link
    // +feature:auth-admin
    makeMeAdmin: () =>
      request<{ ok: true; role: string }>("/v1/dev/make-admin", {
        method: "POST",
      }),
    // -feature:auth-admin
    getActiveProviders: () =>
      request<ActiveProvidersDTO>("/v1/dev/active-providers"),
    seedMembers: (slug: string, count: number) =>
      request<{ ok: true; created: { id: string; email: string; name: string }[] }>(
        `/v1/dev/seed-members/${slug}`,
        { method: "POST", body: JSON.stringify({ count }) },
      ),
    // +feature:jobs
    listJobs: () =>
      request<{
        items: { name: string; schedule: string | null; maxAttempts: number | null }[];
      }>("/v1/dev/jobs"),
    runJob: (name: string, payload?: Record<string, unknown>) =>
      request<{ ok: true; name: string }>("/v1/dev/run-job", {
        method: "POST",
        body: JSON.stringify({ name, payload }),
      }),
    // -feature:jobs
  },

  me: () => request<MeResponse>("/v1/me"),

  account: {
    ownedWorkspacesBlockingDelete: () =>
      request<{
        workspaces: Array<{ id: string; name: string; slug: string }>;
      }>("/v1/me/owned-workspaces-blocking-delete"),
  },

  updatePreferences: (body: {
    themeMode?: OrbitThemeMode | null;
    themePalette?: OrbitThemePalette | null;
  }) =>
    request<{
      themeMode: OrbitThemeMode | null;
      themePalette: OrbitThemePalette | null;
    }>("/v1/me/preferences", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  workspaces: {
    create: (body: { name: string; slug: string; invites?: string[] }) =>
      request<CreateWorkspaceResponse>("/v1/workspaces", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    get: (slug: string) => request<WorkspaceSnapshot>(`/v1/workspaces/${slug}`),
    delete: (slug: string) =>
      request<void>(`/v1/workspaces/${slug}`, { method: "DELETE" }),
    invite: (
      slug: string,
      email: string,
      opts?: { roleId?: WorkspaceRoleId },
    ) =>
      request<{ invite: WorkspaceInviteDTO }>(`/v1/workspaces/${slug}/invites`, {
        method: "POST",
        body: JSON.stringify({
          email,
          ...(opts?.roleId ? { roleId: opts.roleId } : {}),
        }),
      }),
    listInvites: (slug: string, opts?: { q?: string }) => {
      const q = opts?.q?.trim();
      const qs = q ? `?q=${encodeURIComponent(q)}` : "";
      return request<WorkspaceInviteDTO[]>(`/v1/workspaces/${slug}/invites${qs}`);
    },
    revokeInvite: (slug: string, inviteId: string) =>
      request<void>(`/v1/workspaces/${slug}/invites/${inviteId}`, {
        method: "DELETE",
      }),
    removeMember: (slug: string, memberId: string) =>
      request<void>(`/v1/workspaces/${slug}/members/${memberId}`, {
        method: "DELETE",
      }),
    listMembers: (slug: string, opts?: { q?: string }) => {
      const q = opts?.q?.trim();
      const qs = q ? `?q=${encodeURIComponent(q)}` : "";
      return request<WorkspaceMemberDTO[]>(`/v1/workspaces/${slug}/members${qs}`);
    },
    changeMemberRole: (
      slug: string,
      memberId: WorkspaceMemberId,
      roleId: WorkspaceRoleId,
    ) =>
      request<void>(`/v1/workspaces/${slug}/members/${memberId}/role`, {
        method: "PATCH",
        body: JSON.stringify({ roleId }),
      }),

    listRoles: (slug: string) =>
      request<WorkspaceRoleDTO[]>(`/v1/workspaces/${slug}/roles`),
    createRole: (
      slug: string,
      body: {
        name: string;
        description?: string | null;
        permissions: WorkspacePermission[];
      },
    ) =>
      request<WorkspaceRoleDTO>(`/v1/workspaces/${slug}/roles`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    updateRole: (
      slug: string,
      roleId: WorkspaceRoleId,
      body: {
        name?: string;
        description?: string | null;
        permissions?: WorkspacePermission[];
      },
    ) =>
      request<WorkspaceRoleDTO>(`/v1/workspaces/${slug}/roles/${roleId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    deleteRole: (slug: string, roleId: WorkspaceRoleId) =>
      request<void>(`/v1/workspaces/${slug}/roles/${roleId}`, {
        method: "DELETE",
      }),
    // +feature:audit-log
    listAudit: (
      slug: string,
      opts?: { cursor?: string; limit?: number; q?: string; teamId?: TeamId },
    ) => {
      const params = new URLSearchParams();
      if (opts?.cursor) params.set("cursor", opts.cursor);
      if (opts?.limit != null) params.set("limit", String(opts.limit));
      if (opts?.q) params.set("q", opts.q);
      const qs = params.toString();
      return request<AuditPageDTO>(
        `/v1/workspaces/${slug}/audit${qs ? `?${qs}` : ""}`,
      );
    },
    // -feature:audit-log
  },

  // +feature:audit-log
  admin: {
    listAudit: (opts?: { cursor?: string; limit?: number; q?: string }) => {
      const params = new URLSearchParams();
      if (opts?.cursor) params.set("cursor", opts.cursor);
      if (opts?.limit != null) params.set("limit", String(opts.limit));
      if (opts?.q) params.set("q", opts.q);
      const qs = params.toString();
      return request<AuditPageDTO>(`/v1/admin/audit${qs ? `?${qs}` : ""}`);
    },
  },
  // -feature:audit-log


  // +feature:billing
  billing: {
    get: (slug: string) =>
      request<WorkspaceBillingDTO>(`/v1/workspaces/${slug}/billing`),
    checkout: (
      slug: string,
      body: {
        priceId: string;
        quantity?: number;
        successUrl: string;
        cancelUrl: string;
      },
    ) =>
      request<{ redirectUrl: string }>(`/v1/workspaces/${slug}/billing/checkout`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    portal: (slug: string, body: { returnUrl: string }) =>
      request<{ redirectUrl: string }>(`/v1/workspaces/${slug}/billing/portal`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    cancel: (slug: string, opts: { atPeriodEnd: boolean } = { atPeriodEnd: true }) =>
      request<void>(`/v1/workspaces/${slug}/billing/cancel`, {
        method: "POST",
        body: JSON.stringify(opts),
      }),
  },
  // -feature:billing

  invites: {
    accept: (token: string) =>
      request<{ workspace: WorkspaceDTO; member: WorkspaceMemberDTO | null }>(
        "/v1/invites/accept",
        { method: "POST", body: JSON.stringify({ token }) },
      ),
  },
};

export type Api = typeof api;

// +feature:billing
export type { BillingPlanDTO, SubscriptionDTO };
// -feature:billing
