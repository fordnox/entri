#!/usr/bin/env node
// Forwards webhooks from smee.io channels to local services during
// development. Supports multiple independent tunnels in one process:
//
//   - API webhook tunnel     (billing adapters: Stripe / Polar / Dodo)
//   - Platform webhook tunnel (internal/platform: Polar order events)
//
// Each tunnel reads its own SMEE_URL / TARGET_PATH / ORIGIN from the
// relevant .env file:
//
//   - apps/api/.env           -> SMEE_URL, SMEE_TARGET_PATH, API_ORIGIN
//   - internal/platform/.env  -> PLATFORM_SMEE_URL, PLATFORM_TARGET_PATH,
//                                PLATFORM_ORIGIN (falls back to PORT)
//
// Tunnels with no SMEE_URL set are skipped with a one-line notice so
// contributors who only need one path aren't blocked by the other.

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

function loadEnv(path) {
  if (!existsSync(path)) return;
  const raw = readFileSync(path, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
  }
}

loadEnv(resolve(here, "../api/.env"));
loadEnv(resolve(here, "../../internal/platform/.env"));

const { default: SmeeClient } = await import("smee-client");

function startTunnel({ label, smeeUrl, origin, targetPath, defaultTarget }) {
  if (!smeeUrl) {
    console.log(
      `[webhook-tunnel:${label}] SMEE_URL not set; skipping. ` +
        `Set it to enable forwarding to ${defaultTarget}.`,
    );
    return;
  }
  const base = (origin ?? "").replace(/\/$/, "");
  const path = targetPath.startsWith("/") ? targetPath : `/${targetPath}`;
  const target = `${base}${path}`;
  const client = new SmeeClient({
    source: smeeUrl,
    target,
    logger: {
      info: (...args) => console.log(`[webhook-tunnel:${label}]`, ...args),
      error: (...args) => console.error(`[webhook-tunnel:${label}]`, ...args),
    },
  });
  client.start();
  console.log(`[webhook-tunnel:${label}] forwarding ${smeeUrl} -> ${target}`);
}

// --- API: billing webhooks (Stripe / Polar / Dodo adapters) ---
startTunnel({
  label: "api",
  smeeUrl: process.env.SMEE_URL,
  origin: process.env.API_ORIGIN ?? "http://localhost:4002",
  targetPath:
    process.env.SMEE_TARGET_PATH ?? "/v1/billing/webhooks/stripe",
  defaultTarget: "http://localhost:4002/v1/billing/webhooks/stripe",
});

// --- Platform: Polar order events (internal/platform) ---
const platformPort = process.env.PLATFORM_PORT ?? process.env.PORT ?? "4100";
startTunnel({
  label: "platform",
  smeeUrl: process.env.PLATFORM_SMEE_URL,
  origin: process.env.PLATFORM_ORIGIN ?? `http://localhost:${platformPort}`,
  targetPath: process.env.PLATFORM_TARGET_PATH ?? "/v1/webhooks/polar",
  defaultTarget: `http://localhost:${platformPort}/v1/webhooks/polar`,
});
