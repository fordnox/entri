/**
 * graphile-worker only allows `[_a-zA-Z][_a-zA-Z0-9:_-]*` for crontab
 * task identifiers (see `cronConstants.CRONTAB_COMMAND`), so the dotted
 * names we use as the public job-name contract (`demo.cleanup`,
 * `audit.retention-cleanup`) get rejected at boot. We translate `.` to
 * `:` at the adapter boundary — TaskList registration, crontab line
 * emission, and enqueue — so the rest of the codebase keeps using the
 * dotted form.
 */
export function toGraphileTaskName(name: string): string {
  return name.replace(/\./g, ":");
}
