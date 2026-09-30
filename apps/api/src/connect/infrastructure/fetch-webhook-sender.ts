import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import type { WebhookSender, WebhookSendResult } from "../application/ports.ts";

const TIMEOUT_MS = 10_000;

const PRIVATE = new BlockList();
for (const [net, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.168.0.0", 16],
] as const) {
  PRIVATE.addSubnet(net, prefix, "ipv4");
}
for (const [net, prefix] of [
  ["::1", 128],
  ["fc00::", 7],
  ["fe80::", 10],
  ["::ffff:0:0", 96],
] as const) {
  PRIVATE.addSubnet(net, prefix, "ipv6");
}

/**
 * POSTs webhooks with a hard timeout and no redirects. With
 * `blockPrivateNetworks` (on in production) the target host is resolved
 * first and loopback / RFC 1918 / link-local addresses are refused, so
 * an application's webhook URL can't be aimed at the API's own network.
 */
export class FetchWebhookSender implements WebhookSender {
  constructor(private readonly opts: { blockPrivateNetworks: boolean }) {}

  async send(url: string, body: string, headers: Record<string, string>): Promise<WebhookSendResult> {
    try {
      if (this.opts.blockPrivateNetworks) {
        const hostname = new URL(url).hostname.replace(/^\[|\]$/g, "");
        const addrs = isIP(hostname)
          ? [{ address: hostname, family: isIP(hostname) }]
          : await lookup(hostname, { all: true });
        for (const a of addrs) {
          if (PRIVATE.check(a.address, a.family === 6 ? "ipv6" : "ipv4")) {
            return { ok: false, statusCode: null, error: "webhook host resolves to a private address" };
          }
        }
      }
      const res = await fetch(url, {
        method: "POST",
        headers,
        body,
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      await res.body?.cancel().catch(() => {});
      if (res.status >= 200 && res.status < 300) {
        return { ok: true, statusCode: res.status, error: null };
      }
      return { ok: false, statusCode: res.status, error: `receiver answered HTTP ${res.status}` };
    } catch (err) {
      const name = (err as { name?: string }).name;
      const error =
        name === "TimeoutError"
          ? `no response within ${TIMEOUT_MS / 1000}s`
          : err instanceof Error
            ? err.message
            : String(err);
      return { ok: false, statusCode: null, error };
    }
  }
}
