import { useEffect, useRef, useState, type ReactNode } from "react";
import { AlertTriangleIcon, CheckIcon, CopyIcon } from "lucide-react";
import type {
  DnsRecordStatus,
  DomainConnectionStatus,
  WebhookDeliveryStatus,
} from "@orbit/shared/connect";
import { Button } from "@orbit/ui/button";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@orbit/ui/dialog";
import { cn } from "@orbit/ui/lib/utils";
import { toastManager } from "@orbit/ui/toast";
import { ApiError } from "@/lib/api/client";

/** Card surface shared by every Connect panel (matches billing/roles cards). */
export const PANEL =
  "rounded-xl bg-card/40 shadow-[0_0_0_1px_rgba(0,0,0,0.12)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.12)]";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description ? (
          <p className="max-w-prose text-[13px] text-muted-foreground leading-relaxed [text-wrap:pretty]">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function EmptyNotice({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border/60 bg-muted/15 px-4 py-6 text-center text-[13px] text-muted-foreground leading-relaxed [text-wrap:pretty]">
      {children}
    </div>
  );
}

export function ErrorNotice({ error, what }: { error: unknown; what: string }) {
  return (
    <EmptyNotice>
      Could not load {what}. {errorMessage(error, "Try again in a moment.")}
    </EmptyNotice>
  );
}

export function PermissionNotice({ permission, what }: { permission: string; what: string }) {
  return (
    <EmptyNotice>
      You don't have permission to {what}. Ask a workspace admin for{" "}
      <code className="font-mono text-[12px]">{permission}</code>.
    </EmptyNotice>
  );
}

export function errorMessage(err: unknown, fallback = "Something went wrong."): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export function toastError(title: string, err: unknown) {
  toastManager.add({
    type: "error",
    title,
    description: errorMessage(err),
    timeout: 5000,
  });
}

/* -------------------------------------------------------------------------- */
/* Copy                                                                       */
/* -------------------------------------------------------------------------- */

export function useCopy(): [boolean, (text: string) => void] {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);
  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);
  const copy = (text: string) => {
    void navigator.clipboard.writeText(text).then(
      () => {
        setCopied(true);
        if (timer.current) window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setCopied(false), 1500);
      },
      () =>
        toastManager.add({
          type: "error",
          title: "Could not copy",
          description: "Your browser blocked clipboard access.",
          timeout: 4000,
        }),
    );
  };
  return [copied, copy];
}

export function CopyButton({
  value,
  label = "Copy",
  className,
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [copied, copy] = useCopy();
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      className={cn("text-muted-foreground", className)}
      aria-label={label}
      title={copied ? "Copied" : label}
      onClick={(e) => {
        e.stopPropagation();
        copy(value);
      }}
    >
      {copied ? (
        <CheckIcon className="size-3.5 text-emerald-600 dark:text-emerald-400" />
      ) : (
        <CopyIcon className="size-3.5" />
      )}
    </Button>
  );
}

/** Monospace value with an inline copy button — IDs, secrets, URLs. */
export function CopyField({
  value,
  display,
  className,
}: {
  value: string;
  display?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-1 rounded-lg border border-border/60 bg-muted/30 py-1 ps-2.5 pe-1",
        className,
      )}
    >
      <code className="min-w-0 flex-1 truncate font-mono text-[12px]">{display ?? value}</code>
      <CopyButton value={value} />
    </div>
  );
}

