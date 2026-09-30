import type { Context } from "hono";
import { Hono } from "hono";
import {
  applicationToPublicDTO,
  connectionToDTO,
} from "@/connect/application/dto.ts";
import { InvalidSdkTokenError } from "@/connect/application/sdk-token.ts";
import type { ConnectApplication } from "@/connect/domain/application.ts";
import type { DomainConnection } from "@/connect/domain/domain-connection.ts";
import type { HonoEnv } from "../middleware/container.ts";
import {
  automateConfigurationSchema,
  checkDomainSchema,
  createConfigurationSchema,
  issueTokenSchema,
} from "../schemas.ts";

/**
 * Public, SDK-facing Connect API. Mounted at `/v1/connect` with its own
 * wildcard CORS (no credentials) in `app.ts` — the modal runs on
 * integrators' origins, and auth is the Bearer token, never a cookie.
 */
export const connectPublic = new Hono<HonoEnv>();

async function authenticate(c: Context<HonoEnv>): Promise<ConnectApplication> {
  const header = c.req.header("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) {
    throw new InvalidSdkTokenError("token.invalid", "missing Authorization: Bearer <token>");
  }
  const app = await c.get("container").services.connectSdkAuth.authenticate(
    match[1]!.trim(),
    c.req.header("origin") ?? null,
  );
  c.get("log")?.set({ connect: { applicationId: app.id } });
  return app;
}

function toDTO(c: Context<HonoEnv>, conn: DomainConnection) {
  return connectionToDTO(conn.snapshot(), c.get("container").services.connectCatalog);
}

connectPublic.post("/token", async (c) => {
  const body = issueTokenSchema.parse(await c.req.json());
  const { token, expiresIn } = await c
    .get("container")
    .services.connectSdkAuth.issueWithSecret(body.applicationId, body.secret);
  c.get("log")?.set({ action: "connect.token.issue", connect: { applicationId: body.applicationId } });
  return c.json({ auth_token: token, expires_in: expiresIn });
});

connectPublic.get("/providers", (c) => {
  const catalog = c.get("container").services.connectCatalog;
  return c.json(catalog.list().map((e) => e.descriptor));
});

connectPublic.get("/application", async (c) => {
  const app = await authenticate(c);
  return c.json(applicationToPublicDTO(app));
});

connectPublic.post("/domains/check", async (c) => {
  await authenticate(c);
  const body = checkDomainSchema.parse(await c.req.json());
  return c.json(await c.get("container").services.checkDomain.execute(body.domain));
});

connectPublic.post("/configurations", async (c) => {
  const application = await authenticate(c);
  const body = createConfigurationSchema.parse(await c.req.json());
  const conn = await c.get("container").services.createDomainConfiguration.execute({
    application,
    domain: body.domain,
    dnsRecords: body.dnsRecords as never,
    userId: body.userId,
    metadata: body.metadata,
  });
  c.get("log")?.set({
    action: "connect.configuration.create",
    connect: { connectionId: conn.id, provider: conn.providerKey },
  });
  return c.json(toDTO(c, conn), 201);
});

connectPublic.get("/configurations/:id", async (c) => {
  const app = await authenticate(c);
  const { connection } = await c
    .get("container")
    .services.listDomainConnections.get({ applicationId: app.id }, c.req.param("id"));
  return c.json(toDTO(c, connection));
});

connectPublic.post("/configurations/:id/automate", async (c) => {
  const app = await authenticate(c);
  const body = automateConfigurationSchema.parse(await c.req.json());
  const conn = await c.get("container").services.automateDomainConfiguration.execute({
    applicationId: app.id,
    connectionId: c.req.param("id"),
    credentials: body.credentials,
  });
  c.get("log")?.set({ action: "connect.configuration.automate", connect: { connectionId: conn.id } });
  return c.json(toDTO(c, conn));
});

connectPublic.post("/configurations/:id/manual", async (c) => {
  const app = await authenticate(c);
  const conn = await c.get("container").services.markManualDomainSetup.execute({
    applicationId: app.id,
    connectionId: c.req.param("id"),
  });
  return c.json(toDTO(c, conn));
});

connectPublic.post("/configurations/:id/verify", async (c) => {
  const app = await authenticate(c);
  const conn = await c
    .get("container")
    .services.verifyDomainConfiguration.execute({ applicationId: app.id }, c.req.param("id"));
  return c.json(toDTO(c, conn));
});
