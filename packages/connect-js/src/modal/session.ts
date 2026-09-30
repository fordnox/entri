import type {
  CheckDomainResponse,
  ConnectApplicationPublicDTO,
  DnsProviderDTO,
  DnsRecordStatus,
  DomainConnectionDTO,
  ResolvedDnsRecordDTO,
  SetupMethod,
} from "@orbit/shared/connect";
import { ConnectApiError, FATAL_CODES, createApi, type ConnectApi } from "../api.ts";
import type { ConnectCloseResult, ConnectConfig, ConnectStep, ConnectSuccess } from "../types.ts";
import { copyText, focusables, h, svg, type Child } from "./dom.ts";
import { normalizeDomain } from "./domain.ts";
import { icons } from "./icons.ts";
import { styles } from "./styles.ts";

const POLL_INTERVAL_MS = 5_000;
const POLL_WINDOW_MS = 10 * 60_000;
const TITLE_ID = "cx-title";
const DESC_ID = "cx-desc";

const STATUS_LABEL: Record<DnsRecordStatus, string> = {
  pending: "Pending",
  propagating: "Propagating",
  verified: "Verified",
  mismatch: "Mismatch",
};

interface FatalState {
  title: string;
  message: string;
  retry: (() => void) | null;
}

/** One open modal. Created by `showConnect`, discarded on close. */
export class ConnectSession {
  private readonly config: ConnectConfig;
  private readonly api: ConnectApi;

  private host: HTMLElement | null = null;
  private shadow: ShadowRoot | null = null;
  private dialog: HTMLElement | null = null;
  private headerBrand: HTMLElement | null = null;
  private progressEl: HTMLElement | null = null;
  private bodyEl: HTMLElement | null = null;
  private liveEl: HTMLElement | null = null;

  private previousFocus: Element | null = null;
  private previousOverflow = "";
  private closed = false;

  // flow state
  private step: ConnectStep = "domain";
  private progressStep = 0;
  private app: ConnectApplicationPublicDTO | null = null;
  private domainInput: string;
  private check: CheckDomainResponse | null = null;
  private connection: DomainConnectionDTO | null = null;
  private setupType: SetupMethod | null = null;
  private busy = false;
  private inlineError: string | null = null;
  private fieldError: string | null = null;
  private credentials: Record<string, string> = {};
  private fatal: FatalState | null = null;
  private successFired = false;
  /** Focus key to restore after a busy re-render disabled the focused control. */
  private restoreKey: string | null = null;

  // polling
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private pollStartedAt = 0;
  private pollTimedOut = false;
  private pollInFlight = false;
  private pollNotice: string | null = null;
  private copyTimers = new Set<ReturnType<typeof setTimeout>>();

  constructor(config: ConnectConfig, apiOrigin: string) {
    this.config = config;
    this.api = createApi(apiOrigin, config.token);
    this.domainInput = config.prefilledDomain ?? "";
  }

  // ── lifecycle ──────────────────────────────────────────────────────

