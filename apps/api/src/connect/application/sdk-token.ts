import { createHmac, randomBytes } from "node:crypto";
import type { Clock } from "@/kernel/clock.ts";
import { DomainError } from "@/kernel/errors.ts";
import { secureStringEqual } from "@/kernel/secure-string-equal.ts";
import type { ConnectApplicationId } from "../domain/application.ts";

export const SDK_TOKEN_TTL_SECONDS = 3600;

export interface SdkTokenClaims {
  /** Application id. */
  sub: ConnectApplicationId;
  /** Application secret version at mint time. */
  sv: number;
  iat: number;
  exp: number;
  jti: string;
}

const HEADER = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");

export class InvalidSdkTokenError extends DomainError {
  constructor(code: "token.invalid" | "token.expired", message: string) {
    super(code, message, 401);
  }
}

/**
 * HS256 JWTs the SDK presents as `Authorization: Bearer`. The signing
 * key is derived from the API's auth secret with a fixed label, so no
 * extra env var is needed and the key never doubles as the cookie key.
 */
export class SdkTokenSigner {
  private readonly key: Buffer;

  constructor(
    authSecret: string,
    private readonly clock: Clock,
  ) {
    this.key = createHmac("sha256", authSecret).update("connect.sdk-token.v1").digest();
  }

  sign(applicationId: ConnectApplicationId, secretVersion: number): { token: string; expiresIn: number } {
    const iat = Math.floor(this.clock.now().getTime() / 1000);
    const claims: SdkTokenClaims = {
      sub: applicationId,
      sv: secretVersion,
      iat,
      exp: iat + SDK_TOKEN_TTL_SECONDS,
      jti: randomBytes(12).toString("base64url"),
    };
    const body = Buffer.from(JSON.stringify(claims)).toString("base64url");
    return {
      token: `${HEADER}.${body}.${this.mac(`${HEADER}.${body}`)}`,
      expiresIn: SDK_TOKEN_TTL_SECONDS,
    };
  }

  verify(token: string): SdkTokenClaims {
    const parts = token.split(".");
    if (parts.length !== 3 || parts[0] !== HEADER) {
      throw new InvalidSdkTokenError("token.invalid", "invalid token");
    }
    const [h, b, sig] = parts as [string, string, string];
    if (!secureStringEqual(this.mac(`${h}.${b}`), sig)) {
      throw new InvalidSdkTokenError("token.invalid", "invalid token");
    }
    let claims: SdkTokenClaims;
    try {
      claims = JSON.parse(Buffer.from(b, "base64url").toString("utf8")) as SdkTokenClaims;
    } catch {
      throw new InvalidSdkTokenError("token.invalid", "invalid token");
    }
    if (typeof claims.sub !== "string" || typeof claims.exp !== "number" || typeof claims.sv !== "number") {
      throw new InvalidSdkTokenError("token.invalid", "invalid token");
    }
    if (claims.exp <= Math.floor(this.clock.now().getTime() / 1000)) {
      throw new InvalidSdkTokenError("token.expired", "token expired — fetch a new one from your server");
    }
    return claims;
  }

  private mac(input: string): string {
    return createHmac("sha256", this.key).update(input).digest("base64url");
  }
}
