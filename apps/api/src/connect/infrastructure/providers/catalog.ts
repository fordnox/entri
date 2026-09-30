import type { DnsProviderDTO, ProviderCredentialFieldDTO } from "@orbit/shared/connect";
import type {
  DnsProviderAdapter,
  ProviderCatalog,
  ProviderCatalogEntry,
} from "@/connect/domain/dns-provider.ts";
import { CloudflareAdapter } from "./cloudflare.ts";
import { DigitalOceanAdapter } from "./digitalocean.ts";
import { DnsimpleAdapter } from "./dnsimple.ts";
import { GandiAdapter } from "./gandi.ts";
import { GoDaddyAdapter } from "./godaddy.ts";
import { HetznerAdapter } from "./hetzner.ts";
import { NameComAdapter } from "./namecom.ts";
import { NamecheapAdapter } from "./namecheap.ts";
import { NetlifyAdapter } from "./netlify.ts";
import { PorkbunAdapter } from "./porkbun.ts";
import { Route53Adapter } from "./route53.ts";
import { VercelAdapter } from "./vercel.ts";

/**
 * Catalog entry with optional regex matching for providers whose
 * nameservers don't share a fixed suffix (Route 53's
 * `ns-123.awsdns-45.org`). Internal to this module; the public
 * `ProviderCatalogEntry` shape is unchanged.
 */
export interface StaticCatalogEntry extends ProviderCatalogEntry {
  nameserverPatterns?: readonly RegExp[];
}

export function normalizeNameserver(host: string): string {
  return host.trim().toLowerCase().replace(/\.+$/, "");
}

export class StaticProviderCatalog implements ProviderCatalog {
  private readonly entries: readonly StaticCatalogEntry[];
  private readonly byKey: ReadonlyMap<string, StaticCatalogEntry>;

  constructor(entries: readonly StaticCatalogEntry[]) {
    const byKey = new Map<string, StaticCatalogEntry>();
    for (const e of entries) {
      if (byKey.has(e.descriptor.key)) {
        throw new Error(`Duplicate DNS provider key: ${e.descriptor.key}`);
      }
      if (e.descriptor.automated !== Boolean(e.adapter)) {
        throw new Error(`Provider ${e.descriptor.key}: adapter must be present iff automated`);
      }
      byKey.set(e.descriptor.key, e);
    }
    this.byKey = byKey;
    this.entries = [...entries].sort((a, b) => {
      if (a.descriptor.automated !== b.descriptor.automated) {
        return a.descriptor.automated ? -1 : 1;
      }
      return a.descriptor.name.localeCompare(b.descriptor.name, "en");
    });
  }

  list(): readonly ProviderCatalogEntry[] {
    return this.entries;
  }

  get(key: string): ProviderCatalogEntry | null {
    return this.byKey.get(key) ?? null;
  }

  detect(nameservers: readonly string[]): ProviderCatalogEntry | null {
    const hosts = nameservers.map(normalizeNameserver).filter(Boolean);
    if (hosts.length === 0) return null;
    for (const entry of this.entries) {
      for (const host of hosts) {
        if (entry.nameserverSuffixes.some((s) => host === s || host.endsWith(`.${s}`))) {
          return entry;
        }
        if (entry.nameserverPatterns?.some((re) => re.test(host))) return entry;
      }
    }
    return null;
  }
}

// ── Definitions ──────────────────────────────────────────────────────────

function field(
  key: string,
  label: string,
  secret: boolean,
  extra: { placeholder?: string; help?: string } = {},
): ProviderCredentialFieldDTO {
  return { key, label, secret, ...extra };
}

