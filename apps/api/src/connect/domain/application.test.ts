import { describe, expect, it } from "vitest";
import { FakeClock } from "@/kernel/clock.ts";
import type { WorkspaceId } from "@/workspaces/domain/workspace.ts";
import { ConnectApplication } from "./application.ts";

const ws = "ws_1" as WorkspaceId;

describe("ConnectApplication", () => {
  it("hashes the secret and verifies it", () => {
    const { application, secret } = ConnectApplication.create({ workspaceId: ws, name: "Acme" }, new FakeClock());
    expect(secret).toMatch(/^sk_[A-Za-z0-9_-]{43}$/);
    expect(application.secretHash).not.toContain(secret);
    expect(application.secretPreview).toBe(secret.slice(-4));
    expect(application.verifySecret(secret)).toBe(true);
    expect(application.verifySecret(`${secret}x`)).toBe(false);
    expect(application.webhookSecret).toMatch(/^whsec_/);
  });

  it("rotation invalidates the old secret and bumps the version", () => {
    const clock = new FakeClock();
    const { application, secret } = ConnectApplication.create({ workspaceId: ws, name: "Acme" }, clock);
    const next = application.rotateSecret(clock);
    expect(application.verifySecret(secret)).toBe(false);
    expect(application.verifySecret(next)).toBe(true);
    expect(application.secretVersion).toBe(2);
  });

  it("normalizes origins and enforces the allow-list", () => {
    const { application } = ConnectApplication.create(
      { workspaceId: ws, name: "Acme", allowedOrigins: ["https://app.acme.com/path", " https://app.acme.com "] },
      new FakeClock(),
    );
    expect(application.allowedOrigins).toEqual(["https://app.acme.com"]);
    expect(application.allowsOrigin("https://app.acme.com")).toBe(true);
    expect(application.allowsOrigin("https://evil.com")).toBe(false);
    // Server-to-server calls carry no Origin header.
    expect(application.allowsOrigin(null)).toBe(true);
  });

  it.each([
    [{ name: " " }, /name is required/],
    [{ name: "A", allowedOrigins: ["notaurl"] }, /valid origin/],
    [{ name: "A", webhookUrl: "ftp://x.com" }, /http or https/],
  ])("rejects %j", (settings, message) => {
    expect(() => ConnectApplication.create({ workspaceId: ws, ...settings }, new FakeClock())).toThrow(message);
  });

  it("emits updated only on real change", () => {
    const clock = new FakeClock();
    const { application } = ConnectApplication.create({ workspaceId: ws, name: "Acme" }, clock);
    application.pullEvents();
    application.update({ name: "Acme" }, clock);
    expect(application.pullEvents()).toHaveLength(0);
    application.update({ name: "Acme 2", webhookUrl: "https://hooks.acme.com/x" }, clock);
    expect(application.pullEvents().map((e) => e.type)).toEqual(["connect.application.updated"]);
  });
});
