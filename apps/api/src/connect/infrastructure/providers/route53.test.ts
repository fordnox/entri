import { describe, expect, it } from "vitest";
import { signV4 } from "./aws-sigv4.ts";
import { Route53Adapter } from "./route53.ts";
import { stubFetch } from "./testing.ts";

// AWS SigV4 test suite credentials ("aws-sig-v4-test-suite").
const AKID = "AKIDEXAMPLE";
const SECRET = "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY";

describe("signV4", () => {
  it("matches the get-vanilla test vector", () => {
    const signed = signV4({
      method: "GET",
      url: "https://example.amazonaws.com/",
      accessKeyId: AKID,
      secretAccessKey: SECRET,
      region: "us-east-1",
      service: "service",
      date: new Date("2015-08-30T12:36:00Z"),
    });
    expect(signed.canonicalRequest).toBe(
      [
        "GET",
        "/",
        "",
        "host:example.amazonaws.com",
        "x-amz-date:20150830T123600Z",
        "",
        "host;x-amz-date",
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      ].join("\n"),
    );
    expect(signed.signature).toBe("5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31");
    expect(signed.headers.authorization).toBe(
      "AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20150830/us-east-1/service/aws4_request, SignedHeaders=host;x-amz-date, Signature=5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31",
    );
  });

  it("matches the get-vanilla-query-order-key-case test vector", () => {
    const signed = signV4({
      method: "GET",
      url: "https://example.amazonaws.com/?Param2=value2&Param1=value1",
      accessKeyId: AKID,
      secretAccessKey: SECRET,
      region: "us-east-1",
      service: "service",
      date: new Date("2015-08-30T12:36:00Z"),
    });
    expect(signed.signature).toBe("b97d918cfa904a5beff61c982a1b6f458b799221646efd99d3219ec94cdf2500");
  });
});

const zonesXml = `<?xml version="1.0"?>
<ListHostedZonesByNameResponse xmlns="https://route53.amazonaws.com/doc/2013-04-01/">
  <HostedZones>
    <HostedZone><Id>/hostedzone/ZPRIVATE</Id><Name>acme.com.</Name><Config><PrivateZone>true</PrivateZone></Config></HostedZone>
    <HostedZone><Id>/hostedzone/Z0123ABC</Id><Name>acme.com.</Name><Config><PrivateZone>false</PrivateZone></Config></HostedZone>
  </HostedZones>
  <IsTruncated>false</IsTruncated><MaxItems>20</MaxItems>
</ListHostedZonesByNameResponse>`;

const rrsetsXml = `<?xml version="1.0"?>
<ListResourceRecordSetsResponse xmlns="https://route53.amazonaws.com/doc/2013-04-01/">
  <ResourceRecordSets>
    <ResourceRecordSet><Name>acme.com.</Name><Type>A</Type><TTL>300</TTL>
      <ResourceRecords><ResourceRecord><Value>34.1.1.1</Value></ResourceRecord></ResourceRecords></ResourceRecordSet>
    <ResourceRecordSet><Name>acme.com.</Name><Type>NS</Type><TTL>172800</TTL>
      <ResourceRecords><ResourceRecord><Value>ns-1.awsdns-00.com.</Value></ResourceRecord></ResourceRecords></ResourceRecordSet>
    <ResourceRecordSet><Name>acme.com.</Name><Type>TXT</Type><TTL>3600</TTL>
      <ResourceRecords><ResourceRecord><Value>"v=spf1 -all"</Value></ResourceRecord></ResourceRecords></ResourceRecordSet>
    <ResourceRecordSet><Name>shop.acme.com.</Name><Type>A</Type><TTL>60</TTL>
      <ResourceRecords><ResourceRecord><Value>5.5.5.5</Value></ResourceRecord></ResourceRecords></ResourceRecordSet>
  </ResourceRecordSets>
  <IsTruncated>false</IsTruncated><MaxItems>300</MaxItems>
</ListResourceRecordSetsResponse>`;

