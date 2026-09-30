import type {
  ConnectApplicationDTO,
  ConnectApplicationPublicDTO,
  DnsProviderDTO,
  DomainConnectionDTO,
  WebhookDeliveryDTO,
} from "@orbit/shared/connect";
import type { ConnectApplication } from "../domain/application.ts";
import type { ProviderCatalog } from "../domain/dns-provider.ts";
import type { DomainConnectionSnapshot } from "../domain/domain-connection.ts";
import type { WebhookDelivery } from "../domain/webhook-delivery.ts";

/**
 * DTO mapping lives with the context (rather than `interfaces/mappers.ts`)
 * because webhook payloads embed `DomainConnectionDTO` and are built in
 * the application layer.
 */

export function applicationToDTO(app: ConnectApplication, domainCount: number): ConnectApplicationDTO {
  return {
    id: app.id,
    name: app.name,
    iconUrl: app.iconUrl,
    secretPreview: `…${app.secretPreview}`,
    secretRotatedAt: app.secretRotatedAt.toISOString(),
    allowedOrigins: [...app.allowedOrigins],
    webhookUrl: app.webhookUrl,
    webhookSigningSecret: app.webhookSecret,
    domainCount,
    createdAt: app.createdAt.toISOString(),
    updatedAt: app.updatedAt.toISOString(),
  };
}

export function applicationToPublicDTO(app: ConnectApplication): ConnectApplicationPublicDTO {
  return { applicationId: app.id, name: app.name, iconUrl: app.iconUrl };
}

export function providerToDTO(catalog: ProviderCatalog, key: string | null): DnsProviderDTO | null {
  if (!key) return null;
  return catalog.get(key)?.descriptor ?? null;
}

export function connectionToDTO(
  s: DomainConnectionSnapshot,
  catalog: ProviderCatalog,
): DomainConnectionDTO {
  return {
    id: s.id,
    applicationId: s.applicationId,
    domain: s.domain,
    rootDomain: s.rootDomain,
    subdomain: s.subdomain,
    userId: s.userId,
    metadata: s.metadata,
    provider: providerToDTO(catalog, s.providerKey),
    setupMethod: s.setupMethod,
    status: s.status,
    records: s.records.map((r) => ({
      type: r.type,
      host: r.host,
      fqdn: r.fqdn,
      value: r.value,
      ttl: r.ttl,
      ...(r.priority !== undefined ? { priority: r.priority } : {}),
      status: r.status,
      observed: [...r.observed],
    })),
    lastError: s.lastError,
    lastCheckedAt: s.lastCheckedAt?.toISOString() ?? null,
    connectedAt: s.connectedAt?.toISOString() ?? null,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

export function deliveryToDTO(d: WebhookDelivery): WebhookDeliveryDTO {
  const p = d.props();
  return {
    id: p.id,
    applicationId: p.applicationId,
    connectionId: p.connectionId,
    eventType: p.eventType,
    url: p.url,
    status: p.status,
    attempts: p.attempts,
    lastStatusCode: p.lastStatusCode,
    lastError: p.lastError,
    payload: p.payload,
    createdAt: p.createdAt.toISOString(),
    deliveredAt: p.deliveredAt?.toISOString() ?? null,
  };
}
