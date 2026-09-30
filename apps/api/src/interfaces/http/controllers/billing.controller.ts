import { Hono } from "hono";
import { log } from "evlog";
import { ConflictError } from "@/kernel/errors.ts";
import { workspaceBillingToDTO } from "@/interfaces/mappers.ts";
import { InvalidWebhookSignatureError } from "@/billing/application/billing-webhook-receiver.ts";
import type { HonoEnv } from "../middleware/container.ts";
import { requirePermission } from "../middleware/session.ts";
import {
  cancelSubscriptionSchema,
  openBillingPortalSchema,
  startCheckoutSchema,
} from "../schemas.ts";
import { resolveSlug } from "./workspaces.controller.ts";

export const billing = new Hono<HonoEnv>();

function ensureBillingEnabled(container: { config: { billing: { enabled: boolean } } }) {
  if (!container.config.billing.enabled) {
    throw new ConflictError(
      "billing.provider_not_configured",
      "billing is not configured on this server",
    );
  }
}

billing.get("/:slug/billing", async (c) => {
  const { workspace, me } = await resolveSlug(c);
  requirePermission(me, "billing.view");
  const container = c.get("container");
  const view = await container.services.getWorkspaceBilling.execute(workspace.id);
  return c.json(workspaceBillingToDTO(view));
});

billing.post("/:slug/billing/checkout", async (c) => {
  const body = startCheckoutSchema.parse(await c.req.json());
  const { workspace, me } = await resolveSlug(c);
  requirePermission(me, "billing.manage");
  const container = c.get("container");
  ensureBillingEnabled(container);
  const user = await container.uow.read((tx) => tx.users.findById(me.userId));
  const result = await container.services.startCheckout!.execute({
    workspaceId: workspace.id,
    planKey: body.planKey,
    actorEmail: user?.email.value ?? "",
    successUrl: body.successUrl,
    cancelUrl: body.cancelUrl,
  });
  c.get("log")?.set({
    action: "billing.checkout.start",
    plan: body.planKey,
    result: { sessionId: result.sessionId },
  });
  return c.json({ redirectUrl: result.redirectUrl, sessionId: result.sessionId });
});

billing.post("/:slug/billing/portal", async (c) => {
  const body = openBillingPortalSchema.parse(await c.req.json());
  const { workspace, me } = await resolveSlug(c);
  requirePermission(me, "billing.manage");
  const container = c.get("container");
  ensureBillingEnabled(container);
  const { redirectUrl } = await container.services.openPortal!.execute({
    workspaceId: workspace.id,
    returnUrl: body.returnUrl,
  });
  return c.json({ redirectUrl });
});

billing.post("/:slug/billing/cancel", async (c) => {
  const body = cancelSubscriptionSchema.parse(await c.req.json());
  const { workspace, me } = await resolveSlug(c);
  requirePermission(me, "billing.manage");
  const container = c.get("container");
  ensureBillingEnabled(container);
  await container.services.cancelSubscription!.execute({
    workspaceId: workspace.id,
    atPeriodEnd: body.atPeriodEnd,
  });
  return c.body(null, 204);
});

/**
 * Top-level webhook endpoint. Mounted at `/v1/billing/webhooks/:provider`
 * so multiple providers can coexist under a single prefix. We read the
 * raw body as text (not JSON!) because most provider SDKs sign the
 * exact bytes of the request body; re-serializing would break
 * signature verification.
 */
export const billingWebhooks = new Hono<HonoEnv>();

billingWebhooks.post("/:provider", async (c) => {
  const provider = c.req.param("provider");
  const container = c.get("container");
  const handler = container.services.handleBillingWebhook;
  if (!handler || handler.provider !== provider) {
    return c.json(
      { error: { code: "billing.provider_not_configured", message: `no webhook handler for provider '${provider}'` } },
      404,
    );
  }
  const rawBody = await c.req.text();
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(c.req.header())) {
    if (typeof v === "string") headers[k.toLowerCase()] = v;
  }
  try {
    const result = await handler.service.execute({ rawBody, headers });
    c.get("log")?.set({
      action: "billing.webhook",
      provider,
      event: { type: result.eventType, processed: result.processed },
    });
    return c.json({ ok: true, processed: result.processed });
  } catch (err) {
    if (err instanceof InvalidWebhookSignatureError) {
      log.warn({ action: "billing.webhook.invalid_signature", provider });
      return c.json(
        { error: { code: err.code, message: err.message } },
        400,
      );
    }
    throw err;
  }
});
