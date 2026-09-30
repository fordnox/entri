import { Hono } from "hono";
import type { RuntimeConfigDTO } from "@orbit/shared/dto";
import type { HonoEnv } from "../middleware/container.ts";

export const config = new Hono<HonoEnv>();

/**
 * Public runtime config for the web/www clients. Exposes only what the
 * browser legitimately needs to diverge its UI on (feature flags) —
 * never secrets, never per-user state. Sent unauthenticated so the
 * unauth'd /request-access page can read it too.
 */
config.get("/", async (c) => {
  const container = c.get("container");
  void container;
  const dto: RuntimeConfigDTO = {
    // +feature:billing
    billing: {
      enabled: container.config.billing.enabled,
      provider: container.config.billing.enabled
        ? container.config.billing.provider
        : null,
    },
    // -feature:billing
  };
  return c.json(dto);
});
