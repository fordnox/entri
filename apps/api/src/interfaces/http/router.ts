import { Hono } from "hono";
import { me } from "./controllers/auth.controller.ts";
import { mePreferences } from "./controllers/me.preferences.controller.ts";
import { meAccount } from "./controllers/me.account.controller.ts";
import { config } from "./controllers/config.controller.ts";
import { dev } from "./controllers/dev.controller.ts";
import { invites } from "./controllers/invites.controller.ts";
import { workspaces } from "./controllers/workspaces.controller.ts";
import { connectPublic } from "./controllers/connect.controller.ts";
import { connectDashboard } from "./controllers/connect-dashboard.controller.ts";
// +feature:billing
import { billing, billingWebhooks } from "./controllers/billing.controller.ts";
// -feature:billing
// +feature:uploads
import { uploads } from "./controllers/uploads.controller.ts";
// -feature:uploads
// +feature:audit-log
import {
  appAudit,
  workspaceAudit,
} from "./controllers/audit.controller.ts";
// -feature:audit-log
import type { HonoEnv } from "./middleware/container.ts";

export function buildRouter(): Hono<HonoEnv> {
  const v1 = new Hono<HonoEnv>();
  v1.route("/config", config);
  v1.route("/dev", dev);
  v1.route("/me", me);
  v1.route("/me/preferences", mePreferences);
  v1.route("/me", meAccount);
  v1.route("/invites", invites);
  v1.route("/workspaces", workspaces);
  v1.route("/workspaces", connectDashboard);
  // SDK-facing: Bearer-token auth, wildcard CORS (see app.ts).
  v1.route("/connect", connectPublic);
  // +feature:billing
  v1.route("/workspaces", billing);
  // Provider webhooks live at the top level. These are authenticated
  // by signature (inside the controller), not cookies, so they
  // bypass the session middleware by mounting outside `/workspaces`.
  v1.route("/billing/webhooks", billingWebhooks);
  // -feature:billing
  // +feature:uploads
  v1.route("/uploads", uploads);
  // -feature:uploads
  // +feature:audit-log
  // Workspace-scope audit lives under the /workspaces prefix so it
  // shares the slug-resolution path with other workspace controllers.
  v1.route("/workspaces", workspaceAudit);
  // App-scope audit is admin-only and lives at /admin. Mount point is
  // outside /workspaces so it's clear the gate is app-level.
  v1.route("/admin", appAudit);
  // -feature:audit-log
  return v1;
}
