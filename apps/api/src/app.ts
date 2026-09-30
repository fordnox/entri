import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Hono } from "hono";
import type { Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { evlog } from "evlog/hono";
import { buildContainer, readConfig, type AppContainer } from "./composition.ts";
import { injectContainer, type HonoEnv } from "./interfaces/http/middleware/container.ts";
import { errorMapper } from "./interfaces/http/middleware/error-mapper.ts";
import { session } from "./interfaces/http/middleware/session.ts";
import { buildRouter } from "./interfaces/http/router.ts";
import { expandLoopbackOrigins } from "./kernel/dev-origins.ts";
import { health } from "./routes/health.ts";

export interface CreatedApp {
  app: Hono<HonoEnv>;
  container: AppContainer;
}

export function createApp(container: AppContainer = buildContainer(readConfig())): CreatedApp {
  const app = new Hono<HonoEnv>();

  // evlog replaces hono/logger: emits one wide event per request with method,
  // path, status, duration plus anything handlers attach via log.set(). We
  // exclude the health probe so it doesn't drown out real traffic.
  app.use(
    "*",
    evlog({
      exclude: ["/health", "/health/**"],
      keep: (ctx) => {
        // Always keep slow or failing requests even if head sampling trims
        // info logs in the future.
        if (ctx.status && ctx.status >= 400) ctx.shouldKeep = true;
        if (ctx.duration && ctx.duration > 1000) ctx.shouldKeep = true;
      },
    }),
  );
  // The Connect SDK runs on integrators' sites, so its API is open to any
  // origin — but without credentials, so cookies never ride along.
  // Per-application origin allow-lists are enforced on the token.
  const connectCors = cors({
    origin: "*",
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["authorization", "content-type"],
    maxAge: 600,
  });
  const appCors = cors({
    origin: expandLoopbackOrigins([
      container.config.webOrigin,
      container.config.wwwOrigin,
      ...container.config.additionalOrigins,
    ]),
    credentials: true,
  });
  app.use("*", (c, next) =>
    c.req.path.startsWith("/v1/connect/") || c.req.path.startsWith("/sdk/")
      ? connectCors(c, next)
      : appCors(c, next),
  );
  app.use("*", injectContainer(container));

  // 8 KiB cap mounted BEFORE the rate-limiter — the limiter awaits
  // `c.req.raw.json()` to read `email`, which without a cap lets a slow
  // or oversized body park a worker and OOM via ERR_STRING_TOO_LONG.
  const authBodyLimit = bodyLimit({
    maxSize: 8 * 1024,
    onError: (c) =>
      c.json(
        { error: { code: "payload_too_large", message: "request body too large" } },
        413,
      ),
  });
  app.use("/v1/auth/*", authBodyLimit);


  app.on(["POST", "GET", "OPTIONS"], "/v1/auth/*", async (c) => {
    const res = await container.auth.handler(c.req.raw);
    // +feature:auth-admin
    // The better-auth admin plugin rejects banned accounts with a 403
    // `BANNED_USER` JSON body. For GET endpoints (most importantly
    // magic-link verify, which is hit directly from the user's email
    // client and doesn't honour `onAPIError.errorURL`) that JSON lands
    // raw in the browser. Convert it to a redirect to the soft-landing
    // page so the dead-end stays in the web app.
    if (c.req.method === "GET" && res.status === 403) {
      const body = await res.clone().text();
      if (body.includes("BANNED_USER")) {
        return c.redirect(`${container.config.webOrigin}/banned`, 302);
      }
    }
    // -feature:auth-admin
    return res;
  });
  app.use("/v1/*", session());

  app.onError(errorMapper);

  app.route("/health", health);
  app.route("/v1", buildRouter());

  app.get("/sdk/connect.js", async (c) => {
    let bundle: string;
    try {
      bundle = await readFile(container.config.connect.sdkBundlePath, "utf8");
    } catch {
      return c.text("// Connect SDK not built — run `npm run build --workspace @orbit/connect-js`", 404);
    }
    return c.body(bundle, 200, {
      "content-type": "application/javascript; charset=utf-8",
      "cache-control": "public, max-age=300",
    });
  });

  app.get("/", (c) => c.json({ name: "@orbit/api", ok: true }));

  return { app, container };
}

export type AppType = ReturnType<typeof createApp>["app"];
