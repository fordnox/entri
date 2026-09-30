import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { FakeClock } from "@/kernel/clock.ts";
import type { ConnectApplicationId } from "../domain/application.ts";
import { WEBHOOK_MAX_ATTEMPTS, WebhookDelivery } from "../domain/webhook-delivery.ts";
import { signWebhook } from "./webhook-dispatcher.ts";

describe("signWebhook", () => {
  it("produces t=<unix>,v1=<hmac of t.body>", () => {
    const at = new Date("2026-01-01T00:00:00Z");
    const header = signWebhook("whsec_x", '{"a":1}', at);
    const t = at.getTime() / 1000;
    const expected = createHmac("sha256", "whsec_x").update(`${t}.{"a":1}`).digest("hex");
    expect(header).toBe(`t=${t},v1=${expected}`);
  });
});

describe("WebhookDelivery", () => {
  const create = (clock: FakeClock) =>
    WebhookDelivery.create(
      {
        applicationId: "app_1" as ConnectApplicationId,
        connectionId: null,
        eventType: "webhook.test",
        url: "https://hooks.acme.com",
        buildPayload: (id, at) => ({ id, type: "webhook.test", createdAt: at.toISOString(), data: { connection: null } }),
      },
      clock,
    );

  it("embeds its own id in the payload and is due immediately", () => {
    const clock = new FakeClock();
    const d = create(clock);
    expect(d.payload.id).toBe(d.id);
    expect(d.nextAttemptAt?.getTime()).toBe(clock.now().getTime());
  });

  it("backs off, then fails after the last attempt", () => {
    const clock = new FakeClock();
    const d = create(clock);
    d.recordAttempt({ ok: false, statusCode: 500, error: "HTTP 500" }, clock);
    expect(d.status).toBe("pending");
    expect(d.nextAttemptAt!.getTime() - clock.now().getTime()).toBe(10_000);
    for (let i = 1; i < WEBHOOK_MAX_ATTEMPTS; i++) {
      d.recordAttempt({ ok: false, statusCode: null, error: "timeout" }, clock);
    }
    expect(d.status).toBe("failed");
    expect(d.attempts).toBe(WEBHOOK_MAX_ATTEMPTS);
    expect(d.nextAttemptAt).toBeNull();
  });

  it("succeeds on 2xx", () => {
    const clock = new FakeClock();
    const d = create(clock);
    d.recordAttempt({ ok: true, statusCode: 204 }, clock);
    expect(d.props()).toMatchObject({ status: "succeeded", lastStatusCode: 204, attempts: 1 });
  });
});
