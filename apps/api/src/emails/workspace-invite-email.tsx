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

export interface WorkspaceInviteEmailProps {
  workspaceName: string;
  inviteUrl: string;
}

export function WorkspaceInviteEmail({ workspaceName, inviteUrl }: WorkspaceInviteEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>You're invited to {workspaceName} on Orbit</Preview>
      <Body style={orbitEmailStyles.page}>
        <Container style={orbitEmailStyles.container}>
          <Section style={orbitEmailStyles.card}>
            <Text style={orbitEmailStyles.eyebrow}>Orbit</Text>
            <Heading as="h1" style={orbitEmailStyles.heading}>
              You're invited to a workspace
            </Heading>
            <Text style={orbitEmailStyles.text}>
              You've been invited to join <strong>{workspaceName}</strong> on Orbit.
            </Text>
            <Text style={orbitEmailStyles.text}>
              Accept the invitation to start collaborating in calmer, room-sized spaces.
            </Text>
            <Button href={inviteUrl} style={orbitEmailStyles.button}>
              Accept invitation
            </Button>
            <Text style={orbitEmailStyles.footer}>
              If you were not expecting this invitation, you can ignore this email.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