describe("Route53Adapter", () => {
  it("signs requests, merges TXT, and submits one UPSERT/DELETE batch", async () => {
    const { fetch, calls } = stubFetch((c) => {
      if (c.url.includes("/hostedzonesbyname")) return { body: zonesXml };
      if (c.method === "GET" && c.url.includes("/rrset")) return { body: rrsetsXml };
      if (c.method === "POST") return { body: "<ChangeResourceRecordSetsResponse/>" };
      return undefined;
    });
    const adapter = new Route53Adapter(fetch, () => new Date("2026-01-02T03:04:05Z"));
    const res = await adapter.applyRecords({
      zone: "acme.com",
      credentials: { accessKeyId: AKID, secretAccessKey: SECRET },
      records: [
        { type: "A", name: "@", value: "76.76.21.21", ttl: 300 },
        { type: "TXT", name: "@", value: "connect-verify=abc", ttl: 300 },
        { type: "CNAME", name: "shop", value: "shops.myshopify.com", ttl: 300 },
      ],
    });
    expect(res.written).toBe(3);

    expect(calls[0]!.url).toBe(
      "https://route53.amazonaws.com/2013-04-01/hostedzonesbyname?dnsname=acme.com&maxitems=20",
    );
    expect(calls[0]!.headers["x-amz-date"]).toBe("20260102T030405Z");
    expect(calls[0]!.headers.authorization).toMatch(
      /^AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE\/20260102\/us-east-1\/route53\/aws4_request, SignedHeaders=host;x-amz-date, Signature=[0-9a-f]{64}$/,
    );
    expect(calls[1]!.url).toContain("/hostedzone/Z0123ABC/rrset?maxitems=300");

    const post = calls.find((c) => c.method === "POST")!;
    expect(post.url).toBe("https://route53.amazonaws.com/2013-04-01/hostedzone/Z0123ABC/rrset");
    expect(post.headers["content-type"]).toBe("application/xml");
    expect(post.headers.authorization).toContain("SignedHeaders=content-type;host;x-amz-date");
    const body = post.body!;
    expect(body).toContain('xmlns="https://route53.amazonaws.com/doc/2013-04-01/"');
    // A on apex replaced via UPSERT.
    expect(body).toContain(
      "<Action>UPSERT</Action><ResourceRecordSet><Name>acme.com.</Name><Type>A</Type><TTL>300</TTL><ResourceRecords><ResourceRecord><Value>76.76.21.21</Value></ResourceRecord></ResourceRecords>",
    );
    // TXT merged with existing value, quoted.
    expect(body).toContain(
      "<Type>TXT</Type><TTL>300</TTL><ResourceRecords><ResourceRecord><Value>&quot;v=spf1 -all&quot;</Value></ResourceRecord><ResourceRecord><Value>&quot;connect-verify=abc&quot;</Value></ResourceRecord></ResourceRecords>",
    );
    // Conflicting A on shop deleted exactly as it exists; CNAME upserted with trailing dot.
    expect(body).toContain(
      "<Action>DELETE</Action><ResourceRecordSet><Name>shop.acme.com.</Name><Type>A</Type><TTL>60</TTL>",
    );
    expect(body).toContain(
      "<Name>shop.acme.com.</Name><Type>CNAME</Type><TTL>300</TTL><ResourceRecords><ResourceRecord><Value>shops.myshopify.com.</Value>",
    );
    expect(body).not.toContain("<Type>NS</Type>");
  });

  it("skips the change batch when everything already matches", async () => {
    const { fetch, calls } = stubFetch((c) => {
      if (c.url.includes("/hostedzonesbyname")) return { body: zonesXml };
      if (c.method === "GET") return { body: rrsetsXml };
      return undefined;
    });
    const res = await new Route53Adapter(fetch).applyRecords({
      zone: "acme.com",
      credentials: { accessKeyId: AKID, secretAccessKey: SECRET },
      records: [{ type: "TXT", name: "@", value: "v=spf1 -all", ttl: 300 }],
    });
    expect(res.written).toBe(0);
    expect(calls.some((c) => c.method === "POST")).toBe(false);
  });

  it("reports zone_not_found when only a private zone exists", async () => {
    const xml = zonesXml.replace(/<HostedZone><Id>\/hostedzone\/Z0123ABC[\s\S]*?<\/HostedZone>/, "");
    const { fetch } = stubFetch(() => ({ body: xml }));
    await expect(
      new Route53Adapter(fetch).applyRecords({
        zone: "acme.com",
        credentials: { accessKeyId: AKID, secretAccessKey: SECRET },
        records: [{ type: "A", name: "@", value: "1.1.1.1", ttl: 300 }],
      }),
    ).rejects.toMatchObject({ code: "zone_not_found" });
  });

  it("maps AWS error codes", async () => {
    const err = (code: string, status: number) =>
      `<ErrorResponse><Error><Type>Sender</Type><Code>${code}</Code><Message>msg for ${AKID}</Message></Error></ErrorResponse>`;
    for (const [code, status, expected] of [
      ["InvalidClientTokenId", 403, "invalid_credentials"],
      ["SignatureDoesNotMatch", 403, "invalid_credentials"],
      ["AccessDenied", 403, "permission_denied"],
      ["Throttling", 400, "rate_limited"],
      ["InvalidChangeBatch", 400, "provider_error"],
    ] as const) {
      const { fetch } = stubFetch(() => ({ status, body: err(code, status) }));
      const e = await new Route53Adapter(fetch)
        .applyRecords({
          zone: "acme.com",
          credentials: { accessKeyId: AKID, secretAccessKey: SECRET },
          records: [{ type: "A", name: "@", value: "1.1.1.1", ttl: 300 }],
        })
        .catch((x: unknown) => x);
      expect(e).toMatchObject({ code: expected });
      expect((e as Error).message).not.toContain(AKID);
    }
  });
});
