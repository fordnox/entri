const LABEL = /^(?!-)[a-z0-9-]{1,63}$/;

/**
 * Client-side sanity check only — the API normalizes and validates for
 * real. Accepts pasted URLs (`https://acme.com/path`), strips ports and
 * trailing dots, converts IDNs to punycode.
 */
export function normalizeDomain(input: string): { domain: string } | { error: string } {
  const raw = input.trim().toLowerCase();
  if (!raw) return { error: "Enter a domain, like example.com." };
  let host: string;
  try {
    const withScheme = /^[a-z][a-z0-9+.-]*:\/\//.test(raw) ? raw : `http://${raw}`;
    host = new URL(withScheme).hostname;
  } catch {
    return { error: "That doesn't look like a valid domain." };
  }
  host = host.replace(/\.+$/, "");
  if (host.startsWith("[") || /^\d+(\.\d+){3}$/.test(host)) {
    return { error: "Enter a domain name, not an IP address." };
  }
  const labels = host.split(".");
  if (
    host.length > 253 ||
    labels.length < 2 ||
    labels.some((l) => !LABEL.test(l) || l.endsWith("-")) ||
    /^\d+$/.test(labels[labels.length - 1]!)
  ) {
    return { error: "That doesn't look like a valid domain." };
  }
  return { domain: host };
}
