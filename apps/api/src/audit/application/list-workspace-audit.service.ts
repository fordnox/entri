import type { UnitOfWork } from "@/kernel/uow.ts";
import type { AuditPage } from "../domain/audit-entry.ts";
import type {
  WorkspaceAuditEntry,
  WorkspaceAuditFilter,
} from "../domain/workspace-audit-entry.ts";

export class ListWorkspaceAuditService {
  constructor(private readonly uow: UnitOfWork) {}

  execute(
    filter: WorkspaceAuditFilter,
  ): Promise<AuditPage<WorkspaceAuditEntry>> {
    return this.uow.read((tx) => tx.workspaceAudit.list(filter));
  }
}
