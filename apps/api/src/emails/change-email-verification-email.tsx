import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import { orbitEmailStyles } from "@/emails/orbit-email-styles.ts";

export interface ChangeEmailVerificationEmailProps {
  verifyUrl: string;
  currentEmail: string;
}

export function ChangeEmailVerificationEmail({
  verifyUrl,
  currentEmail,
}: ChangeEmailVerificationEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>Confirm your new Orbit email</Preview>
      <Body style={orbitEmailStyles.page}>
        <Container style={orbitEmailStyles.container}>
          <Section style={orbitEmailStyles.card}>
            <Text style={orbitEmailStyles.eyebrow}>Orbit</Text>
            <Heading as="h1" style={orbitEmailStyles.heading}>
              Confirm your new email
            </Heading>
            <Text style={orbitEmailStyles.text}>
              Someone (hopefully you) asked to change the email on the Orbit account registered to{" "}
              <strong>{currentEmail}</strong>.
            </Text>
            <Text style={orbitEmailStyles.muted}>
              Click below to confirm the change to this address.
            </Text>
            <Button href={verifyUrl} style={orbitEmailStyles.button}>
              Confirm new email
            </Button>
            <Text style={orbitEmailStyles.footer}>
              If you did not request this, you can safely ignore this email. Your address will not
              change.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
