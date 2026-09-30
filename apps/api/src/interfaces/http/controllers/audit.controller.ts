// +feature:audit-log
import { Hono } from "hono";
import { z } from "zod";
import { MAX_PAGE_SIZE } from "@/audit/infrastructure/cursor.ts";
import {
  appAuditEntryToDTO,
  workspaceAuditEntryToDTO,
} from "@/interfaces/mappers.ts";
import type { HonoEnv } from "../middleware/container.ts";
import { requireAppAdmin, requirePermission } from "../middleware/session.ts";
import { resolveSlug } from "./workspaces.controller.ts";

export const workspaceAudit = new Hono<HonoEnv>();
export const appAudit = new Hono<HonoEnv>();

// Cursors are opaque base64url strings minted by the repository; we
// forward them through untouched and let the decoder downstream treat
// an invalid cursor as "no cursor". We still bound the length so a
// pathological query string can't bloat memory.
const listQuerySchema = z.object({
  cursor: z.string().min(1).max(400).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
  q: z.string().min(1).max(160).optional(),
});

workspaceAudit.get("/:slug/audit", async (c) => {
  const { workspace, me } = await resolveSlug(c);
  requirePermission(me, "workspace.audit_log.view");

  const query = listQuerySchema.parse(
    Object.fromEntries(new URL(c.req.url).searchParams),
  );

  const page = await c.get("container").services.listWorkspaceAudit.execute({
    workspaceId: workspace.id,
    cursor: query.cursor,
    limit: query.limit,
    q: query.q,
  });

  c.get("log")?.set({
    action: "audit.workspace.list",
    result: { count: page.items.length, hasMore: page.nextCursor !== null },
  });

  return c.json({
    items: page.items.map(workspaceAuditEntryToDTO),
    nextCursor: page.nextCursor,
  });
});

appAudit.get("/audit", async (c) => {
  await requireAppAdmin(c);
  const query = listQuerySchema.parse(
    Object.fromEntries(new URL(c.req.url).searchParams),
  );
  const page = await c.get("container").services.listAppAudit.execute({
    cursor: query.cursor,
    limit: query.limit,
    q: query.q,
  });
  c.get("log")?.set({
    action: "audit.app.list",
    result: { count: page.items.length, hasMore: page.nextCursor !== null },
  });
  return c.json({
    items: page.items.map(appAuditEntryToDTO),
    nextCursor: page.nextCursor,
  });
});
// -feature:audit-log
