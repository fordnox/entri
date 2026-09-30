/**
 * Connect — end users connect their own domain to an integrator's app.
 * See `docs/connect.md` for the product and wire contract.
 *
 * Env:
 *   - `CONNECT_DNS_RESOLVERS` — comma-separated resolver IPs used for
 *     detection and verification (default `1.1.1.1,8.8.8.8`).
 *   - `CONNECT_SANDBOX` — `true`/`false`; enables the fake `*.test` DNS
 *     provider. Defaults to on outside production.
 *   - `CONNECT_SDK_PATH` — built SDK bundle served at `/sdk/connect.js`
 *     (default: `packages/connect-js/dist/connect.js` in the monorepo).
 */
import { fileURLToPath } from "node:url";
import type { FeatureCore, FeatureModule } from "@/kernel/feature.ts";
import { AutomateConfigurationService } from "./application/automate-configuration.service.ts";
import { CheckDomainService } from "./application/check-domain.service.ts";
import { CreateApplicationService } from "./application/create-application.service.ts";
import { CreateConfigurationService } from "./application/create-configuration.service.ts";
import { DeleteApplicationService } from "./application/delete-application.service.ts";
import { DeleteDomainConnectionService } from "./application/delete-domain-connection.service.ts";
import { ListApplicationsService } from "./application/list-applications.service.ts";
import { ListDomainConnectionsService } from "./application/list-domain-connections.service.ts";
import { MarkManualSetupService } from "./application/mark-manual-setup.service.ts";
import type { DnsLookup } from "./application/ports.ts";
import { RotateApplicationSecretService } from "./application/rotate-application-secret.service.ts";
import { RotateWebhookSecretService } from "./application/rotate-webhook-secret.service.ts";
import { SdkAuthService } from "./application/sdk-auth.service.ts";
import { SdkTokenSigner } from "./application/sdk-token.ts";
import { UpdateApplicationService } from "./application/update-application.service.ts";
import { VerifyConfigurationService } from "./application/verify-configuration.service.ts";
import { ConnectWebhookDispatcher } from "./application/webhook-dispatcher.ts";
import type { ProviderCatalog } from "./domain/dns-provider.ts";
import { FetchWebhookSender } from "./infrastructure/fetch-webhook-sender.ts";
import { NodeDnsLookup } from "./infrastructure/node-dns-lookup.ts";
import { buildDefaultProviderCatalog } from "./infrastructure/providers/index.ts";
import {
  SandboxAwareCatalog,
  SandboxAwareDnsLookup,
  SandboxDns,
} from "./infrastructure/sandbox-dns.ts";

export interface ConnectConfig {
  production: boolean;
  dnsResolvers: string[];
  sandbox: boolean;
  sdkBundlePath: string;
}

export function readConnectConfig(env: NodeJS.ProcessEnv = process.env): ConnectConfig {
  const production = (env.NODE_ENV ?? "development") === "production";
  const sandboxRaw = env.CONNECT_SANDBOX?.trim().toLowerCase();
  return {
    production,
    dnsResolvers: (env.CONNECT_DNS_RESOLVERS ?? "1.1.1.1,8.8.8.8")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    sandbox: sandboxRaw ? /^(1|true|yes|on)$/.test(sandboxRaw) : !production,
    sdkBundlePath:
      env.CONNECT_SDK_PATH?.trim() ||
      fileURLToPath(new URL("../../../../packages/connect-js/dist/connect.js", import.meta.url)),
  };
}

export interface ConnectServices {
  connectCatalog: ProviderCatalog;
  connectSdkAuth: SdkAuthService;
  connectWebhooks: ConnectWebhookDispatcher;
  createConnectApplication: CreateApplicationService;
  updateConnectApplication: UpdateApplicationService;
  rotateConnectApplicationSecret: RotateApplicationSecretService;
  rotateConnectWebhookSecret: RotateWebhookSecretService;
  deleteConnectApplication: DeleteApplicationService;
  listConnectApplications: ListApplicationsService;
  checkDomain: CheckDomainService;
  createDomainConfiguration: CreateConfigurationService;
  automateDomainConfiguration: AutomateConfigurationService;
  markManualDomainSetup: MarkManualSetupService;
  verifyDomainConfiguration: VerifyConfigurationService;
  listDomainConnections: ListDomainConnectionsService;
  deleteDomainConnection: DeleteDomainConnectionService;
}

export const connectFeature: FeatureModule<ConnectServices> = {
  name: "connect",
  services: (core: FeatureCore) => {
    const cfg = core.config.connect;
    let catalog: ProviderCatalog = buildDefaultProviderCatalog();
    let dns: DnsLookup = new NodeDnsLookup(cfg.dnsResolvers);
    let sandbox: SandboxDns | null = null;
    if (cfg.sandbox) {
      sandbox = new SandboxDns();
      catalog = new SandboxAwareCatalog(catalog, sandbox);
      dns = new SandboxAwareDnsLookup(dns, sandbox);
    }
    const signer = new SdkTokenSigner(core.config.authSecret, core.clock);
    const policy = { production: cfg.production };
    return {
      connectCatalog: catalog,
      connectSdkAuth: new SdkAuthService(core.uow, signer),
      connectWebhooks: new ConnectWebhookDispatcher(
        core.bus,
        core.uow,
        core.clock,
        new FetchWebhookSender({ blockPrivateNetworks: cfg.production }),
        catalog,
      ),
      createConnectApplication: new CreateApplicationService(core.uow, core.clock, policy),
      updateConnectApplication: new UpdateApplicationService(core.uow, core.clock, policy),
      rotateConnectApplicationSecret: new RotateApplicationSecretService(core.uow, core.clock),
      rotateConnectWebhookSecret: new RotateWebhookSecretService(core.uow, core.clock),
      deleteConnectApplication: new DeleteApplicationService(core.uow, core.clock),
      listConnectApplications: new ListApplicationsService(core.uow),
      checkDomain: new CheckDomainService(dns, catalog),
      createDomainConfiguration: new CreateConfigurationService(core.uow, core.clock, dns, catalog),
      automateDomainConfiguration: new AutomateConfigurationService(core.uow, core.clock, catalog),
      markManualDomainSetup: new MarkManualSetupService(
        core.uow,
        core.clock,
        sandbox ? (conn) => sandbox.simulateManualEntry(conn) : undefined,
      ),
      verifyDomainConfiguration: new VerifyConfigurationService(core.uow, core.clock, dns),
      listDomainConnections: new ListDomainConnectionsService(core.uow),
      deleteDomainConnection: new DeleteDomainConnectionService(core.uow, core.clock),
    };
  },
};
