import type { FeatureCore, FeatureModule } from "@/kernel/feature.ts";
import { ListAppAuditService } from "./application/list-app-audit.service.ts";
import { ListWorkspaceAuditService } from "./application/list-workspace-audit.service.ts";

export interface AuditServices {
  listAppAudit: ListAppAuditService;
  listWorkspaceAudit: ListWorkspaceAuditService;
}

export const auditFeature: FeatureModule<AuditServices> = {
  name: "audit",
  services: (core: FeatureCore) => ({
    listAppAudit: new ListAppAuditService(core.uow),
    listWorkspaceAudit: new ListWorkspaceAuditService(core.uow),
  }),
};