  open(): void {
    this.previousFocus = document.activeElement;
    this.previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";

    const host = document.createElement("div");
    host.setAttribute("data-connect-modal", "");
    const shadow = host.attachShadow({ mode: "open" });
    shadow.appendChild(h("style", null, styles));

    this.headerBrand = h("div", { class: "brand" });
    this.progressEl = h("div", { class: "progress", "aria-hidden": "true" });
    this.bodyEl = h("div", { class: "body" });
    this.liveEl = h("div", { class: "sr-only", "aria-live": "polite", "aria-atomic": "true" });

    const closeBtn = h(
      "button",
      { class: "icon-btn", type: "button", "aria-label": "Close", onclick: () => this.close() },
      svg(icons.close),
    );

    this.dialog = h(
      "div",
      {
        class: "dialog",
        role: "dialog",
        "aria-modal": "true",
        "aria-labelledby": TITLE_ID,
        "aria-describedby": DESC_ID,
        tabindex: "-1",
      },
      h("div", { class: "header" }, this.headerBrand, closeBtn),
      this.progressEl,
      this.bodyEl,
      h("div", { class: "footer" }, svg(icons.lock), "Secure connection · credentials are never stored"),
      this.liveEl,
    );

    const backdrop = h("div", { class: "backdrop" }, this.dialog);
    backdrop.addEventListener("mousedown", (e) => {
      if (e.target === backdrop) this.close();
    });
    shadow.appendChild(backdrop);
    shadow.addEventListener("keydown", this.onKeyDown as EventListener);

    this.host = host;
    this.shadow = shadow;
    document.body.appendChild(host);

    this.renderBrand();
    this.transition("domain");
    void this.loadApplication();
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.stopPolling();
    for (const t of this.copyTimers) clearTimeout(t);
    this.copyTimers.clear();
    this.shadow?.removeEventListener("keydown", this.onKeyDown as EventListener);
    this.host?.remove();
    this.host = this.shadow = this.dialog = this.bodyEl = null;
    document.documentElement.style.overflow = this.previousOverflow;

    const prev = this.previousFocus as HTMLElement | null;
    if (prev && typeof prev.focus === "function" && prev.isConnected) {
      try {
        prev.focus({ preventScroll: true });
      } catch {
        /* ignore */
      }
    }

    const result: ConnectCloseResult = {
      domain: this.connection?.domain ?? this.check?.domain ?? null,
      connectionId: this.connection?.id ?? null,
      success: this.step === "success",
      setupType: this.setupType,
      lastStatus: this.step,
    };
    this.emit("onConnectClose", result, this.config.onClose);
  }

