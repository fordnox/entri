import { describe, expect, it } from "vitest";
import { GoDaddyAdapter } from "./godaddy.ts";
import { jsonBody, stubFetch } from "./testing.ts";

const creds = { apiKey: "gd-key-0001", apiSecret: "gd-secret-0002" };

describe("GoDaddyAdapter", () => {
  it("merges TXT/MX into existing sets and replaces A", async () => {
    const { fetch, calls } = stubFetch((c) => {
      if (c.method === "GET") {
        return {
          body: [
            { type: "A", name: "@", data: "34.102.136.180", ttl: 600 },
            { type: "TXT", name: "@", data: "v=spf1 include:_spf.google.com ~all", ttl: 3600 },
            { type: "MX", name: "@", data: "mx1.example.net", ttl: 3600, priority: 10 },
            { type: "CNAME", name: "www", data: "@", ttl: 3600 },
            { type: "NS", name: "@", data: "ns07.domaincontrol.com", ttl: 3600 },
          ],
        };
      }
      return { status: 200 };
    });
    const res = await new GoDaddyAdapter(fetch).applyRecords({
      zone: "acme.com",
      credentials: creds,
      records: [
        { type: "A", name: "@", value: "76.76.21.21", ttl: 300 },
        { type: "TXT", name: "@", value: "connect=1", ttl: 300 },
        { type: "MX", name: "@", value: "mx2.example.net.", ttl: 300, priority: 20 },
      ],
    });
    expect(res.written).toBe(3);
    expect(calls[0]!.url).toBe("https://api.godaddy.com/v1/domains/acme.com/records?limit=500&offset=0");
    expect(calls[0]!.headers.authorization).toBe("sso-key gd-key-0001:gd-secret-0002");

    const put = (path: string) => calls.find((c) => c.method === "PUT" && c.url.endsWith(path))!;
    expect(jsonBody(put("/records/A/%40"))).toEqual([{ data: "76.76.21.21", ttl: 600 }]);
    expect(jsonBody(put("/records/TXT/%40"))).toEqual([
      { data: "v=spf1 include:_spf.google.com ~all", ttl: 600 },
      { data: "connect=1", ttl: 600 },
    ]);
    expect(jsonBody(put("/records/MX/%40"))).toEqual([
      { data: "mx1.example.net", ttl: 600, priority: 10 },
      { data: "mx2.example.net", ttl: 600, priority: 20 },
    ]);
    expect(calls.filter((c) => c.method === "PUT")).toHaveLength(3);
  });

  it("deletes a set emptied by a CNAME replacement", async () => {
    const { fetch, calls } = stubFetch((c) =>
      c.method === "GET"
        ? { body: [{ type: "A", name: "shop", data: "1.2.3.4", ttl: 600 }] }
        : { status: 200 },
    );
    await new GoDaddyAdapter(fetch).applyRecords({
      zone: "acme.com",
      credentials: creds,
      records: [{ type: "CNAME", name: "shop", value: "shops.myshopify.com", ttl: 3600 }],
    });
    const writes = calls.filter((c) => c.method !== "GET");
    expect(writes.map((c) => `${c.method} ${c.url.replace(/^.*\/records/, "")}`)).toEqual([
      "DELETE /A/shop",
      "PUT /CNAME/shop",
    ]);
    expect(jsonBody(writes[1]!)).toEqual([{ data: "shops.myshopify.com", ttl: 3600 }]);
  });

  it("maps GoDaddy error codes", async () => {
    const cases = [
      [401, { code: "UNABLE_TO_AUTHENTICATE", message: "Unauthorized" }, "invalid_credentials"],
      [403, { code: "ACCESS_DENIED", message: "Authenticated user is not allowed access" }, "permission_denied"],
      [404, { code: "UNKNOWN_DOMAIN", message: "The given domain is not registered" }, "zone_not_found"],
      [429, { code: "TOO_MANY_REQUESTS", message: "slow down" }, "rate_limited"],
    ] as const;
    for (const [status, body, code] of cases) {
      const { fetch } = stubFetch(() => ({ status, body }));
      const err = await new GoDaddyAdapter(fetch)
        .applyRecords({
          zone: "acme.com",
          credentials: creds,
          records: [{ type: "A", name: "@", value: "1.1.1.1", ttl: 300 }],
        })
        .catch((e: unknown) => e);
      expect(err).toMatchObject({ code });
      expect((err as Error).message).not.toContain(creds.apiSecret);
    }
  });

  it("requires both key and secret", async () => {
    const { fetch } = stubFetch(() => ({ body: [] }));
    await expect(
      new GoDaddyAdapter(fetch).applyRecords({ zone: "acme.com", credentials: { apiKey: "x" }, records: [] }),
    ).rejects.toMatchObject({ code: "invalid_credentials" });
  });
});
