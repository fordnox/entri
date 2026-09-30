/**
 * graphile-worker adapter for the `JobQueue` port.
 *
 * `quickAddJob` opens a short-lived pg client, inserts a row into
 * `graphile_worker.jobs`, and returns — no long-lived connection, so
 * it's safe to call from request handlers. The worker process (see
 * `GraphileJobRuntime`) picks the row up via `LISTEN`.
 */
import { quickAddJob } from "graphile-worker";
import type {
  JobEnqueueOptions,
  JobQueue,
} from "@/jobs/application/job-queue.ts";
import type { JobName, JobPayload } from "@/jobs/application/job-registry.ts";
import { toGraphileTaskName } from "./graphile-task-name.ts";

export interface GraphileJobQueueOptions {
  connectionString: string;
}

export class GraphileJobQueue implements JobQueue {
  constructor(private readonly opts: GraphileJobQueueOptions) {}

  async enqueue<N extends JobName>(
    name: N,
    payload: JobPayload<N>,
    options: JobEnqueueOptions = {},
  ): Promise<void> {
    // `quickAddJob` is generic over `GraphileWorker.Tasks`, whereas
    // our port is generic over `OrbitJobs.Jobs` — the two registries
    // don't overlap by design (the port is provider-neutral). The cast
    // is safe because name + payload come from the same `JobRegistry`
    // entry that was installed into the adapter at boot.
    await quickAddJob(
      { connectionString: this.opts.connectionString },
      toGraphileTaskName(name) as never,
      payload as never,
      {
        runAt: options.runAt,
        jobKey: options.jobKey,
        maxAttempts: options.maxAttempts,
      },
    );
  }
}
