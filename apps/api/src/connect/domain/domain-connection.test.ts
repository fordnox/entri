import { describe, expect, it } from "vitest";
import { FakeClock } from "@/kernel/clock.ts";
import type { WorkspaceId } from "@/workspaces/domain/workspace.ts";
import type { ConnectApplicationId } from "./application.ts";
import { parseUserDomain, resolveRecords } from "./dns-records.ts";
import { DomainConnection } from "./domain-connection.ts";

function make(clock = new FakeClock()) {
  const domain = parseUserDomain("acme.com");
  return DomainConnection.create(
    {
      applicationId: "app_1" as ConnectApplicationId,
      workspaceId: "ws_1" as WorkspaceId,
      domain,
      records: resolveRecords(
        [
          { type: "A", host: "@", value: "1.2.3.4" },
          { type: "CNAME", host: "www", value: "c.host.com" },
        ],
        domain,
      ),
      providerKey: "cloudflare",
      userId: " cus_1 ",
      metadata: { plan: "pro" },
    },
    clock,
  );
}

const types = (c: DomainConnection) => c.pullEvents().map((e) => e.type);

describe("DomainConnection", () => {
  it("starts pending and emits created", () => {
    const c = make();
    expect(c.status).toBe("pending");
    expect(c.snapshot().userId).toBe("cus_1");
    expect(types(c)).toEqual(["connect.domain.created"]);
  });

  it("goes pending → propagating → connected once", () => {
    const clock = new FakeClock();
    const c = make(clock);
    c.pullEvents();
    c.markAutomaticSetupSucceeded(clock);
    expect(c.status).toBe("propagating");
    expect(c.records.map((r) => r.status)).toEqual(["propagating", "propagating"]);

    c.applyVerification(
      [
        { observed: ["1.2.3.4"], matches: true },
        { observed: [], matches: false },
      ],
      clock,
    );
    expect(c.status).toBe("propagating");
    expect(c.records.map((r) => r.status)).toEqual(["verified", "propagating"]);
    expect(types(c)).toEqual([]);

    const all = [
      { observed: ["1.2.3.4"], matches: true },
      { observed: ["c.host.com"], matches: true },
    ];
    c.applyVerification(all, clock);
    expect(c.status).toBe("connected");
    expect(c.snapshot().connectedAt).not.toBeNull();
    expect(types(c)).toEqual(["connect.domain.connected"]);

    c.applyVerification(all, clock);
    expect(types(c)).toEqual([]);
  });

  it("flags mismatches and downgrades a connected domain", () => {
    const clock = new FakeClock();
    const c = make(clock);
    c.applyVerification(
      [
        { observed: ["1.2.3.4"], matches: true },
        { observed: ["c.host.com"], matches: true },
      ],
      clock,
    );
    expect(c.status).toBe("connected");
    c.applyVerification(
      [
        { observed: ["9.9.9.9"], matches: false },
        { observed: ["c.host.com"], matches: true },
      ],
      clock,
    );
    expect(c.status).toBe("propagating");
    expect(c.records[0]).toMatchObject({ status: "mismatch", observed: ["9.9.9.9"] });
  });

  it("records automation failure and allows falling back to manual", () => {
    const clock = new FakeClock();
    const c = make(clock);
    c.pullEvents();
    c.markAutomaticSetupFailed("bad token", clock);
    expect(c.status).toBe("failed");
    expect(types(c)).toEqual(["connect.domain.setup_failed"]);
    c.markManualSetup(clock);
    expect(c.snapshot()).toMatchObject({ status: "propagating", setupMethod: "manual", lastError: null });
  });

  it("refuses setup changes once connected", () => {
    const clock = new FakeClock();
    const c = make(clock);
    c.applyVerification(
      [
        { observed: ["1.2.3.4"], matches: true },
        { observed: ["c.host.com"], matches: true },
      ],
      clock,
    );
    expect(() => c.markManualSetup(clock)).toThrow(/already connected/);
  });

  it("rejects oversized metadata", () => {
    const domain = parseUserDomain("acme.com");
    expect(() =>
      DomainConnection.create(
        {
          applicationId: "app_1" as ConnectApplicationId,
          workspaceId: "ws_1" as WorkspaceId,
          domain,
          records: [],
          providerKey: null,
          metadata: { blob: "x".repeat(3000) },
        },
        new FakeClock(),
      ),
    ).toThrow(/2 KB/);
  });

  it("carries a snapshot on disconnect", () => {
    const clock = new FakeClock();
    const c = make(clock);
    c.pullEvents();
    c.markDeleted(clock);
    const [e] = c.pullEvents() as unknown as [{ type: string; snapshot: { domain: string } }];
    expect(e.type).toBe("connect.domain.disconnected");
    expect(e.snapshot.domain).toBe("acme.com");
  });
});