  get isClosed(): boolean {
    return this.closed;
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      this.close();
      return;
    }
    if (e.key !== "Tab" || !this.dialog || !this.shadow) return;
    const items = focusables(this.dialog);
    if (items.length === 0) {
      e.preventDefault();
      this.dialog.focus();
      return;
    }
    const first = items[0]!;
    const last = items[items.length - 1]!;
    const active = this.shadow.activeElement;
    if (e.shiftKey && (active === first || active === this.dialog || !active)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || !active)) {
      e.preventDefault();
      first.focus();
    }
  };

  private emit<T>(eventName: string, detail: T, cb?: (d: T) => void): void {
    try {
      cb?.(detail);
    } catch (err) {
      console.error(`[Connect] ${eventName} callback threw`, err);
    }
    try {
      window.dispatchEvent(new CustomEvent(eventName, { detail }));
    } catch {
      /* ignore */
    }
  }

  // ── state transitions ─────────────────────────────────────────────

  private transition(step: ConnectStep): void {
    if (this.closed) return;
    if (step !== "verifying") this.stopPolling();
    const changed = step !== this.step || !this.bodyEl?.hasChildNodes();
    this.step = step;
    this.inlineError = null;
    this.fieldError = null;
    this.busy = false;
    if (step !== "error") {
      this.progressStep = { domain: 0, provider: 1, credentials: 1, manual: 1, verifying: 2, success: 3 }[step];
    }
    this.render(true);
    if (changed) this.emit("onConnectStepChange", step, this.config.onStepChange);
  }

  private fail(err: unknown, retry: (() => void) | null): void {
    const e = toApiError(err);
    this.fatal = {
      title: fatalTitle(e),
      message: e.message,
      retry: e.code === "network" || e.status >= 500 ? retry : null,
    };
    this.transition("error");
  }

  private provider(): DnsProviderDTO | null {
    return this.connection?.provider ?? this.check?.provider ?? null;
  }

  private canAutomate(): boolean {
    const p = this.provider();
    return !!p && p.automated && !this.config.forceManualSetup;
  }

  private async loadApplication(): Promise<void> {
    try {
      const app = await this.api.getApplication();
      if (this.closed) return;
      this.app = app;
      if (app.applicationId !== this.config.applicationId) {
        console.warn(
          `[Connect] token belongs to application ${app.applicationId}, but showConnect was called with ${this.config.applicationId}.`,
        );
      }
      this.renderBrand();
    } catch (err) {
      if (this.closed) return;
      const e = toApiError(err);
      if (FATAL_CODES.has(e.code)) this.fail(e, null);
      // otherwise: branding is cosmetic — keep going with the fallback header
    }
  }

  private async submitDomain(): Promise<void> {
    if (this.busy) return;
    const parsed = normalizeDomain(this.domainInput);
    if ("error" in parsed) {
      this.fieldError = parsed.error;
      this.render();
      return;
    }
    this.setBusy(true);
    try {
      const check = await this.api.checkDomain({ domain: parsed.domain });
      if (this.closed) return;
      this.check = check;
      this.domainInput = check.domain;
      const connection = await this.api.createConfiguration({
        domain: check.domain,
        dnsRecords: this.config.dnsRecords,
        userId: this.config.userId,
        metadata: this.config.metadata,
      });
      if (this.closed) return;
      this.connection = connection;
      this.setupType = null;
      this.credentials = {};
      if (connection.status === "connected") {
        this.setupType = connection.setupMethod ?? "manual";
        this.goSuccess();
      } else if (this.canAutomate()) {
        this.transition("provider");
      } else {
        this.transition("manual");
      }
    } catch (err) {
      if (this.closed) return;
      const e = toApiError(err);
      if (e.code === "domain.invalid") {
        this.busy = false;
        this.fieldError = e.message;
        this.render();
      } else {
        this.fail(e, () => this.transition("domain"));
      }
    }
  }

  private async submitCredentials(): Promise<void> {
    const conn = this.connection;
    const p = this.provider();
    if (this.busy || !conn || !p) return;
    const missing = p.credentialFields.find((f) => !(this.credentials[f.key] ?? "").trim());
    if (missing) {
      this.inlineError = `${missing.label} is required.`;
      this.render();
      return;
    }
    this.setBusy(true);
    try {
      const creds: Record<string, string> = {};
      for (const f of p.credentialFields) creds[f.key] = (this.credentials[f.key] ?? "").trim();
      const updated = await this.api.automate(conn.id, { credentials: creds });
      if (this.closed) return;
      this.connection = updated;
      if (updated.status === "failed") {
        this.busy = false;
        this.inlineError = updated.lastError ?? `${p.name} rejected the request.`;
        this.render();
        return;
      }
      this.credentials = {};
      this.setupType = "automatic";
      this.startVerifying();
    } catch (err) {
      if (this.closed) return;
      const e = toApiError(err);
      if (FATAL_CODES.has(e.code)) {
        this.fail(e, null);
        return;
      }
      this.busy = false;
      this.inlineError = e.message;
      this.render();
    }
  }

  private async submitManual(): Promise<void> {
    const conn = this.connection;
    if (this.busy || !conn) return;
    this.setBusy(true);
    try {
      this.connection = await this.api.markManual(conn.id);
      if (this.closed) return;
      this.setupType = "manual";
      this.startVerifying();
    } catch (err) {
      if (this.closed) return;
      const e = toApiError(err);
      if (FATAL_CODES.has(e.code)) {
        this.fail(e, null);
        return;
      }
      this.busy = false;
      this.inlineError = e.message;
      this.render();
    }
  }

  private startVerifying(): void {
    this.pollStartedAt = Date.now();
    this.pollTimedOut = false;
    this.pollNotice = null;
    this.transition("verifying");
    void this.poll();
  }

  private checkAgain(): void {
    this.pollStartedAt = Date.now();
    this.pollTimedOut = false;
    this.render();
    void this.poll();
  }

  private stopPolling(): void {
    if (this.pollTimer) clearTimeout(this.pollTimer);
    this.pollTimer = null;
  }

  private async poll(): Promise<void> {
    const conn = this.connection;
    if (this.closed || this.step !== "verifying" || !conn || this.pollInFlight) return;
    this.stopPolling();
    this.pollInFlight = true;
    try {
      const updated = await this.api.verify(conn.id);
      if (this.closed || this.step !== "verifying") return;
      this.connection = updated;
      this.pollNotice = null;
      if (updated.status === "connected") {
        this.goSuccess();
        return;
      }
      if (updated.status === "failed" && this.setupType === "automatic") {
        this.inlineError = updated.lastError ?? "Automatic setup failed.";
        this.render();
        return;
      }
    } catch (err) {
      if (this.closed || this.step !== "verifying") return;
      const e = toApiError(err);
      if (FATAL_CODES.has(e.code)) {
        this.fail(e, null);
        return;
      }
      this.pollNotice = "Having trouble checking right now — retrying.";
    } finally {
      this.pollInFlight = false;
    }
    if (Date.now() - this.pollStartedAt >= POLL_WINDOW_MS) {
      this.pollTimedOut = true;
    } else {
      this.pollTimer = setTimeout(() => void this.poll(), POLL_INTERVAL_MS);
    }
    this.render();
  }

  private goSuccess(): void {
    const conn = this.connection!;
    this.setupType = this.setupType ?? conn.setupMethod ?? "manual";
    this.transition("success");
    if (!this.successFired) {
      this.successFired = true;
      const result: ConnectSuccess = {
        domain: conn.domain,
        connectionId: conn.id,
        setupType: this.setupType,
        provider: conn.provider?.name ?? this.check?.provider?.name ?? null,
      };
      this.emit("onConnectSuccess", result, this.config.onSuccess);
    }
  }

  private setBusy(busy: boolean): void {
    this.busy = busy;
    this.inlineError = null;
    this.fieldError = null;
    this.render();
  }

  // ── rendering ─────────────────────────────────────────────────────

  private renderBrand(): void {
    if (!this.headerBrand) return;
    const app = this.app;
    const iconEl = h("div", { class: "brand-icon", "aria-hidden": "true" });
    if (app?.iconUrl) {
      const img = h("img", { src: app.iconUrl, alt: "" });
      img.addEventListener("error", () => {
        img.remove();
        iconEl.textContent = initial(app.name);
      });
      iconEl.appendChild(img);
    } else if (app) {
      iconEl.textContent = initial(app.name);
    } else {
      iconEl.appendChild(svg(icons.globe));
    }
    this.headerBrand.replaceChildren(
      iconEl,
      app ? h("span", { class: "brand-name" }, app.name) : h("span", { class: "brand-skeleton" }),
    );
  }

  /**
   * Re-renders the body for the current step. On a step change focus
   * moves to the step's primary field (or heading); on a same-step
   * re-render focus is restored to the element with the same `data-k`.
   */
  private render(stepChanged = false): void {
    const body = this.bodyEl;
    const shadow = this.shadow;
    if (!body || !shadow) return;

    const active = shadow.activeElement as HTMLElement | null;
    const activeKey =
      active?.getAttribute("data-k") ?? (active === this.dialog || !active ? this.restoreKey : null);
    const selection =
      active instanceof HTMLInputElement ? [active.selectionStart, active.selectionEnd] : null;

    if (this.progressEl) {
      this.progressEl.replaceChildren(
        ...[0, 1, 2, 3].map((i) => h("span", { class: i <= this.progressStep ? "done" : "" })),
      );
    }

    body.replaceChildren(h("div", { class: "step" }, this.renderStep()));

    if (stepChanged) {
      this.restoreKey = null;
      const target =
        body.querySelector<HTMLElement>("[data-autofocus]") ?? body.querySelector<HTMLElement>("h2");
      target?.focus({ preventScroll: true });
      const heading = body.querySelector("h2")?.textContent;
      if (this.liveEl && heading) this.liveEl.textContent = heading;
    } else if (activeKey) {
      const el = body.querySelector<HTMLElement>(`[data-k="${activeKey}"]`);
      if (el && !(el as HTMLButtonElement).disabled) {
        this.restoreKey = null;
        el.focus({ preventScroll: true });
        if (selection && el instanceof HTMLInputElement) {
          try {
            el.setSelectionRange(selection[0], selection[1]);
          } catch {
            /* some input types don't support selection */
          }
        }
      } else {
        this.restoreKey = activeKey;
        this.dialog?.focus({ preventScroll: true });
      }
    }
  }

  private renderStep(): Child[] {
    switch (this.step) {
      case "domain":
        return this.viewDomain();
      case "provider":
        return this.viewProvider();
      case "credentials":
        return this.viewCredentials();
      case "manual":
        return this.viewManual();
      case "verifying":
        return this.viewVerifying();
      case "success":
        return this.viewSuccess();
      case "error":
        return this.viewError();
    }
  }

  private viewDomain(): Child[] {
    const appName = this.app?.name;
    const input = h("input", {
      class: "input",
      id: "cx-domain",
      "data-k": "domain",
      "data-autofocus": true,
      type: "text",
      inputmode: "url",
      autocomplete: "url",
      autocapitalize: "none",
      autocorrect: "off",
      spellcheck: "false",
      placeholder: "example.com",
      value: this.domainInput,
      disabled: this.busy,
      "aria-invalid": this.fieldError ? "true" : "false",
      "aria-describedby": this.fieldError ? "cx-domain-error" : "cx-domain-help",
      oninput: (e: Event) => {
        this.domainInput = (e.target as HTMLInputElement).value;
        if (this.fieldError) {
          this.fieldError = null;
          this.render();
        }
      },
    });
    const form = h(
      "form",
      {
        novalidate: true,
        onsubmit: (e: Event) => {
          e.preventDefault();
          void this.submitDomain();
        },
      },
      h(
        "div",
        { class: "field" },
        h("label", { for: "cx-domain" }, "Domain"),
        h("div", { class: "input-wrap" }, svg(icons.globe), input),
        this.fieldError
          ? h("div", { class: "field-error", id: "cx-domain-error", role: "alert" }, this.fieldError)
          : h("div", { class: "help", id: "cx-domain-help" }, "A domain (acme.com) or subdomain (shop.acme.com) you own."),
      ),
      h(
        "div",
        { class: "actions" },
        primaryButton(this.busy ? "Checking your domain…" : "Continue", this.busy, "submit", "domain-submit"),
      ),
    );
    return [
      h("h2", { id: TITLE_ID, tabindex: "-1" }, "Connect your domain"),
      h(
        "p",
        { class: "lead", id: DESC_ID },
        appName
          ? `Enter the domain you'd like to use with ${appName}. We'll find your DNS provider and set things up.`
          : "Enter the domain you'd like to use. We'll find your DNS provider and set things up.",
      ),
      form,
    ];
  }

  private viewProvider(): Child[] {
    const p = this.provider();
    const domain = this.connection?.domain ?? "";
    return [
      this.backButton("Use a different domain", () => this.transition("domain")),
      h("h2", { id: TITLE_ID, tabindex: "-1" }, p ? `We found ${p.name}` : "We couldn't detect your DNS provider"),
      h(
        "p",
        { class: "lead", id: DESC_ID },
        p
          ? `${domain} is managed by ${p.name}. Connect automatically in a few seconds, or add the records yourself.`
          : "No problem — you can add the DNS records yourself.",
      ),
      p ? providerCard(p, this.check?.nameservers ?? []) : null,
      h(
        "div",
        { class: "actions" },
        this.canAutomate() && p
          ? [
              h(
                "button",
                {
                  class: "btn btn-primary",
                  type: "button",
                  "data-k": "auto",
                  "data-autofocus": true,
                  onclick: () => this.transition("credentials"),
                },
                svg(icons.bolt),
                `Connect automatically with ${p.name}`,
              ),
              h(
                "button",
                { class: "btn btn-secondary", type: "button", "data-k": "manual", onclick: () => this.transition("manual") },
                svg(icons.list),
                "Set up manually",
              ),
            ]
          : h(
              "button",
              { class: "btn btn-primary", type: "button", "data-k": "manual", "data-autofocus": true, onclick: () => this.transition("manual") },
              "Continue with manual setup",
            ),
      ),
    ];
  }

  private viewCredentials(): Child[] {
    const p = this.provider();
    if (!p) return this.viewManual();
    const fields = p.credentialFields.map((f, i) => {
      const id = `cx-cred-${i}`;
      const helpId = f.help ? `${id}-help` : undefined;
      return h(
        "div",
        { class: "field" },
        h("label", { for: id }, f.label),
        h("input", {
          class: "input",
          id,
          "data-k": `cred-${f.key}`,
          "data-autofocus": i === 0,
          type: f.secret ? "password" : "text",
          autocomplete: "off",
          autocapitalize: "none",
          autocorrect: "off",
          spellcheck: "false",
          placeholder: f.placeholder,
          value: this.credentials[f.key] ?? "",
          disabled: this.busy,
          "aria-describedby": helpId,
          oninput: (e: Event) => {
            this.credentials[f.key] = (e.target as HTMLInputElement).value;
          },
        }),
        f.help ? h("div", { class: "help", id: helpId }, f.help) : null,
      );
    });

    return [
      this.backButton("Back", () => this.transition("provider")),
      h("h2", { id: TITLE_ID, tabindex: "-1" }, `Connect with ${p.name}`),
      h(
        "p",
        { class: "lead", id: DESC_ID },
        `Paste an API token from ${p.name} so we can add the DNS records for `,
        h("strong", null, this.connection?.domain ?? ""),
        ".",
        p.credentialsUrl
          ? [
              " ",
              h(
                "a",
                { class: "link", href: p.credentialsUrl, target: "_blank", rel: "noopener noreferrer" },
                "Create an API token",
                svg(icons.external),
              ),
            ]
          : null,
      ),
      this.inlineError ? errorAlert(this.inlineError) : null,
      h(
        "form",
        {
          novalidate: true,
          autocomplete: "off",
          onsubmit: (e: Event) => {
            e.preventDefault();
            void this.submitCredentials();
          },
        },
        fields,
        h(
          "div",
          { class: "alert info" },
          svg(icons.lock),
          h("span", null, "Your credentials are used once to create the records and are never stored."),
        ),
        h(
          "div",
          { class: "actions" },
          primaryButton(this.busy ? `Connecting to ${p.name}…` : "Connect", this.busy, "submit", "cred-submit"),
          this.inlineError
            ? h(
                "button",
                { class: "btn btn-ghost", type: "button", "data-k": "to-manual", onclick: () => this.transition("manual") },
                "Set up manually instead",
              )
            : null,
        ),
      ),
    ];
  }

  private viewManual(): Child[] {
    const conn = this.connection;
    const p = this.provider();
    const records = conn?.records ?? [];
    return [
      this.canAutomate()
        ? this.backButton("Back", () => this.transition("provider"))
        : this.backButton("Use a different domain", () => this.transition("domain")),
      h("h2", { id: TITLE_ID, tabindex: "-1" }, "Add these DNS records"),
      h(
        "p",
        { class: "lead", id: DESC_ID },
        p
          ? `Sign in to ${p.name} and add the following ${plural(records.length, "record")} to `
          : `Add the following ${plural(records.length, "record")} at your DNS provider (usually where you bought the domain) for `,
        h("strong", null, conn?.rootDomain ?? conn?.domain ?? ""),
        ".",
      ),
      !p && this.check
        ? h(
            "div",
            { class: "alert info" },
            svg(icons.alert),
            h(
              "span",
              null,
              "We couldn't detect your DNS provider.",
              this.check.nameservers.length
                ? [" Your nameservers are ", h("code", null, this.check.nameservers.join(", ")), "."]
                : null,
            ),
          )
        : null,
      p?.dnsPanelUrl
        ? h(
            "p",
            null,
            h(
              "a",
              { class: "link", href: p.dnsPanelUrl, target: "_blank", rel: "noopener noreferrer" },
              `Open ${p.name} DNS settings`,
              svg(icons.external),
            ),
          )
        : null,
      h("ul", { class: "records" }, records.map((r, i) => this.recordItem(r, i, false))),
      h(
        "p",
        { class: "small muted", style: "margin-top:12px" },
        "If a record with the same host already exists, update it instead of adding a duplicate.",
      ),
      this.inlineError ? errorAlert(this.inlineError) : null,
      h(
        "div",
        { class: "actions" },
        h(
          "button",
          {
            class: "btn btn-primary",
            type: "button",
            "data-k": "manual-done",
            disabled: this.busy,
            onclick: () => void this.submitManual(),
          },
          this.busy ? h("span", { class: "spinner", "aria-hidden": "true" }) : null,
          "I've added these records",
        ),
      ),
    ];
  }

  private viewVerifying(): Child[] {
    const conn = this.connection;
    const records = conn?.records ?? [];
    const verified = records.filter((r) => r.status === "verified").length;
    const failedAuto = conn?.status === "failed" && this.setupType === "automatic";
    const polling = !this.pollTimedOut && !failedAuto;

    return [
      h("h2", { id: TITLE_ID, tabindex: "-1" }, this.setupType === "automatic" ? "Records added — verifying" : "Verifying your records"),
      h(
        "p",
        { class: "lead", id: DESC_ID },
        "DNS changes usually show up within a few minutes, but can take up to 48 hours to propagate everywhere.",
      ),
      h("div", { class: "domain-pill" }, svg(icons.globe), conn?.domain ?? ""),
      failedAuto && this.inlineError ? errorAlert(this.inlineError) : null,
      h(
        "div",
        { class: "status-line", role: "status" },
        polling ? h("span", { class: "spinner", "aria-hidden": "true" }) : null,
        h(
          "span",
          null,
          `${verified} of ${records.length} ${records.length === 1 ? "record" : "records"} verified`,
          polling ? " · checking every few seconds" : this.pollTimedOut ? " · paused" : null,
        ),
      ),
      this.pollNotice ? h("div", { class: "alert warn" }, svg(icons.alert), h("span", null, this.pollNotice)) : null,
      h("ul", { class: "records" }, records.map((r, i) => this.recordItem(r, i, true))),
      h(
        "div",
        { class: "actions" },
        this.pollTimedOut
          ? h(
              "button",
              { class: "btn btn-primary", type: "button", "data-k": "check-again", onclick: () => this.checkAgain() },
              svg(icons.refresh),
              "Check again",
            )
          : null,
        failedAuto
          ? h(
              "button",
              { class: "btn btn-primary", type: "button", "data-k": "to-manual", onclick: () => this.transition("manual") },
              "Set up manually instead",
            )
          : null,
        h(
          "button",
          { class: "btn btn-secondary", type: "button", "data-k": "close-later", onclick: () => this.close() },
          "Close",
        ),
        h(
          "p",
          { class: "small muted", style: "text-align:center;margin:4px 0 0" },
          "We'll keep checking — you can close this window.",
        ),
      ),
    ];
  }

  private viewSuccess(): Child[] {
    const conn = this.connection;
    return [
      h("div", { class: "hero-icon success" }, svg(icons.check)),
      h("h2", { id: TITLE_ID, tabindex: "-1" }, "Your domain is connected"),
      h(
        "p",
        { class: "lead", id: DESC_ID },
        h("strong", null, conn?.domain ?? ""),
        this.app ? ` is now set up for ${this.app.name}.` : " is now set up.",
      ),
      h(
        "div",
        { class: "actions" },
        h(
          "button",
          { class: "btn btn-primary", type: "button", "data-k": "done", "data-autofocus": true, onclick: () => this.close() },
          "Done",
        ),
      ),
    ];
  }

  private viewError(): Child[] {
    const f = this.fatal ?? { title: "Something went wrong", message: "Please try again.", retry: null };
    return [
      h("div", { class: "hero-icon danger" }, svg(icons.alert)),
      h("h2", { id: TITLE_ID, tabindex: "-1" }, f.title),
      h("p", { class: "lead", id: DESC_ID }, f.message),
      h(
        "div",
        { class: "actions" },
        f.retry
          ? h(
              "button",
              {
                class: "btn btn-primary",
                type: "button",
                "data-k": "retry",
                "data-autofocus": true,
                onclick: () => {
                  this.fatal = null;
                  f.retry!();
                },
              },
              "Try again",
            )
          : null,
        h(
          "button",
          {
            class: f.retry ? "btn btn-secondary" : "btn btn-primary",
            type: "button",
            "data-k": "close",
            "data-autofocus": !f.retry,
            onclick: () => this.close(),
          },
          "Close",
        ),
      ),
    ];
  }

  private recordItem(r: ResolvedDnsRecordDTO, i: number, withStatus: boolean): HTMLElement {
    return h(
      "li",
      { class: "record" },
      h(
        "div",
        { class: "record-head" },
        h("span", { class: "type-badge" }, r.type),
        h("span", { class: "grow" }, `TTL ${r.ttl}${r.priority !== undefined ? ` · Priority ${r.priority}` : ""}`),
        withStatus ? statusChip(r.status) : null,
      ),
      h(
        "dl",
        { style: "margin:0" },
        this.kvRow("Host", r.host, `${i}-host`, r.fqdn),
        this.kvRow("Value", r.value, `${i}-value`),
        r.priority !== undefined ? this.kvRow("Priority", String(r.priority), `${i}-prio`) : null,
      ),
      withStatus && r.status === "mismatch"
        ? h(
            "div",
            { class: "observed" },
            r.observed.length
              ? ["Currently resolves to ", h("code", null, r.observed.join(", "))]
              : "Not found yet.",
          )
        : null,
    );
  }

  private kvRow(label: string, value: string, key: string, title?: string): HTMLElement {
    const btn = h(
      "button",
      {
        class: "copy",
        type: "button",
        "data-k": `copy-${key}`,
        "aria-label": `Copy ${label.toLowerCase()}: ${value}`,
      },
      svg(icons.copy),
      h("span", null, "Copy"),
    );
    btn.addEventListener("click", async () => {
      const ok = await copyText(value);
      if (this.closed) return;
      const labelEl = btn.querySelector("span")!;
      btn.classList.toggle("copied", ok);
      labelEl.textContent = ok ? "Copied" : "Press ⌘C";
      if (this.liveEl) this.liveEl.textContent = ok ? `${label} copied` : "Copy failed";
      const t = setTimeout(() => {
        this.copyTimers.delete(t);
        btn.classList.remove("copied");
        labelEl.textContent = "Copy";
      }, 1600);
      this.copyTimers.add(t);
    });
    return h(
      "div",
      { class: "kv" },
      h("dt", null, label),
      h("dd", { title }, value),
      btn,
    );
  }

  private backButton(label: string, onClick: () => void): HTMLElement | null {
    if (this.busy) return null;
    return h("button", { class: "back", type: "button", "data-k": "back", onclick: onClick }, svg(icons.back), label);
  }
}

