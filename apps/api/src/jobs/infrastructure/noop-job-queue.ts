/**
 * Fallback queue wired when no background adapter is configured.
 *
 * `enqueue` is intentionally an error instead of a silent no-op — a
 * service calling `jobQueue.enqueue(...)` reasonably expects the job
 * to actually run, and dropping the call on the floor would cause
 * silent data loss. Tenants that want to run without a job queue can
 * inline the work synchronously at the call site.
 */
import { ConflictError } from "@/kernel/errors.ts";
import type { JobQueue } from "@/jobs/application/job-queue.ts";

export class NoopJobQueue implements JobQueue {
  async enqueue(): Promise<void> {
    throw new ConflictError(
      "jobs.provider_not_configured",
      "background jobs are not configured on this server",
    );
  }
}
