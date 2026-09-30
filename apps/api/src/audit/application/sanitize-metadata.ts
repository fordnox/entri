/**
 * Remove secret-bearing fields from audit metadata before it hits the
 * repo. Emails are considered non-sensitive in this kit and pass
 * through unchanged; tokens, passwords, signatures, and OTP codes are
 * replaced with the literal `"[redacted]"` so the ledger still records
 * *that* the field existed without persisting its value.
 *
 * The match is case-insensitive against a fixed key list rather than a
 * regex so we don't accidentally redact a column like `tokenCount`.
 * Walks plain objects recursively; arrays and primitives pass through.
 */

const REDACTED = "[redacted]" as const;

const SENSITIVE_KEYS = new Set([
  "token",
  "tokens",
  "magicLink",
  "magicLinkToken",
  "sessionToken",
  "accessToken",
  "refreshToken",
  "apiKey",
  "api_key",
  "secret",
  "clientSecret",
  "password",
  "newPassword",
  "currentPassword",
  "otp",
  "code",
  "verificationCode",
  "signature",
  "inviteToken",
  "webhookSecret",
].map((k) => k.toLowerCase()));

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    !(value instanceof Date)
  );
}

export function sanitizeMetadata(
  input: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      out[key] = REDACTED;
      continue;
    }
    if (isPlainObject(value)) {
      out[key] = sanitizeMetadata(value);
      continue;
    }
    out[key] = value;
  }
  return out;
}
