# Background jobs + cron

Orbit ships two adapters behind the same `JobQueue` + `JobRuntime` ports,
plus an optional `JobDispatcher` port for HTTP-delivered runtimes:

| Provider | Adapter key | Best for |
|---|---|---|
| [graphile-worker](https://github.com/graphile/worker) | `graphile` | Self-hosted, Postgres-backed queue with crontab scheduling. No new infra — reuses your existing Postgres. Runs alongside the API in a long-lived Node process. |
| [Upstash QStash](https://upstash.com/docs/qstash/overall/getstarted) | `qstash` | Managed HTTP queue. Deploys cleanly on serverless runtimes (Vercel, Cloudflare Workers) because there's no long-lived worker process — QStash posts back to your API over HTTP. |

Both adapters satisfy the same contract in application code:

```ts
// Services enqueue work without knowing which adapter is wired.
await jobQueue.enqueue("send-welcome-email", { userId }, { runAt: future });
```

Recurring schedules are declared the same way regardless of provider:

```ts
defineJob({
  name: "daily-digest",
  schedule: "0 9 * * *", // standard cron syntax
  handler: async (payload, ctx) => { /* … */ },
});
```

## Picking one

- **Self-hosting on a VM / container with Postgres nearby** → `graphile`.
  Zero new dependencies, crontab runs in-process, and you get the
  `graphile_worker.jobs` table for free as an observability surface.
- **Deploying on Vercel / Cloudflare Workers / any serverless runtime**
  → `qstash`. Workers tend to not play well with long-lived background
  processes; QStash replaces the in-process runtime with "just another
  HTTP request" that lands on `/v1/jobs/run/:name`.
- **Not sure yet** → `graphile`. It's the zero-infra default and you
  can swap to QStash later by flipping `JOBS_PROVIDER` — the call sites
  don't change.

## Wiring

Each adapter reads its own env vars. The parent `JOBS_PROVIDER` switch
picks which adapter is built; the others are either stripped out
entirely (by the CLI) or left in as dead code (if you kept both during
scaffolding).

### Graphile

```bash
JOBS_PROVIDER="graphile"
# Optional: direct (non-pooler) Postgres URL for LISTEN/NOTIFY.
WORKER_DATABASE_URL="postgresql://…@…:5432/…?sslmode=verify-full"
JOBS_CONCURRENCY="2"
```

- Boots a worker inside the API process. Nothing else to run.
- Cron jobs are reconciled on boot from the `JobRegistry`.
- Crashes / restarts are safe — graphile owns `graphile_worker.jobs`
  and locks rows per worker id.

### QStash

```bash
JOBS_PROVIDER="qstash"
QSTASH_TOKEN="qstash_..."                # publish-side token
QSTASH_CURRENT_SIGNING_KEY="sig_..."     # webhook verification
QSTASH_NEXT_SIGNING_KEY="sig_..."        # next key (rotation-safe)
QSTASH_CALLBACK_URL="https://your-api.example.com"
```

- No worker process. QStash is an HTTP queue that delivers each
  enqueued message to `${QSTASH_CALLBACK_URL}/v1/jobs/run/<name>`.
- On boot the QStash runtime reconciles schedules — creating / updating
  / deleting QStash schedules to match the `JobRegistry`.
- Inbound requests to `/v1/jobs/run/:name` are signature-verified by
  `QStashJobDispatcher` before the handler runs.
- Retry behaviour is configured per-job via `maxAttempts`; QStash does
  the actual retry with exponential backoff.

## CLI flags → feature keys

The `create-orb` CLI maps the jobs provider choice to feature toggles:

| CLI flag | Keeps | Strips |
|---|---|---|
| `--jobs-provider=graphile` | `jobs`, `jobs-graphile` | `jobs-qstash` |
| `--jobs-provider=qstash`   | `jobs`, `jobs-qstash`   | `jobs-graphile` |
| `--jobs=no`                | — | `jobs`, `jobs-graphile`, `jobs-qstash` |

Disabling `jobs` removes the `JobQueue` port from the container and
deletes `apps/api/src/jobs/` entirely. Any service that would have
enqueued work must run synchronously instead — the
`NoopJobQueue.enqueue()` throws at runtime if it's ever called.

## Local development for QStash

QStash needs a public URL to post back to. Two easy options:

- [`smee.io`](https://smee.io) — see `apps/webhook-tunnel/README.md`
  for setup. Forward to `/v1/jobs/run/:name` on your local API.
- [`ngrok`](https://ngrok.com) — expose port 4002 directly and set
  `QSTASH_CALLBACK_URL` to the ngrok URL.

For everyday dev, `JOBS_PROVIDER=graphile` is usually faster — no
tunnel required.
