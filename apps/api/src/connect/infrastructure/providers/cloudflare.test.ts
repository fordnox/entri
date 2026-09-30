import { describe, expect, it } from "vitest";
import { ProviderApiError } from "@/connect/domain/dns-provider.ts";
import { CloudflareAdapter } from "./cloudflare.ts";
import { jsonBody, stubFetch } from "./testing.ts";

const TOKEN = "cf-secret-token-123";
const ok = (result: unknown, extra: Record<string, unknown> = {}) => ({
  body: { success: true, errors: [], result, ...extra },
});

describe("CloudflareAdapter", () => {
  it("finds the zone, replaces a parked A, adds TXT and creates CAA", async () => {
    const { fetch, calls } = stubFetch((c) => {
      if (c.url.includes("/zones?name=")) return ok([{ id: "z1", name: "acme.com" }]);
      if (c.method === "GET" && c.url.includes("/dns_records")) {
        return ok(
          [
            { id: "r1", type: "A", name: "acme.com", content: "34.1.1.1", ttl: 1 },
            { id: "r2", type: "TXT", name: "acme.com", content: '"google-site-verification=x"', ttl: 1 },
            { id: "r3", type: "CNAME", name: "www.acme.com", content: "app.example.net", ttl: 1 },
          ],
          { result_info: { page: 1, total_pages: 1 } },
        );
      }
      return ok({ id: "new" });
    });
    const adapter = new CloudflareAdapter(fetch);
    const res = await adapter.applyRecords({
      zone: "Acme.com.",
      credentials: { apiToken: TOKEN },
      records: [
        { type: "A", name: "@", value: "76.76.21.21", ttl: 300 },
        { type: "TXT", name: "@", value: "connect-verify=abc", ttl: 300 },
        { type: "CNAME", name: "www", value: "app.example.net.", ttl: 300 },
        { type: "CAA", name: "@", value: '0 issue "letsencrypt.org"', ttl: 300 },
      ],
    });

    expect(res.written).toBe(3);
    expect(calls[0]!.url).toBe("https://api.cloudflare.com/client/v4/zones?name=acme.com&per_page=5");
    expect(calls[0]!.headers.authorization).toBe(`Bearer ${TOKEN}`);

    const writes = calls.filter((c) => c.method !== "GET");
    const put = writes.find((c) => c.method === "PUT")!;
    expect(put.url).toMatch(/\/zones\/z1\/dns_records\/r1$/);
    expect(jsonBody(put)).toEqual({
      type: "A",
      name: "acme.com",
      content: "76.76.21.21",
      ttl: 300,
      proxied: false,
    });
    const posts = writes.filter((c) => c.method === "POST").map(jsonBody);
    expect(posts).toContainEqual({ type: "TXT", name: "acme.com", content: "connect-verify=abc", ttl: 300 });
    expect(posts).toContainEqual({
      type: "CAA",
      name: "acme.com",
      ttl: 300,
      data: { flags: 0, tag: "issue", value: "letsencrypt.org" },
    });
    // Identical CNAME is a no-op.
    expect(writes.some((c) => jsonBody(c)?.type === "CNAME")).toBe(false);
  });

  it("maps a missing zone to zone_not_found", async () => {
    const { fetch } = stubFetch(() => ok([]));
    await expect(
      new CloudflareAdapter(fetch).applyRecords({
        zone: "acme.com",
        credentials: { apiToken: TOKEN },
        records: [{ type: "A", name: "@", value: "1.1.1.1", ttl: 300 }],
      }),
    ).rejects.toMatchObject({ code: "zone_not_found" });
  });

  it("maps 401/403/429 and never leaks the token", async () => {
    for (const [status, code] of [
      [401, "invalid_credentials"],
      [403, "permission_denied"],
      [429, "rate_limited"],
      [500, "provider_error"],
    ] as const) {
      const { fetch } = stubFetch(() => ({
        status,
        body: { success: false, errors: [{ code: 99999, message: `nope ${TOKEN}` }] },
      }));
      const err = await new CloudflareAdapter(fetch)
        .applyRecords({
          zone: "acme.com",
          credentials: { apiToken: TOKEN },
          records: [{ type: "A", name: "@", value: "1.1.1.1", ttl: 300 }],
        })
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(ProviderApiError);
      expect((err as ProviderApiError).code).toBe(code);
      expect((err as Error).message).not.toContain(TOKEN);
    }
  });

  it("rejects missing credentials without calling the API", async () => {
    const { fetch, calls } = stubFetch(() => ok([]));
    await expect(
      new CloudflareAdapter(fetch).applyRecords({ zone: "acme.com", credentials: {}, records: [] }),
    ).rejects.toMatchObject({ code: "invalid_credentials" });
    expect(calls).toHaveLength(0);
  });
});
