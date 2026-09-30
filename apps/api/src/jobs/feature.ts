/**
 * Jobs feature module.
 *
 * Jobs are a container primitive (like `fileStorage` or `mailer`), not
 * a feature that contributes services — app code calls `jobQueue.enqueue`
 * and doesn't care which adapter is wired. This file owns:
 *
 *   - Config parsing from env (`readJobsConfig`)
 *   - `buildJobQueue(config)`   — cheap, used at boot to satisfy the
 *     container contract.
 *   - `buildJobRuntime(config, registry)` — the long-lived worker (or
 *     schedule-reconciler for HTTP adapters). Called from `index.ts`
 *     after the container + registry exist.
 *   - `buildJobs(container)` — produces the provider-neutral registry.
 *     Ships empty; features append definitions as the kit grows.
 *
 * Each adapter is a strippable sub-feature (`jobs-graphile` today,
 * `jobs-qstash` next). The parent `jobs` feature is also strippable —
 * when removed the kit simply has no background worker and services
 * that would have enqueued work must run synchronously.
 */
import type { AppContainer } from "@/composition.ts";
import type { JobDispatcher } from "@/jobs/application/job-dispatcher.ts";
import type { JobQueue } from "@/jobs/application/job-queue.ts";
import type { JobRuntime } from "@/jobs/application/job-runtime.ts";
import type {
  JobDefinition,
  JobRegistry,
} from "@/jobs/application/job-registry.ts";
import { NoopJobQueue } from "@/jobs/infrastructure/noop-job-queue.ts";
import { NoopJobRuntime } from "@/jobs/infrastructure/noop-job-runtime.ts";
// +feature:jobs-graphile
import { GraphileJobQueue } from "@/jobs/infrastructure/graphile-job-queue.ts";
import { GraphileJobRuntime } from "@/jobs/infrastructure/graphile-job-runtime.ts";
// -feature:jobs-graphile

// +feature:jobs-graphile
export interface GraphileJobsConfig {
  /**
   * Postgres connection string graphile-worker uses. Prefer a direct
   * (non-pooler) URL — graphile-worker keeps a long-lived `LISTEN`
   * session that doesn't survive a PgBouncer transaction reset.
   */
  connectionString: string;
  /** Parallelism for this worker instance. */
  concurrency: number;
}
// -feature:jobs-graphile


export type JobsProviderKey = "graphile" | "qstash";

export interface JobsConfig {
  enabled: boolean;
  provider: JobsProviderKey | null;
  // +feature:jobs-graphile
  graphile: GraphileJobsConfig | null;
  // -feature:jobs-graphile
}

export function buildJobQueue(config: JobsConfig): JobQueue {
  // +feature:jobs-graphile
  if (config.provider === "graphile" && config.graphile) {
    return new GraphileJobQueue({
      connectionString: config.graphile.connectionString,
    });
  }
  // -feature:jobs-graphile
  return new NoopJobQueue();
}

export function buildJobRuntime(
  config: JobsConfig,
  registry: JobRegistry,
): JobRuntime {
  // +feature:jobs-graphile
  if (config.provider === "graphile" && config.graphile) {
    return new GraphileJobRuntime(
      {
        connectionString: config.graphile.connectionString,
        concurrency: config.graphile.concurrency,
      },
      registry,
    );
  }
  // -feature:jobs-graphile
  return new NoopJobRuntime();
}

/**
 * Build the HTTP-side dispatcher for runtimes that deliver jobs over
 * HTTP. Returns `null` for in-process runtimes (graphile) or when
 * jobs are disabled — the `/v1/jobs/run/:name` route checks this and
 * 404s accordingly.
 */
export function buildJobDispatcher(
  config: JobsConfig,
  registry: JobRegistry,
): JobDispatcher | null {
  void config;
  void registry;
  return null;
}

/**
 * Build the provider-neutral job registry for this container.
 *
 * The starter kit ships with zero recurring jobs. Features that need
 * background work append a `defineJob(...)` call here, closing over
 * `container.services` / `container.uow` so handlers can reach the
 * same application layer the HTTP routes use.
 */
export function buildJobs(container: AppContainer): JobRegistry {
  const jobs: JobDefinition[] = [];
  return jobs;
}
