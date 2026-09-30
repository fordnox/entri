/**
 * Fallback runtime wired when jobs are disabled. `start()` and
 * `stop()` are both resolved-void — keeps index.ts boot/shutdown
 * branch-free even when no adapter is compiled in.
 */
import type { JobRuntime } from "@/jobs/application/job-runtime.ts";

export class NoopJobRuntime implements JobRuntime {
  readonly provider = "noop";
  async start(): Promise<void> {}
  async stop(): Promise<void> {}
}
