import { describe, expect, it } from "vitest";
import { FakeClock } from "@/kernel/clock.ts";
import type { ConnectApplicationId } from "../domain/application.ts";
import { SdkTokenSigner } from "./sdk-token.ts";

const appId = "app_1" as ConnectApplicationId;

describe("SdkTokenSigner", () => {
  it("round-trips claims", () => {
    const signer = new SdkTokenSigner("secret", new FakeClock());
    const { token, expiresIn } = signer.sign(appId, 3);
    expect(expiresIn).toBe(3600);
    expect(signer.verify(token)).toMatchObject({ sub: appId, sv: 3 });
  });

  it("rejects tampering and foreign keys", () => {
    const clock = new FakeClock();
    const { token } = new SdkTokenSigner("secret", clock).sign(appId, 1);
    const [h, b, s] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ sub: "app_2", sv: 1, iat: 0, exp: 9e9, jti: "x" })).toString("base64url");
    const signer = new SdkTokenSigner("secret", clock);
    expect(() => signer.verify(`${h}.${forged}.${s}`)).toThrow(/invalid token/);
    expect(() => new SdkTokenSigner("other", clock).verify(token)).toThrow(/invalid token/);
    expect(() => signer.verify(`${h}.${b}`)).toThrow(/invalid token/);
    expect(() => signer.verify("garbage")).toThrow(/invalid token/);
  });

  it("expires after an hour", () => {
    const clock = new FakeClock();
    const signer = new SdkTokenSigner("secret", clock);
    const { token } = signer.sign(appId, 1);
    clock.advanceBy(3599_000);
    expect(() => signer.verify(token)).not.toThrow();
    clock.advanceBy(1_000);
    expect(() => signer.verify(token)).toThrow(/expired/);
  });
});