function automated(
  key: string,
  name: string,
  adapter: DnsProviderAdapter,
  credentialFields: ProviderCredentialFieldDTO[],
  credentialsUrl: string,
  dnsPanelUrl: string,
  nameserverSuffixes: string[],
  nameserverPatterns?: RegExp[],
): StaticCatalogEntry {
  const descriptor: DnsProviderDTO = {
    key,
    name,
    automated: true,
    credentialFields,
    credentialsUrl,
    dnsPanelUrl,
  };
  return { descriptor, nameserverSuffixes, nameserverPatterns, adapter };
}

function manual(
  key: string,
  name: string,
  dnsPanelUrl: string | null,
  nameserverSuffixes: string[],
  nameserverPatterns?: RegExp[],
): StaticCatalogEntry {
  return {
    descriptor: {
      key,
      name,
      automated: false,
      credentialFields: [],
      credentialsUrl: null,
      dnsPanelUrl,
    },
    nameserverSuffixes,
    nameserverPatterns,
  };
}

/** `ns-1234.awsdns-56.com` / `.net` / `.org` / `.co.uk` */
export const ROUTE53_NS_PATTERN = /^ns-\d+\.awsdns-\d+\.(com|net|org|co\.uk)$/;

export function buildDefaultProviderEntries(
  fetchImpl: typeof fetch = fetch,
): StaticCatalogEntry[] {
  return [
    // ── Automated ──────────────────────────────────────────────────────
    automated(
      "cloudflare",
      "Cloudflare",
      new CloudflareAdapter(fetchImpl),
      [
        field("apiToken", "API token", true, {
          placeholder: "e.g. 3xAmPl3t0k3n…",
          help: 'Create a token with the "Edit zone DNS" template, scoped to this zone.',
        }),
      ],
      "https://dash.cloudflare.com/profile/api-tokens",
      "https://dash.cloudflare.com/",
      ["ns.cloudflare.com", "foundationdns.com", "foundationdns.net", "foundationdns.org"],
    ),
    automated(
      "godaddy",
      "GoDaddy",
      new GoDaddyAdapter(fetchImpl),
      [
        field("apiKey", "API key", false, {
          placeholder: "dLP4…",
          help: 'Create a "Production" key at developer.godaddy.com. GoDaddy only grants DNS API access to eligible accounts.',
        }),
        field("apiSecret", "API secret", true, { help: "Shown once, next to the key." }),
      ],
      "https://developer.godaddy.com/keys",
      "https://dcc.godaddy.com/control/portfolio",
      ["domaincontrol.com", "secureserver.net"],
    ),
    automated(
      "digitalocean",
      "DigitalOcean",
      new DigitalOceanAdapter(fetchImpl),
      [
        field("apiToken", "Personal access token", true, {
          placeholder: "dop_v1_…",
          help: "Generate a token with write access (or the domain:create/update/delete scopes).",
        }),
      ],
      "https://cloud.digitalocean.com/account/api/tokens",
      "https://cloud.digitalocean.com/networking/domains",
      ["digitalocean.com"],
    ),
    automated(
      "porkbun",
      "Porkbun",
      new PorkbunAdapter(fetchImpl),
      [
        field("apiKey", "API key", false, { placeholder: "pk1_…" }),
        field("secretApiKey", "Secret API key", true, {
          placeholder: "sk1_…",
          help: 'Also switch on "API Access" for this domain in Domain Management.',
        }),
      ],
      "https://porkbun.com/account/api",
      "https://porkbun.com/account/domainsSpeedy",
      ["porkbun.com"],
    ),
    automated(
      "vercel",
      "Vercel",
      new VercelAdapter(fetchImpl),
      [
        field("apiToken", "Access token", true, {
          help: "Create a token scoped to the team that owns this domain.",
        }),
        field("teamId", "Team ID (optional)", false, {
          placeholder: "team_…",
          help: "Required when the domain belongs to a team rather than your personal account. Found under Team Settings → General.",
        }),
      ],
      "https://vercel.com/account/tokens",
      "https://vercel.com/dashboard/domains",
      ["vercel-dns.com"],
    ),
    automated(
      "hetzner",
      "Hetzner",
      new HetznerAdapter(fetchImpl),
      [
        field("apiToken", "API token", true, {
          help: "In Hetzner Console, open the project that holds this DNS zone → Security → API tokens, and create a Read & Write token.",
        }),
      ],
      "https://console.hetzner.com/projects",
      "https://console.hetzner.com/projects",
      ["ns.hetzner.com", "ns.hetzner.de", "first-ns.de", "second-ns.de", "second-ns.com"],
    ),
    automated(
      "namecheap",
      "Namecheap",
      new NamecheapAdapter(fetchImpl),
      [
        field("apiUser", "API user", false, { help: "Usually the same as your Namecheap username." }),
        field("apiKey", "API key", true, {
          help: "Profile → Tools → Namecheap API Access. API access must be enabled on your account.",
        }),
        field("username", "Username", false, { help: "The Namecheap account that owns the domain." }),
        field("clientIp", "Whitelisted IP", false, {
          placeholder: "203.0.113.10",
          help: "An IP address whitelisted under API Access. Requests are only accepted from whitelisted IPs.",
        }),
      ],
      "https://ap.www.namecheap.com/settings/tools/apiaccess/",
      "https://ap.www.namecheap.com/domains/list/",
      ["registrar-servers.com"],
    ),
    automated(
      "route53",
      "Amazon Route 53",
      new Route53Adapter(fetchImpl),
      [
        field("accessKeyId", "Access key ID", false, {
          placeholder: "AKIA…",
          help: "Use an IAM user limited to route53:ListHostedZonesByName, ListResourceRecordSets and ChangeResourceRecordSets.",
        }),
        field("secretAccessKey", "Secret access key", true),
      ],
      "https://console.aws.amazon.com/iam/home#/security_credentials",
      "https://console.aws.amazon.com/route53/v2/hostedzones",
      [],
      [ROUTE53_NS_PATTERN],
    ),
    automated(
      "gandi",
      "Gandi",
      new GandiAdapter(fetchImpl),
      [
        field("apiToken", "Personal access token", true, {
          help: 'Create a token with the "Manage domain name technical configurations" permission.',
        }),
      ],
      "https://admin.gandi.net/organizations/account/pat",
      "https://admin.gandi.net/domain/",
      ["gandi.net"],
    ),
    automated(
      "dnsimple",
      "DNSimple",
      new DnsimpleAdapter(fetchImpl),
      [
        field("apiToken", "Access token", true, { help: "Account → Access Tokens → New access token." }),
        field("accountId", "Account ID", false, {
          placeholder: "12345",
          help: "The number in your dashboard URL: dnsimple.com/a/<account id>/…",
        }),
      ],
      "https://dnsimple.com/user",
      "https://dnsimple.com/dashboard",
      ["dnsimple.com", "dnsimple-edge.net", "dnsimple-edge.org"],
    ),
    automated(
      "namecom",
      "Name.com",
      new NameComAdapter(fetchImpl),
      [
        field("username", "Username", false),
        field("apiToken", "API token", true, {
          help: "Account → Settings → Security → API Token. Accounts with two-step verification must allow API access.",
        }),
      ],
      "https://www.name.com/account/settings/api",
      "https://www.name.com/account/domain",
      ["name.com"],
    ),
    automated(
      "netlify",
      "Netlify",
      new NetlifyAdapter(fetchImpl),
      [
        field("apiToken", "Personal access token", true, {
          help: "User settings → Applications → Personal access tokens.",
        }),
      ],
      "https://app.netlify.com/user/applications#personal-access-tokens",
      "https://app.netlify.com/teams/-/dns",
      [],
      // Netlify DNS is served on NS1 infrastructure: dns1.p01.nsone.net … dns4.p09.nsone.net.
      [/^dns[1-4]\.p\d{2}\.nsone\.net$/],
    ),

    // ── Manual only ────────────────────────────────────────────────────
    manual("akamai", "Akamai Edge DNS", "https://control.akamai.com/", ["akam.net"]),
    manual("alibaba", "Alibaba Cloud DNS", "https://dns.console.aliyun.com/", ["hichina.com", "alidns.com"]),
    manual("a2hosting", "A2 Hosting", "https://my.a2hosting.com/", ["a2hosting.com"]),
    manual("aruba", "Aruba.it", "https://admin.aruba.it/", ["technorail.com"]),
    manual("azure", "Azure DNS", "https://portal.azure.com/#browse/Microsoft.Network%2FdnsZones", [
      "azure-dns.com",
      "azure-dns.net",
      "azure-dns.org",
      "azure-dns.info",
    ]),
    manual("bluehost", "Bluehost", "https://my.bluehost.com/", ["bluehost.com"]),
    manual("bunny", "Bunny DNS", "https://dash.bunny.net/dns", ["bunny.net"]),
    manual("cloudns", "ClouDNS", "https://www.cloudns.net/main/", ["cloudns.net"]),
    manual("constellix", "Constellix", "https://manage.constellix.com/", ["constellix.com", "constellix.net"]),
    manual("contabo", "Contabo", "https://my.contabo.com/dns", ["contabo.net"]),
    manual("desec", "deSEC", "https://desec.io/domains", ["desec.io", "desec.org"]),
    manual("dnsmadeeasy", "DNS Made Easy", "https://cp.dnsmadeeasy.com/", ["dnsmadeeasy.com"]),
    manual("dnspod", "DNSPod (Tencent Cloud)", "https://console.dnspod.com/", ["dnspod.net", "dnspod.com"]),
    manual("domaincom", "Domain.com", "https://www.domain.com/", ["domain.com"]),
    manual("dreamhost", "DreamHost", "https://panel.dreamhost.com/", ["dreamhost.com"]),
    manual("dynadot", "Dynadot", "https://www.dynadot.com/account/domain/name/list.html", ["dyna-ns.net"]),
    manual("easydns", "easyDNS", "https://cp.easydns.com/", [
      "easydns.com",
      "easydns.net",
      "easydns.org",
      "easydns.info",
    ]),
    manual("enom", "Enom", "https://www.enom.com/", ["name-services.com"]),
    manual("epik", "Epik", "https://registrar.epik.com/", ["epik.com"]),
    manual("freedns", "FreeDNS (afraid.org)", "https://freedns.afraid.org/", ["afraid.org"]),
    manual("gcore", "Gcore DNS", "https://dns.gcore.com/", ["gcorelabs.net", "gcdn.services"]),
    manual("gname", "Gname", "https://www.gname.com/", ["gname-dns.com"]),
    // Cloud DNS serves from ns-cloud-*.googledomains.com, which is
    // indistinguishable from (ex-Google Domains) Squarespace domains —
    // those far outnumber Cloud DNS zones, so Squarespace claims the suffix.
    manual("googlecloud", "Google Cloud DNS", "https://console.cloud.google.com/net-services/dns/zones", []),
    manual("hostgator", "HostGator", "https://portal.hostgator.com/", ["hostgator.com", "websitewelcome.com"]),
    manual("hostinger", "Hostinger", "https://hpanel.hostinger.com/domains", ["dns-parking.com"]),
    manual("hover", "Hover", "https://www.hover.com/control_panel", ["hover.com"]),
    manual("hurricane", "Hurricane Electric", "https://dns.he.net/", ["he.net"]),
    manual("infomaniak", "Infomaniak", "https://manager.infomaniak.com/", ["infomaniak.ch"]),
    manual("inmotion", "InMotion Hosting", "https://secure1.inmotionhosting.com/amp", ["inmotionhosting.com"]),
    manual("inwx", "INWX", "https://www.inwx.com/en/domain", ["inwx.de", "inwx.eu", "inwx.net"]),
    manual("ionos", "IONOS (1&1)", "https://my.ionos.com/domains", [
      "ui-dns.com",
      "ui-dns.de",
      "ui-dns.org",
      "ui-dns.biz",
    ]),
    manual("joker", "Joker.com", "https://joker.com/", ["ns.joker.com"]),
    manual("linode", "Linode (Akamai Cloud)", "https://cloud.linode.com/domains", ["linode.com"]),
    manual("liquidweb", "Liquid Web", "https://my.liquidweb.com/", ["liquidweb.com"]),
    manual("loopia", "Loopia", "https://customerzone.loopia.com/", ["loopia.se"]),
    manual("microsoft365", "Microsoft 365", "https://admin.microsoft.com/#/Domains", ["bdm.microsoftonline.com"]),
    manual("namebright", "NameBright", "https://www.namebright.com/", ["namebrightdns.com"]),
    manual("namesilo", "NameSilo", "https://www.namesilo.com/account_domains.php", ["dnsowl.com"]),
    manual("networksolutions", "Network Solutions", "https://www.networksolutions.com/my-account/", ["worldnic.com"]),
    manual("njalla", "Njalla", "https://njal.la/domains/", ["njal.la"]),
    // NS1-hosted zones share Netlify's nsone.net pattern; anything not
    // matching Netlify's `dnsN.pNN` shape falls through to here.
    manual("ns1", "IBM NS1 Connect", "https://my.nsone.net/", ["nsone.net"]),
    manual("one", "one.com", "https://www.one.com/admin/", ["one.com"]),
    manual("opensrs", "OpenSRS (Tucows)", "https://manage.opensrs.com/", ["opensrs.net"]),
    manual("oracle", "Oracle Cloud DNS", "https://cloud.oracle.com/dns", ["dns.oraclecloud.net"]),
    manual("ovh", "OVHcloud", "https://www.ovh.com/manager/", ["ovh.net", "ovh.ca", "anycast.me"]),
    manual("rackspace", "Rackspace", "https://login.rackspace.com/", ["stabletransit.com"]),
    manual("registercom", "Register.com", "https://www.register.com/myaccount/", ["register.com"]),
    manual("sav", "Sav", "https://www.sav.com/domains", ["sav.com"]),
    manual("scaleway", "Scaleway", "https://console.scaleway.com/domains", ["dom.scw.cloud"]),
    manual("siteground", "SiteGround", "https://my.siteground.com/", ["siteground.net"]),
    manual("spaceship", "Spaceship", "https://www.spaceship.com/application/domain-list-application/", [
      "spaceship.net",
    ]),
    manual("squarespace", "Squarespace Domains", "https://account.squarespace.com/domains", [
      "squarespacedns.com",
      "googledomains.com",
      "systemdns.com",
    ]),
    manual("strato", "STRATO", "https://www.strato.de/apps/CustomerService", ["rzone.de"]),
    manual("transip", "TransIP", "https://www.transip.nl/cp/", ["transip.net", "transip.nl", "transip.eu"]),
    manual("ultradns", "UltraDNS", "https://portal.ultradns.com/", [
      "ultradns.com",
      "ultradns.net",
      "ultradns.org",
      "ultradns.biz",
    ]),
    manual("vultr", "Vultr", "https://my.vultr.com/dns/", ["vultr.com"]),
    manual("wix", "Wix", "https://manage.wix.com/account/domains", ["wixdns.net"]),
    manual("wordpress", "WordPress.com", "https://wordpress.com/domains/manage", ["wordpress.com"]),
    manual("yandex", "Yandex 360", "https://admin.yandex.ru/domains", ["yandex.net"]),
  ];
}

export function buildDefaultProviderCatalog(fetchImpl: typeof fetch = fetch): ProviderCatalog {
  return new StaticProviderCatalog(buildDefaultProviderEntries(fetchImpl));
}