export function CodeBlock({
  code,
  label,
  className,
}: {
  code: string;
  label?: string;
  className?: string;
}) {
  return (
    <div className={cn("overflow-hidden rounded-lg border border-border/60 bg-muted/30", className)}>
      <div className="flex items-center justify-between gap-2 border-border/40 border-b py-1 ps-3 pe-1">
        <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
          {label ?? "Code"}
        </span>
        <CopyButton value={code} label="Copy code" />
      </div>
      <pre className="max-h-[28rem] overflow-auto px-3 py-2.5 font-mono text-[12px] leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function JsonBlock({ value, className }: { value: unknown; className?: string }) {
  const text = JSON.stringify(value, null, 2) ?? "null";
  return <CodeBlock code={text} label="JSON" className={className} />;
}

/* -------------------------------------------------------------------------- */
/* Secret-once dialog                                                         */
/* -------------------------------------------------------------------------- */

export function SecretOnceDialog({
  secret,
  applicationId,
  title,
  onClose,
}: {
  secret: string | null;
  applicationId?: string;
  title: string;
  onClose: () => void;
}) {
  const [shown, setShown] = useState<string | null>(secret);
  useEffect(() => {
    if (secret) setShown(secret);
  }, [secret]);
  return (
    <Dialog
      open={secret !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogPopup className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Use this secret on your server to mint short-lived tokens for the
            Connect modal. Never ship it to a browser.
          </DialogDescription>
        </DialogHeader>
        <DialogPanel className="space-y-4">
          <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-[12px] text-amber-700 leading-relaxed dark:text-amber-300">
            <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0" />
            <span>
              <strong>Copy it now — you won't see this secret again.</strong> If
              you lose it, rotate the secret from the application page.
            </span>
          </div>
          {applicationId ? (
            <div className="space-y-1.5">
              <FieldLabel>Application ID</FieldLabel>
              <CopyField value={applicationId} />
            </div>
          ) : null}
          <div className="space-y-1.5">
            <FieldLabel>Secret</FieldLabel>
            <CopyField value={shown ?? ""} />
          </div>
        </DialogPanel>
        <DialogFooter>
          <Button render={<DialogClose />}>I've saved it</Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
      {children}
    </div>
  );
}

export function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
        {label}
      </dt>
      <dd className="min-w-0 truncate font-medium text-[12px] tabular-nums">{children}</dd>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Status badges                                                              */
/* -------------------------------------------------------------------------- */

const TONES = {
  green: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  amber: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  sky: "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400",
  rose: "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400",
  muted: "border-muted-foreground/30 bg-muted text-muted-foreground",
} as const;

function Pill({ tone, children }: { tone: keyof typeof TONES; children: ReactNode }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}

export const DOMAIN_STATUS_LABEL: Record<DomainConnectionStatus, string> = {
  pending: "Pending",
  propagating: "Propagating",
  connected: "Connected",
  failed: "Failed",
};

const DOMAIN_STATUS_TONE: Record<DomainConnectionStatus, keyof typeof TONES> = {
  pending: "muted",
  propagating: "amber",
  connected: "green",
  failed: "rose",
};

export function DomainStatusBadge({ status }: { status: DomainConnectionStatus }) {
  return <Pill tone={DOMAIN_STATUS_TONE[status]}>{DOMAIN_STATUS_LABEL[status]}</Pill>;
}

const RECORD_STATUS: Record<DnsRecordStatus, { label: string; tone: keyof typeof TONES }> = {
  pending: { label: "Pending", tone: "muted" },
  propagating: { label: "Propagating", tone: "amber" },
  verified: { label: "Verified", tone: "green" },
  mismatch: { label: "Mismatch", tone: "rose" },
};

export function RecordStatusBadge({ status }: { status: DnsRecordStatus }) {
  const s = RECORD_STATUS[status];
  return <Pill tone={s.tone}>{s.label}</Pill>;
}

const DELIVERY_STATUS: Record<WebhookDeliveryStatus, { label: string; tone: keyof typeof TONES }> = {
  pending: { label: "Pending", tone: "sky" },
  succeeded: { label: "Succeeded", tone: "green" },
  failed: { label: "Failed", tone: "rose" },
};

export function DeliveryStatusBadge({ status }: { status: WebhookDeliveryStatus }) {
  const s = DELIVERY_STATUS[status];
  return <Pill tone={s.tone}>{s.label}</Pill>;
}

export function MutedPill({ children }: { children: ReactNode }) {
  return <Pill tone="muted">{children}</Pill>;
}

/* -------------------------------------------------------------------------- */
/* Misc                                                                       */
/* -------------------------------------------------------------------------- */

export function AppIcon({ url, name, className }: { url: string | null; name: string; className?: string }) {
  const [broken, setBroken] = useState(false);
  if (url && !broken) {
    return (
      <img
        src={url}
        alt=""
        onError={() => setBroken(true)}
        className={cn("size-8 shrink-0 rounded-md border border-border/60 bg-background object-cover", className)}
      />
    );
  }
  return (
    <div
      aria-hidden
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-md bg-muted font-semibold text-[12px] text-muted-foreground uppercase",
        className,
      )}
    >
      {name.trim().charAt(0) || "?"}
    </div>
  );
}

export function useDebouncedValue<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return iso;
  const diff = Date.now() - t;
  const abs = Math.abs(diff);
  const minutes = Math.round(abs / 60_000);
  if (minutes < 1) return "just now";
  const suffix = diff >= 0 ? "ago" : "from now";
  if (minutes < 60) return `${minutes}m ${suffix}`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ${suffix}`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ${suffix}`;
  return formatDate(iso);
}

export function parseLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

/** Example records used by the playground and quick-start snippets. */
export const EXAMPLE_DNS_RECORDS = {
  domain: [
    { type: "A", host: "@", value: "76.76.21.21", ttl: 300 },
    { type: "CNAME", host: "www", value: "cname.yourapp.com", ttl: 300 },
  ],
  subDomain: [{ type: "CNAME", host: "@", value: "cname.yourapp.com", ttl: 300 }],
} as const;
