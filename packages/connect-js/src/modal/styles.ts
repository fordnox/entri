export const styles = /* css */ `
:host {
  all: initial;
  position: fixed;
  inset: 0;
  z-index: 2147483647;
  display: block;
  --cx-bg: #ffffff;
  --cx-bg-subtle: #f6f7f9;
  --cx-bg-muted: #eef0f3;
  --cx-border: #e3e6ea;
  --cx-border-strong: #cfd4da;
  --cx-text: #14171c;
  --cx-text-muted: #5b6470;
  --cx-text-subtle: #8a929c;
  --cx-accent: #2f5bea;
  --cx-accent-hover: #2449c7;
  --cx-accent-text: #ffffff;
  --cx-accent-soft: #eaf0ff;
  --cx-success: #12805c;
  --cx-success-soft: #e5f6ee;
  --cx-warn: #a15c00;
  --cx-warn-soft: #fff3df;
  --cx-danger: #c4312b;
  --cx-danger-soft: #fdeceb;
  --cx-backdrop: rgba(17, 20, 26, 0.48);
  --cx-shadow: 0 24px 64px -12px rgba(16, 24, 40, 0.28), 0 4px 16px -4px rgba(16, 24, 40, 0.12);
  --cx-radius: 16px;
  --cx-radius-sm: 10px;
  --cx-font: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --cx-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
  color-scheme: light;
}
@media (prefers-color-scheme: dark) {
  :host {
    --cx-bg: #16181d;
    --cx-bg-subtle: #1d2026;
    --cx-bg-muted: #262a31;
    --cx-border: #2c3038;
    --cx-border-strong: #3a3f49;
    --cx-text: #eef0f3;
    --cx-text-muted: #a3aab4;
    --cx-text-subtle: #767e89;
    --cx-accent: #5b82ff;
    --cx-accent-hover: #7596ff;
    --cx-accent-text: #0b0f1a;
    --cx-accent-soft: #1e2a4d;
    --cx-success: #3fcf97;
    --cx-success-soft: #143328;
    --cx-warn: #f0b155;
    --cx-warn-soft: #3a2a12;
    --cx-danger: #ff7a73;
    --cx-danger-soft: #3d1b1a;
    --cx-backdrop: rgba(0, 0, 0, 0.62);
    --cx-shadow: 0 24px 64px -12px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.04);
    color-scheme: dark;
  }
}
*, *::before, *::after { box-sizing: border-box; }
[hidden] { display: none !important; }

.backdrop {
  position: fixed;
  inset: 0;
  background: var(--cx-backdrop);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
  overflow-y: auto;
  font-family: var(--cx-font);
  font-size: 14px;
  line-height: 1.5;
  color: var(--cx-text);
  -webkit-font-smoothing: antialiased;
  animation: cx-fade 160ms ease-out;
}
.dialog {
  position: relative;
  width: 100%;
  max-width: 460px;
  margin: auto;
  background: var(--cx-bg);
  border-radius: var(--cx-radius);
  box-shadow: var(--cx-shadow);
  display: flex;
  flex-direction: column;
  outline: none;
  animation: cx-rise 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
}
@keyframes cx-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes cx-rise { from { opacity: 0; transform: translateY(12px) scale(0.98); } to { opacity: 1; transform: none; } }
@keyframes cx-sheet { from { transform: translateY(100%); } to { transform: none; } }
@keyframes cx-spin { to { transform: rotate(360deg); } }
@keyframes cx-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }

@media (max-width: 480px) {
  .backdrop { padding: 0; align-items: flex-end; }
  .dialog {
    max-width: none;
    min-height: 100%;
    margin: 0;
    border-radius: 0;
    animation: cx-sheet 260ms cubic-bezier(0.2, 0.8, 0.2, 1);
    padding-bottom: env(safe-area-inset-bottom, 0px);
  }
}
@media (prefers-reduced-motion: reduce) {
  .backdrop, .dialog { animation: none; }
  .spinner { animation-duration: 1.6s; }
  .chip.propagating .dot, .chip.pending .dot { animation: none; }
  .btn { transition: none; }
}

/* header */
.header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px 16px 0 20px;
  padding-top: max(16px, env(safe-area-inset-top, 0px));
}
.brand { display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1; }
.brand-icon {
  width: 28px; height: 28px; border-radius: 8px; flex: none;
  background: var(--cx-bg-muted); color: var(--cx-text-muted);
  display: grid; place-items: center; overflow: hidden;
  font-weight: 600; font-size: 13px;
  border: 1px solid var(--cx-border);
}
.brand-icon img { width: 100%; height: 100%; object-fit: cover; display: block; }
.brand-name { font-weight: 600; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.brand-skeleton { width: 110px; height: 12px; border-radius: 6px; background: var(--cx-bg-muted); }
.icon-btn {
  appearance: none; border: 0; background: transparent; color: var(--cx-text-muted);
  width: 32px; height: 32px; border-radius: 8px; display: grid; place-items: center;
  cursor: pointer; flex: none; padding: 0;
}
.icon-btn:hover { background: var(--cx-bg-muted); color: var(--cx-text); }
.icon-btn svg { width: 18px; height: 18px; }

.progress { display: flex; gap: 6px; padding: 14px 20px 0; }
.progress span { flex: 1; height: 3px; border-radius: 3px; background: var(--cx-bg-muted); transition: background 200ms; }
.progress span.done { background: var(--cx-accent); }

/* body */
.body { padding: 20px 20px 8px; flex: 1; }
.eyebrow { font-size: 12px; font-weight: 500; color: var(--cx-text-subtle); margin: 0 0 4px; letter-spacing: 0.01em; }
h2 { font-size: 19px; line-height: 1.3; font-weight: 650; margin: 0 0 6px; letter-spacing: -0.01em; outline: none; }
p { margin: 0 0 12px; }
.lead { color: var(--cx-text-muted); margin-bottom: 18px; }
.muted { color: var(--cx-text-muted); }
.small { font-size: 12.5px; }
strong { font-weight: 600; }
code, .mono { font-family: var(--cx-mono); font-size: 12.5px; }

.hero-icon {
  width: 44px; height: 44px; border-radius: 12px; display: grid; place-items: center;
  background: var(--cx-accent-soft); color: var(--cx-accent); margin-bottom: 14px;
}
.hero-icon svg { width: 22px; height: 22px; }
.hero-icon.success { background: var(--cx-success-soft); color: var(--cx-success); }
.hero-icon.danger { background: var(--cx-danger-soft); color: var(--cx-danger); }

/* forms */
.field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
label { font-size: 13px; font-weight: 550; }
.input {
  appearance: none; width: 100%; font: inherit; font-size: 15px; color: var(--cx-text);
  background: var(--cx-bg); border: 1px solid var(--cx-border-strong); border-radius: var(--cx-radius-sm);
  padding: 10px 12px; outline: none; transition: border-color 120ms, box-shadow 120ms;
}
.input::placeholder { color: var(--cx-text-subtle); }
.input:focus { border-color: var(--cx-accent); box-shadow: 0 0 0 3px var(--cx-accent-soft); }
.input[aria-invalid="true"] { border-color: var(--cx-danger); }
.input-wrap { position: relative; }
.input-wrap svg { position: absolute; left: 12px; top: 50%; width: 16px; height: 16px; transform: translateY(-50%); color: var(--cx-text-subtle); pointer-events: none; }
.input-wrap .input { padding-left: 36px; }
.help { font-size: 12.5px; color: var(--cx-text-muted); }
.field-error { font-size: 12.5px; color: var(--cx-danger); }

.alert {
  display: flex; gap: 10px; align-items: flex-start; padding: 10px 12px; border-radius: var(--cx-radius-sm);
  background: var(--cx-danger-soft); color: var(--cx-danger); font-size: 13px; margin-bottom: 14px;
}
.alert svg { width: 16px; height: 16px; flex: none; margin-top: 2px; }
.alert.info { background: var(--cx-bg-subtle); color: var(--cx-text-muted); border: 1px solid var(--cx-border); }
.alert.warn { background: var(--cx-warn-soft); color: var(--cx-warn); }

/* buttons */
.actions { display: flex; flex-direction: column; gap: 8px; margin-top: 18px; }
.btn {
  appearance: none; font: inherit; font-weight: 600; font-size: 14px; border-radius: var(--cx-radius-sm);
  padding: 11px 16px; min-height: 44px; cursor: pointer; display: inline-flex; align-items: center;
  justify-content: center; gap: 8px; text-decoration: none; border: 1px solid transparent;
  transition: background 120ms, border-color 120ms, color 120ms; width: 100%;
}
.btn svg { width: 16px; height: 16px; flex: none; }
.btn-primary { background: var(--cx-accent); color: var(--cx-accent-text); }
.btn-primary:hover:not([disabled]) { background: var(--cx-accent-hover); }
.btn-secondary { background: var(--cx-bg); color: var(--cx-text); border-color: var(--cx-border-strong); }
.btn-secondary:hover:not([disabled]) { background: var(--cx-bg-subtle); }
.btn-ghost { background: transparent; color: var(--cx-text-muted); min-height: 36px; padding: 8px 12px; }
.btn-ghost:hover:not([disabled]) { color: var(--cx-text); background: var(--cx-bg-subtle); }
.btn[disabled] { opacity: 0.6; cursor: default; }
.btn:focus-visible, .icon-btn:focus-visible, .copy:focus-visible, .link:focus-visible, .back:focus-visible {
  outline: 2px solid var(--cx-accent); outline-offset: 2px;
}
.link { color: var(--cx-accent); text-decoration: none; font-weight: 550; display: inline-flex; align-items: center; gap: 4px; }
.link:hover { text-decoration: underline; }
.link svg { width: 13px; height: 13px; }
.back {
  appearance: none; border: 0; background: none; font: inherit; font-size: 13px; color: var(--cx-text-muted);
  display: inline-flex; align-items: center; gap: 2px; padding: 2px 4px 2px 0; margin: -4px 0 10px; cursor: pointer; border-radius: 6px;
}
.back:hover { color: var(--cx-text); }
.back svg { width: 15px; height: 15px; }

.spinner {
  width: 16px; height: 16px; border-radius: 50%; border: 2px solid currentColor; border-right-color: transparent;
  animation: cx-spin 700ms linear infinite; flex: none; opacity: 0.85;
}

/* provider card */
.provider {
  display: flex; align-items: center; gap: 12px; padding: 12px 14px; border: 1px solid var(--cx-border);
  border-radius: var(--cx-radius-sm); background: var(--cx-bg-subtle); margin-bottom: 4px;
}
.provider-badge {
  width: 36px; height: 36px; border-radius: 9px; background: var(--cx-bg); border: 1px solid var(--cx-border);
  display: grid; place-items: center; font-weight: 700; color: var(--cx-text-muted); flex: none;
}
.provider-meta { min-width: 0; }
.provider-name { font-weight: 600; }
.provider-sub { font-size: 12.5px; color: var(--cx-text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.option-note { display: flex; gap: 8px; align-items: center; justify-content: center; font-size: 12.5px; color: var(--cx-text-subtle); margin-top: 2px; }
.option-note svg { width: 13px; height: 13px; }

/* records */
.records { display: flex; flex-direction: column; gap: 10px; margin: 0; padding: 0; list-style: none; }
.record { border: 1px solid var(--cx-border); border-radius: var(--cx-radius-sm); overflow: hidden; }
.record-head {
  display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: var(--cx-bg-subtle);
  border-bottom: 1px solid var(--cx-border); font-size: 12.5px; color: var(--cx-text-muted);
}
.type-badge {
  font-family: var(--cx-mono); font-size: 11.5px; font-weight: 700; padding: 1px 7px; border-radius: 5px;
  background: var(--cx-bg); border: 1px solid var(--cx-border-strong); color: var(--cx-text);
}
.record-head .grow { flex: 1; }
.kv { display: grid; grid-template-columns: 64px minmax(0, 1fr) auto; gap: 8px; align-items: center; padding: 8px 8px 8px 12px; }
.kv + .kv { border-top: 1px solid var(--cx-border); }
.kv dt { font-size: 12px; color: var(--cx-text-subtle); margin: 0; }
.kv dd { margin: 0; font-family: var(--cx-mono); font-size: 12.5px; word-break: break-all; }
.copy {
  appearance: none; border: 1px solid var(--cx-border); background: var(--cx-bg); color: var(--cx-text-muted);
  font: inherit; font-size: 12px; font-weight: 550; border-radius: 7px; padding: 4px 8px; cursor: pointer;
  display: inline-flex; align-items: center; gap: 4px; min-height: 28px;
}
.copy:hover { color: var(--cx-text); border-color: var(--cx-border-strong); }
.copy svg { width: 13px; height: 13px; }
.copy.copied { color: var(--cx-success); border-color: var(--cx-success); }
.observed { padding: 0 12px 10px; font-size: 12px; color: var(--cx-warn); }
.observed code { font-size: 11.5px; }

/* status chips */
.chip {
  display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; font-weight: 600; padding: 2px 8px;
  border-radius: 999px; background: var(--cx-bg-muted); color: var(--cx-text-muted); white-space: nowrap;
}
.chip .dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.chip.pending .dot, .chip.propagating .dot { animation: cx-pulse 1.4s ease-in-out infinite; }
.chip.propagating { background: var(--cx-accent-soft); color: var(--cx-accent); }
.chip.verified { background: var(--cx-success-soft); color: var(--cx-success); }
.chip.mismatch { background: var(--cx-warn-soft); color: var(--cx-warn); }

.status-line { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; color: var(--cx-text-muted); font-size: 13px; }
.status-line .spinner { color: var(--cx-accent); }

.domain-pill {
  display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 999px;
  background: var(--cx-bg-subtle); border: 1px solid var(--cx-border); font-weight: 600; font-size: 13px; margin-bottom: 16px;
  max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.domain-pill svg { width: 14px; height: 14px; color: var(--cx-text-subtle); flex: none; }

.footer {
  display: flex; align-items: center; justify-content: center; gap: 6px; padding: 12px 20px 16px;
  font-size: 11.5px; color: var(--cx-text-subtle);
}
.footer svg { width: 12px; height: 12px; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
`;
