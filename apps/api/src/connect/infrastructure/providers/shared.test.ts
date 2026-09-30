import { describe, expect, it } from "vitest";
import { ProviderApiError } from "@/connect/domain/dns-provider.ts";
import {
  type ExistingRecord,
  planChanges,
  quoteTxt,
  requireCredentials,
  rrsetChanges,
  scrub,
  unquoteTxt,
} from "./shared.ts";

const ex = (type: string, name: string, value: string, priority?: number): ExistingRecord<string> => ({
  type,
  name,
  value,
  ttl: 3600,
  priority,
  raw: `${type}:${name}:${value}`,
});

describe("planChanges", () => {
  it("replaces a parked A record on the same name (update in place)", () => {
    const ops = planChanges(
      [{ type: "A", name: "@", value: "76.76.21.21", ttl: 300 }],
      [ex("A", "@", "34.1.1.1"), ex("TXT", "@", "keep")],
    );
    expect(ops).toHaveLength(1);
    expect(ops[0]!.kind).toBe("update");
  });

  it("is a no-op for identical values (case / trailing-dot / quote insensitive)", () => {
    const ops = planChanges(
      [
        { type: "CNAME", name: "www", value: "Cname.Vercel-DNS.com", ttl: 300 },
        { type: "TXT", name: "_v", value: "abc", ttl: 300 },
      ],
      [ex("CNAME", "WWW", "cname.vercel-dns.com."), ex("TXT", "_v", '"abc"')],
    );
    expect(ops).toEqual([]);
  });

  it("adds TXT/MX alongside existing different values", () => {
    const ops = planChanges(
      [
        { type: "TXT", name: "@", value: "new", ttl: 300 },
        { type: "MX", name: "@", value: "mx2.example.net", ttl: 300, priority: 20 },
      ],
      [ex("TXT", "@", "old"), ex("MX", "@", "mx1.example.net", 10)],
    );
    expect(ops.map((o) => o.kind)).toEqual(["create", "create"]);
  });

  it("CNAME replaces every record at that name and removes conflicting types", () => {
    const ops = planChanges(
      [{ type: "CNAME", name: "shop", value: "shops.myshopify.com", ttl: 300 }],
      [ex("A", "shop", "1.1.1.1"), ex("A", "shop", "2.2.2.2"), ex("CNAME", "other", "x.com")],
    );
    expect(ops.filter((o) => o.kind === "delete")).toHaveLength(2);
    expect(ops.filter((o) => o.kind === "create")).toHaveLength(1);
    expect(ops[0]!.kind).toBe("delete");
  });

  it("A removes a CNAME at the same name and keeps multiple desired A values", () => {
    const ops = planChanges(
      [
        { type: "A", name: "@", value: "1.1.1.1", ttl: 300 },
        { type: "A", name: "@", value: "2.2.2.2", ttl: 300 },
      ],
      [ex("A", "@", "1.1.1.1"), ex("CNAME", "@", "parked.example")],
    );
    expect(ops.map((o) => o.kind).sort()).toEqual(["create", "delete"]);
  });

  it("rrsetChanges merges surviving and new values per set", () => {
    const existing = [ex("TXT", "@", "old")];
    const ops = planChanges([{ type: "TXT", name: "@", value: "new", ttl: 300 }], existing);
    const sets = rrsetChanges(existing, ops);
    expect(sets).toHaveLength(1);
    expect(sets[0]!.records.map((r) => r.value)).toEqual(["old", "new"]);
  });
});

describe("helpers", () => {
  it("quotes and unquotes TXT, splitting long strings", () => {
    const long = "a".repeat(300);
    const q = quoteTxt(long);
    expect(q).toMatch(/^"a{255}" "a{45}"$/);
    expect(unquoteTxt(q)).toBe(long);
    expect(quoteTxt('he said "hi"')).toBe('"he said \\"hi\\""');
  });

  it("requireCredentials throws invalid_credentials naming only the keys", () => {
    try {
      requireCredentials({ apiKey: " " }, ["apiKey", "apiSecret"], "X");
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ProviderApiError);
      expect((e as ProviderApiError).code).toBe("invalid_credentials");
      expect((e as Error).message).toContain("apiKey, apiSecret");
    }
  });

  it("scrub removes secrets", () => {
    expect(scrub("bad token sekret123", ["sekret123"])).toBe("bad token ***");
  });
});
