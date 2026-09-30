/**
 * graphile-worker adapter for the `JobRuntime` port.
 *
 * Translates a provider-neutral `JobRegistry` into graphile-worker's
 * `TaskList` + crontab string at boot time, then delegates to
 * `run(...)`. cluster safety, retries, backoff, and the cron scheduler
 * are all handled by graphile-worker — we just hand it the list.
 */
import {
  run,
  type Runner,
  type Task,
  type TaskList,
} from "graphile-worker";
import type { JobRuntime } from "@/jobs/application/job-runtime.ts";
import type {
  JobDefinition,
  JobRegistry,
} from "@/jobs/application/job-registry.ts";
import { toGraphileTaskName } from "./graphile-task-name.ts";

export interface GraphileJobRuntimeOptions {
  connectionString: string;
  concurrency?: number;
}

export class GraphileJobRuntime implements JobRuntime {
  readonly provider = "graphile";
  private runner: Runner | null = null;
  private controllers: AbortController[] = [];

  constructor(
    private readonly opts: GraphileJobRuntimeOptions,
    private readonly registry: JobRegistry,
  ) {}

  async start(): Promise<void> {
    if (this.runner) return;
    this.runner = await run({
      connectionString: this.opts.connectionString,
      concurrency: this.opts.concurrency ?? 2,
      taskList: this.buildTaskList(),
      crontab: this.buildCrontab(),
      noHandleSignals: true,
    });
  }

  async stop(): Promise<void> {
    for (const ctrl of this.controllers) ctrl.abort();
    this.controllers = [];
    if (this.runner) {
      const runner = this.runner;
      this.runner = null;
      await runner.stop();
    }
  }

  /**
   * Adapt each `JobDefinition` into a `graphile-worker` Task, wiring
   * `helpers.job.attempts` into our `JobHandlerContext.attempt` and
   * creating an `AbortController` per run so long I/O can cooperate
   * with shutdown.
   */
  private buildTaskList(): TaskList {
    const entries: [string, Task][] = this.registry.map((def) => [
      toGraphileTaskName(def.name),
      this.wrapHandler(def),
    ]);
    return Object.fromEntries(entries);
  }

  private wrapHandler(def: JobDefinition): Task {
    return async (payload, helpers) => {
      const controller = new AbortController();
      this.controllers.push(controller);
      try {
        await def.handler(payload as never, {
          signal: controller.signal,
          attempt: helpers.job.attempts,
          jobName: def.name,
        });
      } finally {
        const idx = this.controllers.indexOf(controller);
        if (idx >= 0) this.controllers.splice(idx, 1);
      }
    };
  }

  /**
   * Build a crontab string from the registry. One line per scheduled
   * job; unscheduled jobs are omitted. graphile-worker defaults the
   * cron identifier to the task name when `?id=` is omitted, which is
   * what we want — each scheduled task is unique by name.
   */
  private buildCrontab(): string {
    const lines: string[] = [];
    for (const def of this.registry) {
      if (!def.schedule) continue;
      lines.push(`${def.schedule} ${toGraphileTaskName(def.name)}`);
    }
    return lines.join("\n");
  }
}
