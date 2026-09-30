/**
 * Module-level default for `apiOrigin`. The IIFE entry (`global.ts`) sets
 * it to the origin of the `<script>` that loaded the SDK; ESM consumers
 * fall back to `window.location.origin` unless they pass `apiOrigin`.
 */
let defaultApiOrigin: string | null = null;

export function setDefaultApiOrigin(origin: string | null): void {
  defaultApiOrigin = origin;
}

export function resolveApiOrigin(explicit?: string): string {
  const raw = explicit || defaultApiOrigin || window.location.origin;
  return raw.replace(/\/+$/, "");
}