// ── helpers ───────────────────────────────────────────────────────────

function toApiError(err: unknown): ConnectApiError {
  if (err instanceof ConnectApiError) return err;
  return new ConnectApiError("unknown", err instanceof Error ? err.message : "Something went wrong.", 0);
}

function fatalTitle(e: ConnectApiError): string {
  switch (e.code) {
    case "token.expired":
      return "This session has expired";
    case "token.invalid":
      return "This session isn't valid";
    case "origin_not_allowed":
      return "This site isn't allowed to connect domains";
    case "dns_records.invalid":
      return "This integration is misconfigured";
    case "network":
      return "Can't reach the server";
    default:
      return "Something went wrong";
  }
}

function primaryButton(label: string, busy: boolean, type: "submit" | "button", key: string): HTMLElement {
  return h(
    "button",
    { class: "btn btn-primary", type, "data-k": key, disabled: busy },
    busy ? h("span", { class: "spinner", "aria-hidden": "true" }) : null,
    label,
  );
}

function errorAlert(message: string): HTMLElement {
  return h("div", { class: "alert", role: "alert" }, svg(icons.alert), h("span", null, message));
}

function statusChip(status: DnsRecordStatus): HTMLElement {
  return h("span", { class: `chip ${status}` }, h("span", { class: "dot", "aria-hidden": "true" }), STATUS_LABEL[status]);
}

function providerCard(p: DnsProviderDTO, nameservers: string[]): HTMLElement {
  return h(
    "div",
    { class: "provider" },
    h("div", { class: "provider-badge", "aria-hidden": "true" }, initial(p.name)),
    h(
      "div",
      { class: "provider-meta" },
      h("div", { class: "provider-name" }, p.name),
      nameservers.length ? h("div", { class: "provider-sub", title: nameservers.join(", ") }, nameservers.join(", ")) : null,
    ),
  );
}

function initial(name: string): string {
  return (name.trim()[0] ?? "?").toUpperCase();
}

function plural(n: number, word: string): string {
  return n === 1 ? word : `${n} ${word}s`;
}
