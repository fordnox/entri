import { DomainError, ForbiddenError } from "@/kernel/errors.ts";
import { isId } from "@/kernel/id.ts";
import type { UnitOfWork } from "@/kernel/uow.ts";
import type { ConnectApplication, ConnectApplicationId } from "../domain/application.ts";
import { InvalidSdkTokenError, type SdkTokenSigner } from "./sdk-token.ts";

class InvalidCredentialsError extends DomainError {
  constructor() {
    super("credentials.invalid", "unknown applicationId or wrong secret", 401);
  }
}

/**
 * The two halves of SDK auth: the integrator's server trades
 * `applicationId + secret` for a short-lived token, and every modal
 * request presents that token (plus the browser's Origin).
 */
export class SdkAuthService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly signer: SdkTokenSigner,
  ) {}

  async issueWithSecret(
    applicationId: string,
    secret: string,
  ): Promise<{ token: string; expiresIn: number }> {
    const app = isId("connectApplication", applicationId)
      ? await this.uow.read((tx) =>
          tx.connectApplications.findById(applicationId as ConnectApplicationId),
        )
      : null;
    if (!app || !app.verifySecret(secret)) throw new InvalidCredentialsError();
    return this.signer.sign(app.id, app.secretVersion);
  }

  /** Dashboard "test token" — the caller already proved workspace access. */
  issueFor(app: ConnectApplication): { token: string; expiresIn: number } {
    return this.signer.sign(app.id, app.secretVersion);
  }

  async authenticate(token: string, origin: string | null): Promise<ConnectApplication> {
    const claims = this.signer.verify(token);
    const app = await this.uow.read((tx) => tx.connectApplications.findById(claims.sub));
    if (!app || app.secretVersion !== claims.sv) {
      throw new InvalidSdkTokenError("token.invalid", "token was revoked — fetch a new one");
    }
    if (!app.allowsOrigin(origin)) {
      throw new ForbiddenError("origin_not_allowed");
    }
    return app;
  }
}
