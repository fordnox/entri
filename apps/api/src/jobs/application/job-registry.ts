/**
 * Typed, provider-neutral job registry.
 *
 * Features declare background tasks by augmenting the global
 * `OrbitJobs.Jobs` interface with `{ [name]: payload }`, then exporting
 * a `JobDefinition` that is appended into the registry by
 * `buildJobs(container)`. The current adapter (graphile-worker today,
 * QStash tomorrow) translates the registry into whatever the underlying
 * runtime wants:
 *
 *   - graphile-worker: a `TaskList` + a crontab string built at start.
 *   - QStash: one HTTP dispatcher route + calls to `Schedules.create()`
 *     reconciled at boot.
 *
 * The registry deliberately does NOT depend on any SDK — it's the seam
 * we swap adapters at.
 */

/**
 * Global job-name → payload type map, augmented by features. Parallel
 * to graphile-worker's `GraphileWorker.Tasks`, but provider-neutral so
 * we can swap adapters without rewriting handler signatures.
 *
 * Usage from a feature:
 *
 *   declare global {
 *     namespace OrbitJobs {
 *       interface Jobs {
 *         "email.send-magic-link": { userId: string; token: string };
 *       }
 *     }
 *   }
 */
declare global {
  // biome-ignore lint/style/noNamespace: merges with feature-authored augmentations
  namespace OrbitJobs {
    // biome-ignore lint/suspicious/noEmptyInterface: extended by features
    interface Jobs {}
  }
}

/** Every `OrbitJobs.Jobs` key is a valid job name. */
export type JobName = Extract<keyof OrbitJobs.Jobs, string>;

/** Payload type for a given job name. */
export type JobPayload<N extends JobName> = OrbitJobs.Jobs[N];

/**
 * What handlers receive alongside the payload. Kept minimal on
 * purpose: anything richer (pg client, provider-specific logger) would
 * leak the adapter into application code. Adapters translate their own
 * helpers into these three fields.
 */
export interface JobHandlerContext {
  /**
   * Fires when the runtime is shutting down or the job's timeout is
   * exceeded. Handlers should pass this into any long-running I/O.
   */
  readonly signal: AbortSignal;
  /** 1-based attempt counter. Same job re-run after failure = attempt 2. */
  readonly attempt: number;
  /** The job name, duplicated here so shared handlers can switch on it. */
  readonly jobName: string;
}

export type JobHandler<P> = (
  payload: P,
  ctx: JobHandlerContext,
) => Promise<void>;

/**
 * A single background task. Features build these from services injected
 * via closure in `buildJobs(container)`.
 */
export interface JobDefinition<N extends JobName = JobName> {
  readonly name: N;
  readonly handler: JobHandler<JobPayload<N>>;
  /**
   * Optional 5-field crontab (`m h dom mon dow`). When set the adapter
   * reconciles a recurring schedule at boot. Adapters MAY extend this
   * (graphile-worker supports backfill + job options) but the cross-
   * provider contract is plain POSIX crontab with no timezone — jobs
   * fire in UTC.
   */
  readonly schedule?: string;
  /**
   * Maximum total attempts (initial + retries). When omitted the
   * adapter's own default applies — 23 for graphile-worker, 3 for
   * QStash. Set explicitly on jobs where you care about either extreme.
   */
  readonly maxAttempts?: number;
}

export type JobRegistry = readonly JobDefinition[];

/**
 * Type-erased helper for building a registry entry. Callers get full
 * payload inference from `OrbitJobs.Jobs[N]` without having to spell it
 * out in the handler signature.
 */
export function defineJob<N extends JobName>(
  def: JobDefinition<N>,
): JobDefinition {
  return def as unknown as JobDefinition;
}
