/**
 * IIFE entry — served as `/sdk/connect.js`. Defines `window.Connect`.
 * The default `apiOrigin` is the origin this script was loaded from.
 */
import { setDefaultApiOrigin } from "./config.ts";
import { close, showConnect, version } from "./index.ts";

export interface ConnectGlobal {
  showConnect: typeof showConnect;
  close: typeof close;
  version: string;
}

declare global {
  interface Window {
    Connect: ConnectGlobal;
  }
}

const script = document.currentScript as HTMLScriptElement | null;
if (script?.src) {
  try {
    setDefaultApiOrigin(new URL(script.src, window.location.href).origin);
  } catch {
    /* fall back to window.location.origin */
  }
}

window.Connect = { showConnect, close, version };
