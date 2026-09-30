import { Hono } from "hono";
import { z } from "zod";
// +feature:auth-magic-link
import { getDevMagicLinkLast } from "@/infrastructure/mailer.ts";
// -feature:auth-magic-link
// +feature:auth-admin
import { promoteToAppAdmin } from "@/infrastructure/better-auth-user.ts";
import { requireSession } from "../middleware/session.ts";
// -feature:auth-admin
import { Email } from "@/identity/domain/email.ts";
import { User } from "@/identity/domain/user.ts";
import { WorkspaceMember } from "@/workspaces/domain/workspace-member.ts";
import { resolveSlug } from "./workspaces.controller.ts";
import type { HonoEnv } from "../middleware/container.ts";

export const dev = new Hono<HonoEnv>();

// +feature:auth-magic-link
dev.get("/last-magic-link", (c) => {
  if (process.env.NODE_ENV === "production") {
    return c.notFound();
  }
  const email = c.req.query("email")?.trim().toLowerCase();
  if (!email) {
    return c.json({ error: { code: "validation", message: "email is required" } }, 400);
  }
  const snap = getDevMagicLinkLast();
  if (!snap || snap.to !== email) {
    return c.json({ link: null as string | null });
  }
  return c.json({ link: snap.link });
});
// -feature:auth-magic-link

// +feature:auth-admin
/**
 * Self-promote the calling user to app-level `admin`. The better-auth admin
 * plugin doesn't ship a bootstrap endpoint — granting the first admin is a
 * DB edit or an `adminUserIds` config. This endpoint makes it a one-click
 * operation from the dev feature page. It's a `404` in production so it
 * can't be used as a privilege-escalation primitive if it ships by accident.
 */
dev.post("/make-admin", async (c) => {
  if (process.env.NODE_ENV === "production") {
    return c.notFound();
  }
  const container = c.get("container");
  const session = requireSession(c);
  await promoteToAppAdmin(container, session.userId);
  return c.json({ ok: true, role: "admin" });
});
// -feature:auth-admin

/**
 * Snapshot of which adapter classes + provider keys are wired into the
 * running container. Powers the "Active providers" panel on the dev
 * page so a developer can confirm at a glance that BILLING_PROVIDER /
 * JOBS_PROVIDER / RATE_LIMIT_PROVIDER env values translated into the
 * adapters they expected.
 */
dev.get("/active-providers", (c) => {
  if (process.env.NODE_ENV === "production") return c.notFound();
  const container = c.get("container");
  const config = container.config;
  return c.json({
    nodeEnv: process.env.NODE_ENV ?? "development",
    mailer: container.mailer.constructor.name,
    // +feature:billing
    billing: {
      enabled: config.billing.enabled,
      provider: config.billing.provider,
    },
    // -feature:billing
    // +feature:jobs
    jobs: {
      enabled: config.jobs.enabled,
      provider: config.jobs.provider,
      registered: container.jobRegistry.map((j) => ({
        name: j.name,
        schedule: j.schedule ?? null,
        maxAttempts: j.maxAttempts ?? null,
      })),
    },
    // -feature:jobs
    // +feature:uploads
    uploads: {
      enabled: config.uploads.provider !== "noop",
      provider: config.uploads.provider,
    },
    // -feature:uploads
  });
});

const seedSchema = z.object({ count: z.number().int().min(1).max(20).optional() });

const FAKE_FIRST = [
  "Ada", "Alan", "Grace", "Linus", "Margaret", "Donald", "Edsger", "Tony",
  "John", "Barbara", "Ken", "Bjarne", "Anders", "Brendan", "Guido", "Yukihiro",
  "James", "Rich", "Joe", "Sandi",
];
const FAKE_LAST = [
  "Lovelace", "Turing", "Hopper", "Torvalds", "Hamilton", "Knuth", "Dijkstra",
  "Hoare", "McCarthy", "Liskov", "Thompson", "Stroustrup", "Hejlsberg", "Eich",
  "van Rossum", "Matsumoto", "Gosling", "Hickey", "Walke", "Metz",
];

dev.post("/seed-members/:slug", async (c) => {
  if (process.env.NODE_ENV === "production") return c.notFound();
  const { workspace } = await resolveSlug(c);
  const body = c.req.header("content-type")?.includes("application/json")
    ? seedSchema.parse(await c.req.json().catch(() => ({})))
    : { count: undefined };
  const count = body.count ?? 5;
  const container = c.get("container");
  const created: { id: string; email: string; name: string }[] = [];

  await container.uow.run(async (tx) => {
    const memberRole = await tx.workspaceRoles.findByWorkspaceAndSystemKey(
      workspace.id,
      "MEMBER",
    );
    if (!memberRole) throw new Error("workspace MEMBER role missing");

    for (let i = 0; i < count; i++) {
      const first = FAKE_FIRST[Math.floor(Math.random() * FAKE_FIRST.length)]!;
      const last = FAKE_LAST[Math.floor(Math.random() * FAKE_LAST.length)]!;
      const suffix = Math.random().toString(36).slice(2, 7);
      const emailValue = `${first.toLowerCase()}.${last.toLowerCase().replace(/\s+/g, "-")}-${suffix}@dev.orbit.local`;
      const user = User.register(
        { email: Email.parse(emailValue), name: `${first} ${last}` },
        container.clock,
      );
      await tx.users.save(user);
      user.pullEvents();

      const member = WorkspaceMember.join(
        {
          workspaceId: workspace.id,
          userId: user.id,
          role: {
            id: memberRole.id,
            systemKey: memberRole.systemKey,
            permissions: memberRole.permissions,
          },
          seed: emailValue,
        },
        container.clock,
      );
      await tx.workspaceMembers.save(member);
      tx.events.addMany(member.pullEvents());
      created.push({ id: member.id, email: emailValue, name: user.name });
    }
  });

  return c.json({ ok: true, created });
});


// +feature:jobs
dev.get("/jobs", (c) => {
  if (process.env.NODE_ENV === "production") return c.notFound();
  const container = c.get("container");
  return c.json({
    items: container.jobRegistry.map((j) => ({
      name: j.name,
      schedule: j.schedule ?? null,
      maxAttempts: j.maxAttempts ?? null,
    })),
  });
});

const runJobSchema = z.object({
  name: z.string().min(1),
  payload: z.record(z.string(), z.unknown()).optional(),
});

dev.post("/run-job", async (c) => {
  if (process.env.NODE_ENV === "production") return c.notFound();
  const body = runJobSchema.parse(await c.req.json());
  const container = c.get("container");
  const def = container.jobRegistry.find((j) => j.name === body.name);
  if (!def) {
    return c.json(
      { error: { code: "not_found", message: `unknown job: ${body.name}` } },
      404,
    );
  }
  // Bypass the typed JobName/Payload contract on purpose — this is a
  // dev-only escape hatch and the registry vouches the name exists.
  await container.jobQueue.enqueue(
    def.name as never,
    (body.payload ?? {}) as never,
  );
  return c.json({ ok: true, name: def.name });
});
// -feature:jobs
