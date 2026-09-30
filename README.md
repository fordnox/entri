# Orbit

> **Private source — paid tier.**
> The free-tier sibling of this repo lives at [`were-orbit/orbit-starter`](https://github.com/were-orbit/orbit-starter).

An opinionated, production-ready SaaS starter kit. Multi-tenant workspaces, teams with nested roles, permission-based access control, provider-agnostic billing (Stripe / Polar / Dodo), transactional email, magic-link + OAuth auth, background jobs, rate limiting, audit logs, file uploads, and an in-process realtime hub — wired into a clean DDD codebase, with a single Drizzle schema as the source of truth.

This is the **private source of truth**. The public `orbit-starter` repo is auto-generated from this one on every tag push, with paid features stripped out. If you're reading this, you have paid access — welcome.

---

## Quick start

**Prereqs:** Node 22+, npm 10+, PostgreSQL 14+, and a `git` that can clone this repo.

```bash
git clone git@github.com:were-orbit/orbit.git my-saas
cd my-saas
npm install
cp apps/api/.env.example apps/api/.env      # fill in secrets
npm run drizzle:migrate                      # apply migrations (or `npm run setup` for guided bootstrap)
npm run dev                                  # api (4002) + web (4001) + www (4000) + webhook tunnel
```

Or scaffold a new project from the CLI (adds your own flavour of feature toggles):

```bash
npx create-orb my-saas \
  --framework=tanstack \
  --billing-provider=stripe \
  --jobs-provider=graphile \
  --rate-limit-provider=unkey
```

Run `npx create-orb --help` for every flag.

---

## Layout

```
.
├── apps/
│   ├── api             →  Hono REST + WebSocket server   (port 4002)
│   ├── web-tanstack    →  TanStack Start dashboard shell (port 4001)  ← pick one
│   ├── web-next        →  Next 16 App Router shell       (port 4003)  ← pick one
│   ├── www             →  Marketing site                 (port 4000)
│   └── webhook-tunnel  →  smee.io → local API forwarder  (dev only)
├── packages/
│   ├── shared          →  domain types, DTOs, permissions, branded IDs
│   ├── ui              →  components, hooks, Tailwind v4 theme
│   └── create-orb    →  the CLI that scaffolds new projects from this repo
└── internal/
    └── platform       →  the business backend (Polar webhooks, GitHub access)
                         — never shipped to customers via the CLI
```

Both `apps/web-*` are sibling implementations of the same authenticated app against the same Hono API. `create-orb` prompts for one framework (`--framework=tanstack|next`) and strips the other. See [`docs/frontends.md`](docs/frontends.md) for the trade-offs.

---

## What you got (paid)

**Free tier (also in `orbit-starter`):**

- **Auth** — better-auth with magic links, Google + Apple OAuth, and an admin plugin for impersonation.
- **Workspaces** — multi-tenant root. Slug-routed URLs, ownership transfer, member management, invites.
- **Workspace PBAC** — permissions at the workspace scope. System roles (OWNER / ADMIN / MEMBER) + custom roles.
- **Realtime** — in-process WebSocket hub + presence tracker. 25s heartbeat, 30s offline grace window.
- **Two frontend shells** — pick TanStack Start or Next 16 at scaffold time.

**Paid — the reason you're here:**

- **Teams** — second tier of grouping inside a workspace, with its own roles and its own PBAC scope.
- **Billing** — `BillingProvider` port with three adapters: Stripe, Polar, Dodo Payments. Checkout, customer portal, signature-verified webhooks, and a `BillingEvent` append-only ledger.
- **Background jobs + cron** — `JobQueue` / `JobRuntime` ports with graphile-worker (self-hosted Postgres) and Upstash QStash (managed HTTP) adapters.
- **Rate limiting** — `RateLimiter` port with Unkey (default) and Upstash Redis adapters, layered per-IP and per-email middleware on the auth + waitlist surface. Fails open on provider outage.
- **Audit logs** — append-only trail at two scopes: `AppAuditEntry` for moderation-class events and `WorkspaceAuditEntry` for tenant-scoped activity (narrowed to a team when teams is on). Entries are materialised by a post-commit projector on the domain event bus.
- **Transactional email** — Resend adapter + React Email templates for magic links and workspace invites. The free tier logs to stdout; paid sends real mail.
- **File uploads** — UploadThing or any S3-compatible bucket (Cloudflare R2, AWS S3, MinIO) behind an `uploads` bounded context.
- **Waitlist / private beta** — request-access flow, admin approval, invite acceptance.
- **Drizzle ORM** — Drizzle is the ORM. One hand-maintained schema at `apps/api/src/db/drizzle/schema.ts`, drizzle-kit migrations, and a `drizzle-*.repository.ts` per aggregate behind the domain-layer repository interfaces and a shared `BaseUnitOfWork`.
- **Email + password auth** — the classic path, feature-flagged off by default.

Every paid feature is toggleable at scaffold time via the CLI, and every feature lives behind a bounded context + a port so it's swappable.

---

## Architecture at a glance

- **Domain-driven design.** Each bounded context (`identity`, `workspaces`, `teams`, `billing`, `waitlist`, `uploads`) is organized as `domain/ · application/ · infrastructure/`. Domain objects are pure; infrastructure adapters implement repository and provider interfaces declared in `domain/`.
- **Unit of Work.** Writes go through `uow.run(tx => ...)` and domain events collected inside the transaction are dispatched to the `EventBus` **after** commit. Subscribers handle side effects (realtime broadcasts, mailer sends, webhook reconciliation).
- **Branded IDs.** Every entity has a prefixed UUIDv7-based id via `@orbit/shared/ids` — e.g. `team_01H…`, `sub_01H…`. Compile-time disambiguation; no more "did I pass the wrong id?".
- **Typed DTO boundary.** Client and server share types and Zod validators via `@orbit/shared`.
- **Feature fences.** Inline `// +feature:<name>` / `// -feature:<name>` markers let the CLI strip disabled features cleanly at scaffold time — no dead code, no runtime flags.

Docs that go deeper:

- [`apps/api/README.md`](apps/api/README.md) — backend walk-through
- [`docs/billing-providers.md`](docs/billing-providers.md) — BillingProvider port + adapters
- [`docs/jobs-providers.md`](docs/jobs-providers.md) — JobQueue + JobRuntime
- [`docs/frontends.md`](docs/frontends.md) — TanStack vs Next shell

---

## Common scripts

```bash
npm run dev                      # all apps + webhook tunnel
npm run dev:www                  # marketing only            (4000)
npm run dev:web                  # web shell (whichever survived the scaffold)
npm run dev:web-tanstack         # force the TanStack shell  (4001)
npm run dev:web-next             # force the Next shell      (4003)
npm run dev:api                  # api only                  (4002)
npm run dev:platform             # internal/platform only    (4100)

npm run build                    # build every app
npm run typecheck                # tsc -b across every workspace
npm run lint                     # eslint across every workspace
npm run drizzle:generate         # emit a SQL migration after schema changes
npm run drizzle:migrate          # apply migrations
npm run drizzle:push             # push the schema straight to the dev DB (no migration file)
npm run drizzle:studio           # browse the DB in Drizzle Studio

npm run build:starter            # (CI) produce the free-tier orbit-starter tree
```

---

## Keeping up to date

Every release lands on a git tag. To pull the latest into an existing clone:

```bash
git fetch origin
git log --oneline origin/main ^HEAD     # see what's new
git merge origin/main                   # or rebase, your call
```

If you already scaffolded a project with the CLI and want to apply upstream changes to it, that's a three-way merge between your scaffold and the current `main` — usually manageable because each feature lives in a single context.

---

## Support

- **Bugs / feature requests** — [GitHub Issues](https://github.com/were-orbit/orbit/issues)
- **Questions** — [Discussions](https://github.com/were-orbit/orbit/discussions), or Discord (link in your welcome email)
- **Security** — email directly, not GitHub

---

## License

Access is licensed, not open-source. You may ship unlimited commercial products with it, but you may not redistribute the source itself. See [LICENSE](LICENSE) for the full terms.
