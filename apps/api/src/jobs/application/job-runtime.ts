/**
 * JobRuntime port.
 *
 * Owns the "read side" of background jobs: polling a queue, running
 * registered handlers, reconciling cron schedules. Self-hosted
 * adapters (graphile-worker) implement this with a long-lived process;
 * managed HTTP adapters (QStash) implement `start()` as a one-shot
 * schedule reconciliation — handler dispatch happens via an HTTP route
 * rather than in-process.
 */
export interface JobRuntime {
  readonly provider: string;
  /**
   * Boot the runtime. For self-hosted adapters this starts workers
   * that run until `stop()`. For HTTP-delivery adapters this reconciles
   * recurring schedules with the provider and resolves.
   */
  start(): Promise<void>;
  /**
   * Gracefully drain any in-flight work and shut down. Idempotent.
   * Self-hosted adapters finish active jobs; HTTP adapters are
   * effectively a no-op since the runtime carries no state.
   */
  stop(): Promise<void>;
}
