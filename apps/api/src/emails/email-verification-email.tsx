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

export interface EmailVerificationEmailProps {
  verifyUrl: string;
}

export function EmailVerificationEmail({ verifyUrl }: EmailVerificationEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>Verify your Orbit email</Preview>
      <Body style={orbitEmailStyles.page}>
        <Container style={orbitEmailStyles.container}>
          <Section style={orbitEmailStyles.card}>
            <Text style={orbitEmailStyles.eyebrow}>Orbit</Text>
            <Heading as="h1" style={orbitEmailStyles.heading}>
              Verify your email
            </Heading>
            <Text style={orbitEmailStyles.text}>
              Confirm this address to finish creating your Orbit account.
            </Text>
            <Button href={verifyUrl} style={orbitEmailStyles.button}>
              Verify email
            </Button>
            <Text style={orbitEmailStyles.footer}>
              If you did not sign up for Orbit, you can safely ignore this email.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
