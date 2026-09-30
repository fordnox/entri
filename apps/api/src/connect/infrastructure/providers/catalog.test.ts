import { describe, expect, it } from "vitest";
import { buildDefaultProviderCatalog, StaticProviderCatalog } from "./catalog.ts";

const catalog = buildDefaultProviderCatalog(async () => {
  throw new Error("no network in tests");
});

describe("StaticProviderCatalog.detect", () => {
  const cases: Array<[string, string[], string]> = [
    ["cloudflare", ["ada.ns.cloudflare.com", "bob.ns.cloudflare.com"], "cloudflare"],
    ["godaddy", ["ns07.domaincontrol.com", "ns08.domaincontrol.com"], "godaddy"],
    ["namecheap", ["dns1.registrar-servers.com", "dns2.registrar-servers.com"], "namecheap"],
    [
      "route53",
      ["ns-1536.awsdns-00.co.uk", "ns-0.awsdns-00.com", "ns-1024.awsdns-00.org", "ns-512.awsdns-00.net"],
      "route53",
    ],
    ["digitalocean", ["ns1.digitalocean.com", "ns2.digitalocean.com", "ns3.digitalocean.com"], "digitalocean"],
    ["porkbun", ["curitiba.ns.porkbun.com", "fortaleza.ns.porkbun.com"], "porkbun"],
    ["vercel", ["ns1.vercel-dns.com", "ns2.vercel-dns.com"], "vercel"],
    ["hetzner", ["hydrogen.ns.hetzner.com", "oxygen.ns.hetzner.com", "helium.ns.hetzner.de"], "hetzner"],
    ["gandi", ["ns-1-a.gandi.net", "ns-2-b.gandi.net", "ns-3-c.gandi.net"], "gandi"],
    ["netlify", ["dns1.p05.nsone.net", "dns2.p05.nsone.net"], "netlify"],
    ["ns1 (non-netlify)", ["dns1.p05.nsone.net.example"], "__none__"],
    ["squarespace", ["ns-cloud-c1.googledomains.com", "ns-cloud-c2.googledomains.com"], "squarespace"],
    ["ionos", ["ns1045.ui-dns.com", "ns1106.ui-dns.de", "ns1073.ui-dns.biz", "ns1094.ui-dns.org"], "ionos"],
    ["azure", ["ns1-01.azure-dns.com", "ns2-01.azure-dns.net"], "azure"],
    ["wix", ["ns0.wixdns.net", "ns1.wixdns.net"], "wix"],
  ];

  for (const [label, ns, expected] of cases) {
    it(`detects ${label}`, () => {
      const hit = catalog.detect(ns);
      expect(hit?.descriptor.key ?? "__none__").toBe(expected);
    });
  }

  it("is case-insensitive and ignores trailing dots / whitespace", () => {
    expect(catalog.detect(["  ADA.NS.CLOUDFLARE.COM.  "])?.descriptor.key).toBe("cloudflare");
    expect(catalog.detect(["NS-1536.AWSDNS-00.CO.UK."])?.descriptor.key).toBe("route53");
  });

  it("matches a suffix on label boundaries only", () => {
    expect(catalog.detect(["ns1.notdomaincontrol.com"])).toBeNull();
    expect(catalog.detect(["domaincontrol.com"])?.descriptor.key).toBe("godaddy");
  });

  it("returns null for unknown or empty nameservers", () => {
    expect(catalog.detect(["ns1.example-unknown-host.test"])).toBeNull();
    expect(catalog.detect([])).toBeNull();
    expect(catalog.detect(["", "."])).toBeNull();
  });

  it("falls back to NS1 for nsone.net hosts that aren't Netlify-shaped", () => {
    expect(catalog.detect(["dns1.p05.nsone.net"])?.descriptor.key).toBe("netlify");
    expect(catalog.detect(["a.ns1-custom.nsone.net"])?.descriptor.key).toBe("ns1");
  });
});

describe("StaticProviderCatalog listing", () => {
  const entries = catalog.list();

  it("has unique keys", () => {
    const keys = entries.map((e) => e.descriptor.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("includes the 12 automated providers, each with an adapter whose key matches", () => {
    const auto = entries.filter((e) => e.descriptor.automated);
    expect(auto.map((e) => e.descriptor.key).sort()).toEqual(
      [
        "cloudflare",
        "digitalocean",
        "dnsimple",
        "gandi",
        "godaddy",
        "hetzner",
        "namecheap",
        "namecom",
        "netlify",
        "porkbun",
        "route53",
        "vercel",
      ].sort(),
    );
    for (const e of auto) {
      expect(e.adapter?.key).toBe(e.descriptor.key);
      expect(e.descriptor.credentialFields.length).toBeGreaterThan(0);
      expect(e.descriptor.credentialsUrl).toMatch(/^https:\/\//);
    }
  });

  it("has at least 45 manual-only providers without adapters or credentials", () => {
    const manual = entries.filter((e) => !e.descriptor.automated);
    expect(manual.length).toBeGreaterThanOrEqual(45);
    for (const e of manual) {
      expect(e.adapter).toBeUndefined();
      expect(e.descriptor.credentialFields).toEqual([]);
      expect(e.descriptor.credentialsUrl).toBeNull();
    }
  });

  it("lists automated first, then by name", () => {
    const firstManual = entries.findIndex((e) => !e.descriptor.automated);
    expect(entries.slice(firstManual).every((e) => !e.descriptor.automated)).toBe(true);
    const names = (xs: typeof entries) => xs.map((e) => e.descriptor.name);
    const auto = entries.slice(0, firstManual);
    const man = entries.slice(firstManual);
    expect(names(auto)).toEqual([...names(auto)].sort((a, b) => a.localeCompare(b, "en")));
    expect(names(man)).toEqual([...names(man)].sort((a, b) => a.localeCompare(b, "en")));
  });

  it("get() looks up by key", () => {
    expect(catalog.get("route53")?.descriptor.name).toBe("Amazon Route 53");
    expect(catalog.get("nope")).toBeNull();
  });

  it("rejects duplicate keys", () => {
    const e = catalog.get("wix")!;
    expect(() => new StaticProviderCatalog([e, e])).toThrow(/Duplicate/);
  });
});
