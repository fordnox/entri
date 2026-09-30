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

export interface SignInMagicLinkEmailProps {
  magicLinkUrl: string;
  expiresAtLabel: string;
}

export function SignInMagicLinkEmail({ magicLinkUrl, expiresAtLabel }: SignInMagicLinkEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>Sign in to Orbit</Preview>
      <Body style={orbitEmailStyles.page}>
        <Container style={orbitEmailStyles.container}>
          <Section style={orbitEmailStyles.card}>
            <Text style={orbitEmailStyles.eyebrow}>Orbit</Text>
            <Heading as="h1" style={orbitEmailStyles.heading}>
              Sign in to your workspace
            </Heading>
            <Text style={orbitEmailStyles.text}>
              Use the button below to finish signing in. This link is single-use and expires soon.
            </Text>
            <Text style={orbitEmailStyles.muted}>Expires around {expiresAtLabel}.</Text>
            <Button href={magicLinkUrl} style={orbitEmailStyles.button}>
              Sign in to Orbit
            </Button>
            <Text style={orbitEmailStyles.footer}>
              If you did not request this email, you can safely ignore it.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
