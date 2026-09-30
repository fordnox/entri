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

export interface AccountDeletionVerificationEmailProps {
  verifyUrl: string;
}

export function AccountDeletionVerificationEmail({
  verifyUrl,
}: AccountDeletionVerificationEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>Confirm deleting your Orbit account</Preview>
      <Body style={orbitEmailStyles.page}>
        <Container style={orbitEmailStyles.container}>
          <Section style={orbitEmailStyles.card}>
            <Text style={orbitEmailStyles.eyebrow}>Orbit</Text>
            <Heading as="h1" style={orbitEmailStyles.heading}>
              Confirm account deletion
            </Heading>
            <Text style={orbitEmailStyles.text}>
              You requested to delete your Orbit account. Clicking the button below will
              permanently delete your account, your workspace memberships, and any workspace where
              you are the only member.
            </Text>
            <Button
              href={verifyUrl}
              style={{ ...orbitEmailStyles.button, backgroundColor: "#b42318" }}
            >
              Delete my account
            </Button>
            <Text style={orbitEmailStyles.footer}>
              If you did not request this, ignore this email and your account will remain active.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
