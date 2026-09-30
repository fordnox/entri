import { describe, expect, it } from "vitest";
import { NamecheapAdapter, parseHosts } from "./namecheap.ts";
import { stubFetch } from "./testing.ts";

const creds = {
  apiUser: "acmeuser",
  apiKey: "nc-api-key-secret-9999",
  username: "acmeuser",
  clientIp: "203.0.113.10",
};

const getHostsXml = `<?xml version="1.0" encoding="utf-8"?>
<ApiResponse Status="OK" xmlns="http://api.namecheap.com/xml.response">
  <Errors />
  <RequestedCommand>namecheap.domains.dns.getHosts</RequestedCommand>
  <CommandResponse Type="namecheap.domains.dns.getHosts">
    <DomainDNSGetHostsResult Domain="acme.co.uk" EmailType="MX" IsUsingOurDNS="true">
      <host HostId="1" Name="@" Type="URL" Address="http://www.acme.co.uk/" MXPref="10" TTL="1800" />
      <host HostId="2" Name="www" Type="CNAME" Address="parkingpage.namecheap.com." MXPref="10" TTL="1800" />
      <host HostId="3" Name="@" Type="TXT" Address="v=spf1 include:spf.efwd.registrar-servers.com ~all" MXPref="10" TTL="1800" />
      <host HostId="4" Name="@" Type="MX" Address="eforward1.registrar-servers.com." MXPref="10" TTL="1800" />
      <host HostId="5" Name="q" Type="TXT" Address="a &amp; b &quot;c&quot;" MXPref="10" TTL="60" />
    </DomainDNSGetHostsResult>
  </CommandResponse>
</ApiResponse>`;

const setOk = `<?xml version="1.0"?><ApiResponse Status="OK"><CommandResponse><DomainDNSSetHostsResult Domain="acme.co.uk" IsSuccess="true" /></CommandResponse></ApiResponse>`;

const form = (body: string | undefined) => new URLSearchParams(body ?? "");

describe("NamecheapAdapter", () => {
  it("parses hosts and decodes entities", () => {
    const hosts = parseHosts(getHostsXml);
    expect(hosts).toHaveLength(5);
    expect(hosts[4]).toMatchObject({ name: "q", type: "TXT", address: 'a & b "c"', ttl: "60" });
  });

  it("gets hosts, merges, and sets the complete list", async () => {
    const { fetch, calls } = stubFetch((c) => {
      const cmd = form(c.body).get("Command");
      if (cmd === "namecheap.domains.dns.getHosts") return { body: getHostsXml };
      if (cmd === "namecheap.domains.dns.setHosts") return { body: setOk };
      return undefined;
    });
    const res = await new NamecheapAdapter(fetch).applyRecords({
      zone: "acme.co.uk",
      credentials: creds,
      records: [
        { type: "CNAME", name: "www", value: "cname.vercel-dns.com", ttl: 300 },
        { type: "TXT", name: "@", value: "connect-verify=abc", ttl: 300 },
        { type: "A", name: "@", value: "76.76.21.21", ttl: 300 },
      ],
    });
    expect(res.written).toBe(3);
    expect(calls).toHaveLength(2);

    const get = form(calls[0]!.body);
    expect(calls[0]!.url).toBe("https://api.namecheap.com/xml.response");
    expect(get.get("SLD")).toBe("acme");
    expect(get.get("TLD")).toBe("co.uk");
    expect(get.get("ApiUser")).toBe("acmeuser");
    expect(get.get("ClientIp")).toBe("203.0.113.10");

    const set = form(calls[1]!.body);
    expect(set.get("Command")).toBe("namecheap.domains.dns.setHosts");
    const hosts: Array<Record<string, string | null>> = [];
    for (let i = 1; set.has(`HostName${i}`); i++) {
      hosts.push({
        name: set.get(`HostName${i}`),
        type: set.get(`RecordType${i}`),
        address: set.get(`Address${i}`),
        ttl: set.get(`TTL${i}`),
        mx: set.get(`MXPref${i}`),
      });
    }
    // Unmanaged URL redirect, SPF TXT, MX and the other TXT survive; CNAME is replaced.
    expect(hosts).toEqual([
      { name: "@", type: "URL", address: "http://www.acme.co.uk/", ttl: "1800", mx: null },
      { name: "@", type: "TXT", address: "v=spf1 include:spf.efwd.registrar-servers.com ~all", ttl: "1800", mx: null },
      { name: "@", type: "MX", address: "eforward1.registrar-servers.com.", ttl: "1800", mx: "10" },
      { name: "q", type: "TXT", address: 'a & b "c"', ttl: "60", mx: null },
      { name: "www", type: "CNAME", address: "cname.vercel-dns.com.", ttl: "300", mx: null },
      { name: "@", type: "TXT", address: "connect-verify=abc", ttl: "300", mx: null },
      { name: "@", type: "A", address: "76.76.21.21", ttl: "300", mx: null },
    ]);
    expect(set.get("EmailType")).toBe("MX");
  });

  it("does not call setHosts when nothing changes", async () => {
    const { fetch, calls } = stubFetch(() => ({ body: getHostsXml }));
    const res = await new NamecheapAdapter(fetch).applyRecords({
      zone: "acme.co.uk",
      credentials: creds,
      records: [{ type: "CNAME", name: "www", value: "parkingpage.namecheap.com", ttl: 300 }],
    });
    expect(res.written).toBe(0);
    expect(calls).toHaveLength(1);
  });

  it("maps API errors (returned with HTTP 200)", async () => {
    const errXml = (n: string, msg: string) =>
      `<?xml version="1.0"?><ApiResponse Status="ERROR"><Errors><Error Number="${n}">${msg}</Error></Errors></ApiResponse>`;
    for (const [n, msg, code] of [
      ["1011102", `API Key is invalid or API access has not been enabled ${creds.apiKey}`, "invalid_credentials"],
      ["1011150", "Invalid request IP: 198.51.100.1", "invalid_credentials"],
      ["2019166", "Domain not found", "zone_not_found"],
      ["2016166", "Domain is not associated with your account", "zone_not_found"],
      ["3050900", "Unknown error", "provider_error"],
    ] as const) {
      const { fetch } = stubFetch(() => ({ body: errXml(n, msg) }));
      const e = await new NamecheapAdapter(fetch)
        .applyRecords({
          zone: "acme.com",
          credentials: creds,
          records: [{ type: "A", name: "@", value: "1.1.1.1", ttl: 300 }],
        })
        .catch((x: unknown) => x);
      expect(e).toMatchObject({ code });
      expect((e as Error).message).not.toContain(creds.apiKey);
    }
  });

  it("refuses domains not on Namecheap BasicDNS", async () => {
    const { fetch } = stubFetch(() => ({ body: getHostsXml.replace('IsUsingOurDNS="true"', 'IsUsingOurDNS="false"') }));
    await expect(
      new NamecheapAdapter(fetch).applyRecords({
        zone: "acme.co.uk",
        credentials: creds,
        records: [{ type: "A", name: "@", value: "1.1.1.1", ttl: 300 }],
      }),
    ).rejects.toMatchObject({ code: "provider_error" });
  });

  it("requires all four credentials", async () => {
    const { fetch } = stubFetch(() => ({ body: getHostsXml }));
    await expect(
      new NamecheapAdapter(fetch).applyRecords({
        zone: "acme.com",
        credentials: { apiUser: "a", apiKey: "b", username: "c" },
        records: [],
      }),
    ).rejects.toMatchObject({ code: "invalid_credentials" });
  });
});
