import type { Context } from "hono";
import { Hono } from "hono";
import type { DomainConnectionListItemDTO } from "@orbit/shared/connect";
import {
  applicationToDTO,
  connectionToDTO,
  deliveryToDTO,
} from "@/connect/application/dto.ts";
import type { ConnectionWithAppName } from "@/connect/application/list-domain-connections.service.ts";
import { ValidationError } from "@/kernel/errors.ts";
import type { HonoEnv } from "../middleware/container.ts";
import { requirePermission } from "../middleware/session.ts";
import {
  createApplicationSchema,
  listDomainConnectionsQuerySchema,
  updateApplicationSchema,
} from "../schemas.ts";
import { resolveSlug } from "./workspaces.controller.ts";

/**
 * Workspace-scoped Connect management, mounted under `/workspaces`
 * (cookie session, PBAC via `connect.*` permissions).
 */
export const connectDashboard = new Hono<HonoEnv>();

function listItem(c: Context<HonoEnv>, row: ConnectionWithAppName): DomainConnectionListItemDTO {
  return {
    ...connectionToDTO(row.connection.snapshot(), c.get("container").services.connectCatalog),
    applicationName: row.applicationName,
  };
}

// ── Applications ────────────────────────────────────────────────────────

connectDashboard.get("/:slug/connect/applications", async (c) => {
  const { workspace, me } = await resolveSlug(c);
  requirePermission(me, "connect.applications.view");
  const rows = await c.get("container").services.listConnectApplications.execute(workspace.id);
  return c.json(rows.map((r) => applicationToDTO(r.application, r.domainCount)));
});

connectDashboard.post("/:slug/connect/applications", async (c) => {
  const body = createApplicationSchema.parse(await c.req.json());
  const { workspace, me } = await resolveSlug(c);
  requirePermission(me, "connect.applications.manage");
  const { application, secret } = await c
    .get("container")
    .services.createConnectApplication.execute({
      workspaceId: workspace.id,
      actorMemberId: me.id,
      settings: body,
    });
  c.get("log")?.set({ action: "connect.application.create", connect: { applicationId: application.id } });
  return c.json({ application: applicationToDTO(application, 0), secret }, 201);
});

connectDashboard.get("/:slug/connect/applications/:appId", async (c) => {
  const { workspace, me } = await resolveSlug(c);
  requirePermission(me, "connect.applications.view");
  const row = await c
    .get("container")
    .services.listConnectApplications.get(workspace.id, c.req.param("appId"));
  return c.json(applicationToDTO(row.application, row.domainCount));
});

connectDashboard.patch("/:slug/connect/applications/:appId", async (c) => {
  const body = updateApplicationSchema.parse(await c.req.json());
  const { workspace, me } = await resolveSlug(c);
  requirePermission(me, "connect.applications.manage");
  const row = await c.get("container").services.updateConnectApplication.execute({
    workspaceId: workspace.id,
    applicationId: c.req.param("appId"),
    actorMemberId: me.id,
    settings: body,
  });
  return c.json(applicationToDTO(row.application, row.domainCount));
});

connectDashboard.delete("/:slug/connect/applications/:appId", async (c) => {
  const { workspace, me } = await resolveSlug(c);
  requirePermission(me, "connect.applications.manage");
  await c.get("container").services.deleteConnectApplication.execute({
    workspaceId: workspace.id,
    applicationId: c.req.param("appId"),
    actorMemberId: me.id,
  });
  c.get("log")?.set({ action: "connect.application.delete", connect: { applicationId: c.req.param("appId") } });
  return c.body(null, 204);
});

connectDashboard.post("/:slug/connect/applications/:appId/rotate-secret", async (c) => {
  const { workspace, me } = await resolveSlug(c);
  requirePermission(me, "connect.applications.manage");
  const row = await c.get("container").services.rotateConnectApplicationSecret.execute({
    workspaceId: workspace.id,
    applicationId: c.req.param("appId"),
    actorMemberId: me.id,
  });
  c.get("log")?.set({ action: "connect.application.rotate_secret", connect: { applicationId: row.application.id } });
  return c.json({ application: applicationToDTO(row.application, row.domainCount), secret: row.secret });
});

