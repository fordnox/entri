import { describe, expect, it } from "vitest";
import { parseUserDomain, resolveRecords } from "./dns-records.ts";

describe("parseUserDomain", () => {
  it.each([
    ["acme.com", "acme.com", "acme.com", null],
    ["  HTTPS://Shop.Acme.com/pricing?x=1 ", "shop.acme.com", "acme.com", "shop"],
    ["www.acme.co.uk.", "www.acme.co.uk", "acme.co.uk", "www"],
    ["a.b.acme.io:8080", "a.b.acme.io", "acme.io", "a.b"],
    ["bücher.de", "xn--bcher-kva.de", "xn--bcher-kva.de", null],
  ])("%s → %s", (raw, domain, root, sub) => {
    expect(parseUserDomain(raw)).toEqual({ domain, rootDomain: root, subdomain: sub });
  });

  it.each(["", "localhost", "co.uk", "1.2.3.4", "acme", "-acme.com", "ac me.com", "_x.acme.com"])(
    "rejects %j",
    (raw) => {
      expect(() => parseUserDomain(raw)).toThrow(/domain you own/);
    },
  );
});

describe("resolveRecords", () => {
  const apex = parseUserDomain("acme.com");
  const sub = parseUserDomain("shop.acme.com");

  it("resolves hosts relative to the entered domain", () => {
    const records = resolveRecords(
      [
        { type: "A", host: "@", value: "76.76.21.21" },
        { type: "CNAME", host: "www", value: "cname.host.com." },
        { type: "TXT", host: "_verify", value: '"token={DOMAIN}"' },
      ],
      apex,
    );
    expect(records.map((r) => [r.type, r.host, r.fqdn, r.value, r.ttl])).toEqual([
      ["A", "@", "acme.com", "76.76.21.21", 300],
      ["CNAME", "www", "www.acme.com", "cname.host.com", 300],
      ["TXT", "_verify", "_verify.acme.com", "token=acme.com", 300],
    ]);
  });

  it("puts subdomain records under the subdomain, zone-relative", () => {
    const records = resolveRecords(
      [
        { type: "CNAME", host: "@", value: "cname.host.com" },
        { type: "TXT", host: "_v", value: "{SUBDOMAIN}@{ROOT_DOMAIN}" },
      ],
      sub,
    );
    expect(records.map((r) => [r.host, r.fqdn, r.value])).toEqual([
      ["shop", "shop.acme.com", "cname.host.com"],
      ["_v.shop", "_v.shop.acme.com", "shop@acme.com"],
    ]);
  });

  it("picks the domain/subDomain branch", () => {
    const config = {
      domain: [{ type: "A" as const, host: "@", value: "1.2.3.4" }],
      subDomain: [{ type: "CNAME" as const, host: "@", value: "x.host.com" }],
    };
    expect(resolveRecords(config, apex)[0]!.type).toBe("A");
    expect(resolveRecords(config, sub)[0]!.type).toBe("CNAME");
  });

  it("defaults MX priority and normalizes CAA", () => {
    const [mx, caa] = resolveRecords(
      [
        { type: "MX", host: "@", value: "MX.Mail.com." },
        { type: "CAA", host: "@", value: "0 ISSUE letsencrypt.org" },
      ],
      apex,
    );
    expect(mx).toMatchObject({ value: "mx.mail.com", priority: 10 });
    expect(caa!.value).toBe('0 issue "letsencrypt.org"');
  });

  it("dedupes identical records", () => {
    const r = { type: "A" as const, host: "@", value: "1.2.3.4" };
    expect(resolveRecords([r, r], apex)).toHaveLength(1);
  });

  it.each([
    [[], /at least one/],
    [[{ type: "SRV", host: "@", value: "x" }], /type must be/],
    [[{ type: "A", host: "@", value: "not-an-ip" }], /IPv4/],
    [[{ type: "AAAA", host: "@", value: "1.2.3.4" }], /IPv6/],
    [[{ type: "CNAME", host: "@", value: "x.host.com" }], /apex/],
    [[{ type: "A", host: "a..b", value: "1.2.3.4" }], /not a valid/],
    [[{ type: "A", host: "@", value: "1.2.3.4", ttl: 5 }], /ttl/],
    [[{ type: "MX", host: "@", value: "mx.a.com", priority: -1 }], /priority/],
    [
      [
        { type: "CNAME", host: "www", value: "a.host.com" },
        { type: "TXT", host: "www", value: "x" },
      ],
      /alongside/,
    ],
  ])("rejects %j", (records, message) => {
    expect(() => resolveRecords(records as never, apex)).toThrow(message);
  });

  it("treats foreign-looking hosts as relative, so records never leave the zone", () => {
    const [r] = resolveRecords([{ type: "A", host: "www.other.com.", value: "1.2.3.4" }], apex);
    expect(r).toMatchObject({ fqdn: "www.other.com.acme.com", host: "www.other.com" });
  });
});
