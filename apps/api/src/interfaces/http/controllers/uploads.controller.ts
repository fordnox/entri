import { Hono } from "hono";
import type { HonoEnv } from "../middleware/container.ts";

export const uploads = new Hono<HonoEnv>();

/**
 * Mount the provider-owned upload route under `/v1/uploads`. Everything
 * provider-specific (signing, webhooks, policy enforcement at upload
 * time) lives behind `FileStorage.routeHandler`. Auth happens inside
 * the handler via the session-resolver composed in the composition
 * root — we don't wrap it with the usual `session()` middleware
 * because the provider SDK talks its own protocol and is responsible
 * for authz on each slot it exposes.
 */
uploads.all("/*", async (c) => {
  const container = c.get("container");
  const handler = container.fileStorage.routeHandler();
  return handler(c.req.raw);
});
