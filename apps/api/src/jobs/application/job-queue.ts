/**
 * JobQueue port.
 *
 * The write-side seam for background work: app services call
 * `jobQueue.enqueue("some.job", payload)` without knowing whether
 * graphile-worker, QStash, or a no-op is wired underneath.
 *
 * Only `enqueue` lives here. Recurring schedules are declared
 * statically on the `JobDefinition` and reconciled by the runtime at
 * boot — there is no imperative `schedule()` call, so the surface stays
 * small and every provider can support it.
 */
import type { JobName, JobPayload } from "./job-registry.ts";

export interface JobEnqueueOptions {
  /**
   * Earliest time the job may run. Adapters MAY run it later if busy;
   * never earlier. When omitted the job is eligible immediately.
   */
  runAt?: Date;
  /**
   * Idempotency key. Enqueuing twice with the same `jobKey` before the
   * first run completes replaces the pending job. Exact semantics vary
   * per adapter — graphile-worker replaces payload, QStash deduplicates
   * at the queue edge — but both guarantee "at least one but not
   * duplicated" when keys collide.
   */
  jobKey?: string;
  /** Override the definition's `maxAttempts` for this specific enqueue. */
  maxAttempts?: number;
}

export interface JobQueue {
  /**
   * Enqueue a single job. Returns once the task has been accepted by
   * the underlying queue (graphile: row committed; QStash: HTTP 200
   * from the publish API). Handlers run asynchronously after that.
   */
  enqueue<N extends JobName>(
    name: N,
    payload: JobPayload<N>,
    options?: JobEnqueueOptions,
  ): Promise<void>;
}
