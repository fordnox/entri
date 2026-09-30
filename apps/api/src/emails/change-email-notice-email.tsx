import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import { orbitEmailStyles } from "@/emails/orbit-email-styles.ts";

export interface ChangeEmailNoticeEmailProps {
  newEmail: string;
  supportLink?: string;
}

export function ChangeEmailNoticeEmail({
  newEmail,
  supportLink,
}: ChangeEmailNoticeEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>A request to change your Orbit email was made</Preview>
      <Body style={orbitEmailStyles.page}>
        <Container style={orbitEmailStyles.container}>
          <Section style={orbitEmailStyles.card}>
            <Text style={orbitEmailStyles.eyebrow}>Orbit</Text>
            <Heading as="h1" style={orbitEmailStyles.heading}>
              Heads up — an email change was requested
            </Heading>
            <Text style={orbitEmailStyles.text}>
              Someone asked to change the email on your Orbit account to{" "}
              <strong>{newEmail}</strong>. A verification link has been sent to
              that address; the change will complete only if it's confirmed
              there.
            </Text>
            <Text style={orbitEmailStyles.muted}>
              If this was you, no further action is needed — finish the change
              from the link sent to the new address.
            </Text>
            <Text style={orbitEmailStyles.text}>
              <strong>If this was NOT you</strong>, someone has access to your
              account. Sign in, reset your credentials, and review active
              sessions immediately.
              {supportLink ? (
                <>
                  {" "}
                  Need help? <Link href={supportLink}>Contact support</Link>.
                </>
              ) : null}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
