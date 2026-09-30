import type {
  DnsRecordsConfig,
  SetupMethod,
} from "@orbit/shared/connect";

export type ConnectStep =
  | "domain"
  | "provider"
  | "credentials"
  | "manual"
  | "verifying"
  | "success"
  | "error";

export interface ConnectSuccess {
  domain: string;
  connectionId: string;
  setupType: SetupMethod;
  /** Provider display name, or null when it couldn't be detected. */
  provider: string | null;
}

export interface ConnectCloseResult {
  domain: string | null;
  connectionId: string | null;
  success: boolean;
  setupType: SetupMethod | null;
  lastStatus: ConnectStep;
}

export interface ConnectConfig {
  applicationId: string;
  /** Short-lived `auth_token` minted server-side via `POST /v1/connect/token`. */
  token: string;
  dnsRecords: DnsRecordsConfig;
  prefilledDomain?: string;
  /** Your identifier for the end user, echoed back in webhooks. */
  userId?: string;
  /** Free-form data echoed back in webhooks (max 2 KB serialized). */
  metadata?: Record<string, unknown>;
  /** Default: origin the script was loaded from, else `window.location.origin`. */
  apiOrigin?: string;
  /** Skip automatic setup even when the provider supports it. */
  forceManualSetup?: boolean;
  onSuccess?: (result: ConnectSuccess) => void;
  onClose?: (result: ConnectCloseResult) => void;
  onStepChange?: (step: ConnectStep) => void;
}

export interface ConnectHandle {
  close(): void;
}
