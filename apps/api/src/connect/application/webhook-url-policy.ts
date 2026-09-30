import { ValidationError } from "@/kernel/errors.ts";

/**
 * Save-time checks on a webhook URL. The sender re-checks the resolved
 * address at delivery time (see `FetchWebhookSender`), which is what
 * actually stops DNS-rebinding style SSRF; this just gives integrators
 * an immediate, readable error.
 */
export function assertWebhookUrlAllowed(url: string | null, opts: { production: boolean }): void {
  if (!url || !opts.production) return;
  const parsed = new URL(url);
  if (parsed.protocol !== "https:") {
    throw new ValidationError("application.webhook_url_insecure", "webhook URL must use https");
  }
  const host = parsed.hostname;
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) {
    throw new ValidationError(
      "application.webhook_url_private",
      "webhook URL must be publicly reachable",
    );
  }
}
