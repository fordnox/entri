import type { UnitOfWork } from "@/kernel/uow.ts";
import type { AuditPage } from "../domain/audit-entry.ts";
import type {
  AppAuditEntry,
  AppAuditFilter,
} from "../domain/app-audit-entry.ts";

export class ListAppAuditService {
  constructor(private readonly uow: UnitOfWork) {}

  execute(filter: AppAuditFilter): Promise<AuditPage<AppAuditEntry>> {
    return this.uow.read((tx) => tx.appAudit.list(filter));
  }
}