connectDashboard.post("/:slug/connect/applications/:appId/rotate-webhook-secret", async (c) => {
  const { workspace, me } = await resolveSlug(c);
  requirePermission(me, "connect.applications.manage");
  const row = await c.get("container").services.rotateConnectWebhookSecret.execute({
    workspaceId: workspace.id,
    applicationId: c.req.param("appId"),
    actorMemberId: me.id,
  });
  return c.json(applicationToDTO(row.application, row.domainCount));
});

connectDashboard.post("/:slug/connect/applications/:appId/test-token", async (c) => {
  const { workspace, me } = await resolveSlug(c);
  requirePermission(me, "connect.applications.manage");
  const container = c.get("container");
  const { application } = await container.services.listConnectApplications.get(
    workspace.id,
    c.req.param("appId"),
  );
  const { token, expiresIn } = container.services.connectSdkAuth.issueFor(application);
  return c.json({
    applicationId: application.id,
    auth_token: token,
    expires_in: expiresIn,
    apiOrigin: container.config.apiOrigin,
  });
});

connectDashboard.post("/:slug/connect/applications/:appId/test-webhook", async (c) => {
  const { workspace, me } = await resolveSlug(c);
  requirePermission(me, "connect.applications.manage");
  const container = c.get("container");
  const { application } = await container.services.listConnectApplications.get(
    workspace.id,
    c.req.param("appId"),
  );
  if (!application.webhookUrl) {
    throw new ValidationError("application.webhook_url_missing", "set a webhook URL first");
  }
  const delivery = await container.services.connectWebhooks.sendTest(application);
  return c.json(deliveryToDTO(delivery));
});

connectDashboard.get("/:slug/connect/applications/:appId/deliveries", async (c) => {
  const { workspace, me } = await resolveSlug(c);
  requirePermission(me, "connect.applications.view");
  const rows = await c
    .get("container")
    .services.listConnectApplications.deliveries(workspace.id, c.req.param("appId"));
  return c.json(rows.map(deliveryToDTO));
});

// ── Domains ─────────────────────────────────────────────────────────────

connectDashboard.get("/:slug/connect/domains", async (c) => {
  const { workspace, me } = await resolveSlug(c);
  requirePermission(me, "connect.domains.view");
  const query = listDomainConnectionsQuerySchema.parse(c.req.query());
  const page = await c.get("container").services.listDomainConnections.execute({
    workspaceId: workspace.id,
    applicationId: query.applicationId || undefined,
    status: query.status,
    q: query.q || undefined,
    cursor: query.cursor || undefined,
  });
  return c.json({ items: page.items.map((r) => listItem(c, r)), nextCursor: page.nextCursor });
});

connectDashboard.get("/:slug/connect/domains/:connectionId", async (c) => {
  const { workspace, me } = await resolveSlug(c);
  requirePermission(me, "connect.domains.view");
  const row = await c
    .get("container")
    .services.listDomainConnections.get({ workspaceId: workspace.id }, c.req.param("connectionId"));
  return c.json(listItem(c, row));
});

connectDashboard.post("/:slug/connect/domains/:connectionId/verify", async (c) => {
  const { workspace, me } = await resolveSlug(c);
  requirePermission(me, "connect.domains.manage");
  const container = c.get("container");
  const scope = { workspaceId: workspace.id };
  const id = c.req.param("connectionId");
  await container.services.verifyDomainConfiguration.execute(scope, id);
  return c.json(listItem(c, await container.services.listDomainConnections.get(scope, id)));
});

connectDashboard.delete("/:slug/connect/domains/:connectionId", async (c) => {
  const { workspace, me } = await resolveSlug(c);
  requirePermission(me, "connect.domains.manage");
  await c
    .get("container")
    .services.deleteDomainConnection.execute(workspace.id, c.req.param("connectionId"));
  return c.body(null, 204);
});
