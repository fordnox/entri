/**
 * JobDispatcher port.
 *
 * The inbound seam for HTTP-delivered job runtimes (QStash). An
 * adapter verifies the provider's signature on the raw body, finds the
 * matching `JobDefinition` by name, and runs the handler. The kit's
 * `/v1/jobs/run/:name` route delegates to this port whenever the
 * configured runtime dispatches over HTTP.
 *
 * Self-hosted runtimes (graphile-worker) don't need a dispatcher —
 * they poll the queue themselves. The container exposes the dispatcher
 * as `JobDispatcher | null` so the route can return 404 when no
 * HTTP-delivery adapter is wired.
 */

export class InvalidJobSignatureError extends Error {
  readonly code = "jobs.dispatch.invalid_signature";
  constructor(message = "job dispatch request failed signature verification") {
    super(message);
    this.name = "InvalidJobSignatureError";
  }
}

export class UnknownJobError extends Error {
  readonly code = "jobs.dispatch.unknown_job";
  constructor(jobName: string) {
    super(`no handler registered for job '${jobName}'`);
    this.name = "UnknownJobError";
  }
}

export interface DispatchInput {
  /** Job name from the URL path (`/v1/jobs/run/:name`). */
  readonly name: string;
  /** Raw request body — required verbatim for signature verification. */
  readonly rawBody: string;
  /** Lowercased inbound headers. */
  readonly headers: Record<string, string>;
  /**
   * URL the provider delivered to. Some signatures bind to the full
   * URL (QStash does); adapters that don't care can ignore.
   */
  readonly url: string;
}

export interface DispatchResult {
  readonly ok: true;
  readonly jobName: string;
  readonly attempt: number;
}

export interface JobDispatcher {
  readonly provider: string;
  /**
   * Verify + dispatch. Throws `InvalidJobSignatureError` for a bad
   * signature (caller maps to 400/401), `UnknownJobError` for a job
   * name that isn't registered (404), and any user-thrown error
   * bubbles up (500 — the provider will retry per its own policy).
   */
  dispatch(input: DispatchInput): Promise<DispatchResult>;
}
