/**
 * @orbit/connect-js — embeddable modal that lets an end user connect a
 * domain they own. See docs/connect.md for the full contract.
 */
import { resolveApiOrigin } from "./config.ts";
import { ConnectSession } from "./modal/session.ts";
import type { ConnectConfig, ConnectHandle } from "./types.ts";

export { ConnectApiError } from "./api.ts";
export { version } from "./version.ts";
export type {
  ConnectCloseResult,
  ConnectConfig,
  ConnectHandle,
  ConnectStep,
  ConnectSuccess,
} from "./types.ts";
export type {
  DnsRecordInput,
  DnsRecordsConfig,
  DnsRecordType,
  SetupMethod,
} from "@orbit/shared/connect";

let current: ConnectSession | null = null;

/**
 * Open the Connect modal. Any modal already open is closed first (its
 * `onClose` fires). Returns a handle whose `close()` closes this modal.
 */
export function showConnect(config: ConnectConfig): ConnectHandle {
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("[Connect] showConnect() must be called in a browser.");
  }
  if (!config || typeof config !== "object") throw new TypeError("[Connect] showConnect() requires a config object.");
  if (!config.applicationId) throw new TypeError("[Connect] `applicationId` is required.");
  if (!config.token) throw new TypeError("[Connect] `token` is required.");
  if (!config.dnsRecords) throw new TypeError("[Connect] `dnsRecords` is required.");

  close();
  const session = new ConnectSession(config, resolveApiOrigin(config.apiOrigin));
  current = session;
  const start = () => {
    if (current === session && !session.isClosed) session.open();
  };
  if (document.body) start();
  else document.addEventListener("DOMContentLoaded", start, { once: true });

  return {
    close: () => {
      session.close();
      if (current === session) current = null;
    },
  };
}

/** Close the currently open modal, if any. */
export function close(): void {
  const s = current;
  current = null;
  s?.close();
}
