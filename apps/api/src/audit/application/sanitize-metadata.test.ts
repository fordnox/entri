import { describe, expect, it } from "vitest";
import { sanitizeMetadata } from "./sanitize-metadata.ts";

describe("sanitizeMetadata", () => {
  it("redacts known token-bearing keys", () => {
    const out = sanitizeMetadata({
      token: "abc",
      apiKey: "xyz",
      password: "hunter2",
    });
    expect(out).toEqual({
      token: "[redacted]",
      apiKey: "[redacted]",
      password: "[redacted]",
    });
  });

  it("leaves emails and non-sensitive fields alone", () => {
    const out = sanitizeMetadata({
      email: "ada@example.com",
      invitedBy: "grace@example.com",
      role: "admin",
      count: 3,
    });
    expect(out).toEqual({
      email: "ada@example.com",
      invitedBy: "grace@example.com",
      role: "admin",
      count: 3,
    });
  });

  it("matches key names case-insensitively without catching look-alikes", () => {
    const out = sanitizeMetadata({
      Token: "1",
      TOKEN: "2",
      tokenCount: 5,
    });
    expect(out.Token).toBe("[redacted]");
    expect(out.TOKEN).toBe("[redacted]");
    expect(out.tokenCount).toBe(5);
  });

  it("recurses into nested objects but leaves arrays untouched", () => {
    const out = sanitizeMetadata({
      outer: {
        secret: "nope",
        inner: { signature: "sig", label: "ok" },
      },
      codes: ["a", "b"],
    });
    expect(out).toEqual({
      outer: {
        secret: "[redacted]",
        inner: { signature: "[redacted]", label: "ok" },
      },
      codes: ["a", "b"],
    });
  });
});
