import type { AuditPage } from "./audit-entry.ts";
import type {
  AppAuditEntry,
  AppAuditFilter,
} from "./app-audit-entry.ts";
import type {
  WorkspaceAuditEntry,
  WorkspaceAuditFilter,
} from "./workspace-audit-entry.ts";

export interface AppAuditRepository {
  append(entry: AppAuditEntry): Promise<void>;
  list(filter: AppAuditFilter): Promise<AuditPage<AppAuditEntry>>;
  /**
   * Delete entries with `occurredAt < before`. Returns the number of
   * rows removed. Used by the audit-retention cron to enforce the
   * configured retention window.
   */
  deleteOlderThan(before: Date): Promise<number>;
}

export interface WorkspaceAuditRepository {
  append(entry: WorkspaceAuditEntry): Promise<void>;
  list(filter: WorkspaceAuditFilter): Promise<AuditPage<WorkspaceAuditEntry>>;
  deleteOlderThan(before: Date): Promise<number>;
}
