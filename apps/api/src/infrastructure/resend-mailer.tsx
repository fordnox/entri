import { render } from "@react-email/components";
import { Resend } from "resend";
// +feature:auth-magic-link
import { SignInMagicLinkEmail } from "@/emails/magic-link-email.tsx";
// -feature:auth-magic-link
import { WorkspaceInviteEmail } from "@/emails/workspace-invite-email.tsx";
import { ChangeEmailVerificationEmail } from "@/emails/change-email-verification-email.tsx";
import { ChangeEmailNoticeEmail } from "@/emails/change-email-notice-email.tsx";
import { AccountDeletionVerificationEmail } from "@/emails/account-deletion-verification-email.tsx";
import {
  type AccountDeletionVerificationEmail as AccountDeletionDto,
  // +feature:auth-magic-link
  captureDevMagicLink,
  // -feature:auth-magic-link
  type ChangeEmailVerificationEmail as ChangeEmailDto,
  type ChangeEmailNoticeEmail as ChangeEmailNoticeDto,
  ConsoleMailer,
  type InviteEmail,
  // +feature:auth-magic-link
  type MagicLinkEmail,
  // -feature:auth-magic-link
  type Mailer,
} from "@/infrastructure/mailer.ts";

export class ResendMailer implements Mailer {
  private readonly client: Resend;

  constructor(
    apiKey: string,
    private readonly from: string,
  ) {
    this.client = new Resend(apiKey);
  }

  // +feature:auth-magic-link
  async sendMagicLink(email: MagicLinkEmail): Promise<void> {
    captureDevMagicLink(email.to, email.link);
    const to = email.to.trim();
    const expiresAtLabel = email.expiresAt.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
    const node = (
      <SignInMagicLinkEmail magicLinkUrl={email.link} expiresAtLabel={expiresAtLabel} />
    );
    const html = await render(node);
    const text = await render(node, { plainText: true });
    const { error } = await this.client.emails.send({
      from: this.from,
      to,
      subject: "Your Orbit sign-in link",
      html,
      text,
    });
    if (error) {
      throw new Error(error.message);
    }
  }
  // -feature:auth-magic-link

  async sendInvite(email: InviteEmail): Promise<void> {
    const to = email.to.trim();
    const node = <WorkspaceInviteEmail workspaceName={email.workspaceName} inviteUrl={email.link} />;
    const html = await render(node);
    const text = await render(node, { plainText: true });
    const { error } = await this.client.emails.send({
      from: this.from,
      to,
      subject: `You're invited to ${email.workspaceName} on Orbit`,
      html,
      text,
    });
    if (error) {
      throw new Error(error.message);
    }
  }

  async sendChangeEmailVerification(email: ChangeEmailDto): Promise<void> {
    const to = email.to.trim();
    const node = (
      <ChangeEmailVerificationEmail
        verifyUrl={email.link}
        currentEmail={email.currentEmail}
      />
    );
    const html = await render(node);
    const text = await render(node, { plainText: true });
    const { error } = await this.client.emails.send({
      from: this.from,
      to,
      subject: "Confirm your new Orbit email",
      html,
      text,
    });
    if (error) throw new Error(error.message);
  }

  async sendChangeEmailNotice(email: ChangeEmailNoticeDto): Promise<void> {
    const to = email.to.trim();
    const node = (
      <ChangeEmailNoticeEmail
        newEmail={email.newEmail}
        supportLink={email.supportLink}
      />
    );
    const html = await render(node);
    const text = await render(node, { plainText: true });
    const { error } = await this.client.emails.send({
      from: this.from,
      to,
      subject: "Your Orbit email change was requested",
      html,
      text,
    });
    if (error) throw new Error(error.message);
  }

  async sendAccountDeletionVerification(email: AccountDeletionDto): Promise<void> {
    const to = email.to.trim();
    const node = <AccountDeletionVerificationEmail verifyUrl={email.link} />;
    const html = await render(node);
    const text = await render(node, { plainText: true });
    const { error } = await this.client.emails.send({
      from: this.from,
      to,
      subject: "Confirm deleting your Orbit account",
      html,
      text,
    });
    if (error) throw new Error(error.message);
  }

}

export function createDefaultMailer(): Mailer {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  /**
   * Local dev: magic links are captured for `/v1/dev/last-magic-link` and logged;
   * we do not call Resend unless you explicitly opt in (`RESEND_SEND_IN_DEV=1`).
   * Otherwise a copied `.env` with `RESEND_API_KEY` makes every sign-in fail when
   * Resend rejects the send (unverified domain, etc.).
   */
  const useResend =
    Boolean(apiKey) &&
    (process.env.NODE_ENV === "production" ||
      process.env.RESEND_SEND_IN_DEV === "1");
  if (useResend && apiKey) {
    const from = process.env.RESEND_FROM?.trim();
    if (!from) {
      throw new Error(
        'RESEND_FROM is required when sending with Resend (e.g. "Orbit <hello@yourdomain.com>"). Unset RESEND_API_KEY or set RESEND_SEND_IN_DEV=0 to use the console mailer.',
      );
    }
    return new ResendMailer(apiKey, from);
  }
  return new ConsoleMailer();
}
