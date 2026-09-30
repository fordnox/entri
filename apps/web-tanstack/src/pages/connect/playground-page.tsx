import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { FlaskConicalIcon, PlayIcon, Trash2Icon } from "lucide-react";
import {
  DNS_RECORD_TYPES,
  type DnsRecordInput,
  type DnsRecordsConfig,
  type SetupMethod,
} from "@orbit/shared/connect";
import { Button } from "@orbit/ui/button";
import { Input } from "@orbit/ui/input";
import { Label } from "@orbit/ui/label";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@orbit/ui/select";
import { Skeleton } from "@orbit/ui/skeleton";
import { Switch } from "@orbit/ui/switch";
import { Textarea } from "@orbit/ui/textarea";
import { api } from "@/lib/api/client";
import { useCan } from "@/lib/permissions";
import { useWorkspaceSlug } from "@/lib/use-workspace-slug";
import { useWorkspace } from "@/lib/workspace";
import { useConnectApplications } from "./applications-page";
import {
  EXAMPLE_DNS_RECORDS,
  ErrorNotice,
  PANEL,
  PageHeader,
  PermissionNotice,
  toastError,
} from "./shared";

// Mirrors the SDK surface in docs/connect.md so callback params stay typed
// even before `@orbit/connect-js` is linked into node_modules.
type ConnectStep = "domain" | "provider" | "credentials" | "manual" | "verifying" | "success" | "error";
type ConnectSuccess = { domain: string; connectionId: string; setupType: SetupMethod; provider: string | null };
type ConnectCloseResult = {
  domain: string | null;
  connectionId: string | null;
  success: boolean;
  setupType: SetupMethod | null;
  lastStatus: ConnectStep;
};

type LogEntry = {
  id: number;
  at: Date;
  kind: "info" | "step" | "success" | "close" | "error";
  label: string;
  detail?: unknown;
};

const DEFAULT_RECORDS_JSON = JSON.stringify(EXAMPLE_DNS_RECORDS, null, 2);

export function ConnectPlaygroundPage({
  initialApplicationId,
}: {
  initialApplicationId?: string;
}) {
  const ws = useWorkspace();
  const workspaceSlug = useWorkspaceSlug() ?? ws?.slug;
  const canManage = useCan("connect.applications.manage");
  const appsQuery = useConnectApplications(workspaceSlug, canManage);

  const [appId, setAppId] = useState<string | null>(initialApplicationId ?? null);
  const [domain, setDomain] = useState("");
  const [userId, setUserId] = useState("playground-user");
  const [recordsJson, setRecordsJson] = useState(DEFAULT_RECORDS_JSON);
  const [forceManual, setForceManual] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [log, setLog] = useState<LogEntry[]>([]);
  const nextId = useRef(1);
  const handleRef = useRef<{ close(): void } | null>(null);

  useEffect(() => {
    if (appId || !appsQuery.data?.length) return;
    setAppId(appsQuery.data[0]!.id);
  }, [appId, appsQuery.data]);

  useEffect(() => () => handleRef.current?.close(), []);

  const parsed = useMemo(() => parseRecords(recordsJson), [recordsJson]);

  if (!ws || !workspaceSlug) return null;

  const push = (kind: LogEntry["kind"], label: string, detail?: unknown) =>
    setLog((prev) => [{ id: nextId.current++, at: new Date(), kind, label, detail }, ...prev].slice(0, 200));

  const launch = async () => {
    if (!appId || !parsed.ok) return;
    setLaunching(true);
    try {
      push("info", "Minting test token…");
      const res = await api.connect.applications.testToken(workspaceSlug, appId);
      push("info", `Token issued (expires in ${res.expires_in}s)`, { apiOrigin: res.apiOrigin });
      const { showConnect } = await import("@orbit/connect-js");
      handleRef.current?.close();
      handleRef.current = showConnect({
        applicationId: res.applicationId,
        token: res.auth_token,
        apiOrigin: res.apiOrigin,
        dnsRecords: parsed.value,
        prefilledDomain: domain.trim() || undefined,
        userId: userId.trim() || undefined,
        metadata: { source: "dashboard-playground" },
        forceManualSetup: forceManual,
        onStepChange: (step: ConnectStep) => push("step", `step → ${step}`),
        onSuccess: (r: ConnectSuccess) => push("success", `onSuccess · ${r.domain}`, r),
        onClose: (r: ConnectCloseResult) => {
          push("close", `onClose · ${r.success ? "success" : r.lastStatus}`, r);
          handleRef.current = null;
        },
      });
      push("info", "Modal opened");
    } catch (err) {
      push("error", "Launch failed", { message: err instanceof Error ? err.message : String(err) });
      toastError("Could not launch modal", err);
    } finally {
      setLaunching(false);
    }
  };

  const header = (
    <PageHeader
      title="Playground"
      description="Launch the real Connect modal against one of your applications with a short-lived test token. Domains you connect here show up in Domains like any other."
    />
  );

  if (!canManage) {
    return (
      <div>
        {header}
        <PermissionNotice permission="connect.applications.manage" what="use the playground" />
      </div>
    );
  }

  if (appsQuery.isPending) {
    return (
      <div>
        {header}
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }
  if (appsQuery.isError) {
    return (
      <div>
        {header}
        <ErrorNotice error={appsQuery.error} what="applications" />
      </div>
    );
  }
  if (appsQuery.data.length === 0) {
    return (
      <div>
        {header}
        <div className={`${PANEL} flex flex-col items-center gap-3 px-6 py-12 text-center`}>
          <div className="rounded-lg bg-muted p-2.5 text-muted-foreground">
            <FlaskConicalIcon className="size-5" />
          </div>
          <h2 className="text-[15px] font-semibold">Create an application first</h2>
          <p className="max-w-md text-[13px] text-muted-foreground leading-relaxed">
            The playground mints tokens for an existing application.
          </p>
          <Button
            size="sm"
            render={<Link to="/d/$workspaceSlug/connect/applications" params={{ workspaceSlug }} />}
          >
            Go to applications
          </Button>
        </div>
      </div>
    );
  }

  const appItems = appsQuery.data.map((a) => ({ value: a.id as string, label: a.name }));

  return (
    <div>
      {header}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className={`${PANEL} space-y-5 p-5`}>
          <div className="space-y-1.5">
            <Label>Application</Label>
            <Select items={appItems} value={appId} onValueChange={(v) => setAppId((v as string) ?? null)}>
              <SelectTrigger aria-label="Application">
                <SelectValue placeholder="Pick an application" />
              </SelectTrigger>
              <SelectPopup>
                {appItems.map((i) => (
                  <SelectItem key={i.value} value={i.value}>
                    {i.label}
                  </SelectItem>
                ))}
              </SelectPopup>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="pg-domain">Prefilled domain</Label>
              <Input
                id="pg-domain"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="acme.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pg-user">User ID</Label>
              <Input
                id="pg-user"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="cus_123"
                className="font-mono"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="pg-records">DNS records</Label>
              <Button
                type="button"
                size="xs"
                variant="ghost"
                className="text-muted-foreground"
                onClick={() => setRecordsJson(DEFAULT_RECORDS_JSON)}
              >
                Reset example
              </Button>
            </div>
            <Textarea
              id="pg-records"
              value={recordsJson}
              onChange={(e) => setRecordsJson(e.target.value)}
              rows={14}
              spellCheck={false}
              aria-invalid={!parsed.ok || undefined}
              className="font-mono text-[12px]"
            />
            {parsed.ok ? (
              <p className="text-[11px] text-muted-foreground">
                A flat array, or <code className="font-mono">{"{ domain, subDomain }"}</code>. Placeholders{" "}
                <code className="font-mono">{"{DOMAIN}"}</code>, <code className="font-mono">{"{ROOT_DOMAIN}"}</code>,{" "}
                <code className="font-mono">{"{SUBDOMAIN}"}</code> are resolved server-side.
              </p>
            ) : (
              <p className="text-[12px] text-rose-600 dark:text-rose-400">{parsed.error}</p>
            )}
          </div>

          <label className="flex items-start gap-3">
            <Switch checked={forceManual} onCheckedChange={setForceManual} className="mt-0.5" />
            <span>
              <span className="block text-[13px] font-medium">Force manual setup</span>
              <span className="block text-[11px] text-muted-foreground">
                Skip automatic setup even when the user's DNS provider supports it.
              </span>
            </span>
          </label>

          <div className="flex justify-end border-t border-border/40 pt-4">
            <Button
              className="gap-1.5"
              disabled={!appId || !parsed.ok}
              loading={launching}
              onClick={() => void launch()}
            >
              <PlayIcon className="size-3.5" />
              Launch modal
            </Button>
          </div>
        </div>

        <div className={`${PANEL} flex min-h-80 flex-col overflow-hidden lg:max-h-[42rem]`}>
          <div className="flex items-center justify-between border-border/40 border-b py-2 ps-4 pe-2">
            <h2 className="text-[13px] font-semibold">Event log</h2>
            <Button
              size="icon-xs"
              variant="ghost"
              className="text-muted-foreground"
              aria-label="Clear log"
              disabled={log.length === 0}
              onClick={() => setLog([])}
            >
              <Trash2Icon className="size-3.5" />
            </Button>
          </div>
          {log.length === 0 ? (
            <p className="m-auto px-6 py-10 text-center text-[12px] text-muted-foreground">
              Callbacks (<code className="font-mono">onStepChange</code>,{" "}
              <code className="font-mono">onSuccess</code>, <code className="font-mono">onClose</code>) show up here.
            </p>
          ) : (
            <ol className="flex-1 divide-y divide-border/40 overflow-y-auto">
              {log.map((e) => (
                <li key={e.id} className="px-4 py-2">
                  <div className="flex items-baseline gap-2">
                    <span className="shrink-0 font-mono text-[10px] text-muted-foreground tabular-nums">
                      {e.at.toLocaleTimeString(undefined, { hour12: false })}
                    </span>
                    <span className={`font-mono text-[12px] ${LOG_TONE[e.kind]}`}>{e.label}</span>
                  </div>
                  {e.detail !== undefined ? (
                    <pre className="mt-1 overflow-x-auto rounded-md bg-muted/40 px-2 py-1 font-mono text-[11px] leading-relaxed text-muted-foreground">
                      {JSON.stringify(e.detail, null, 2)}
                    </pre>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}

const LOG_TONE: Record<LogEntry["kind"], string> = {
  info: "text-muted-foreground",
  step: "text-sky-600 dark:text-sky-400",
  success: "text-emerald-600 dark:text-emerald-400",
  close: "text-foreground",
  error: "text-rose-600 dark:text-rose-400",
};

type ParseResult = { ok: true; value: DnsRecordsConfig } | { ok: false; error: string };

function parseRecords(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (err) {
    return { ok: false, error: `Invalid JSON: ${err instanceof Error ? err.message : String(err)}` };
  }
  if (Array.isArray(raw)) {
    const err = validateList(raw, "records");
    return err ? { ok: false, error: err } : { ok: true, value: raw as DnsRecordInput[] };
  }
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (!Array.isArray(obj.domain) || !Array.isArray(obj.subDomain)) {
      return { ok: false, error: "Expected an array, or an object with `domain` and `subDomain` arrays." };
    }
    const err = validateList(obj.domain, "domain") ?? validateList(obj.subDomain, "subDomain");
    return err
      ? { ok: false, error: err }
      : { ok: true, value: { domain: obj.domain as DnsRecordInput[], subDomain: obj.subDomain as DnsRecordInput[] } };
  }
  return { ok: false, error: "Expected an array, or an object with `domain` and `subDomain` arrays." };
}

function validateList(list: unknown[], path: string): string | null {
  if (list.length === 0) return `\`${path}\` must contain at least one record.`;
  for (let i = 0; i < list.length; i++) {
    const r = list[i] as Partial<DnsRecordInput> | null;
    const at = `${path}[${i}]`;
    if (!r || typeof r !== "object") return `${at} must be an object.`;
    if (!r.type || !DNS_RECORD_TYPES.includes(r.type)) {
      return `${at}.type must be one of ${DNS_RECORD_TYPES.join(", ")}.`;
    }
    if (typeof r.host !== "string" || !r.host) return `${at}.host must be a non-empty string.`;
    if (typeof r.value !== "string" || !r.value) return `${at}.value must be a non-empty string.`;
    if (r.ttl !== undefined && (typeof r.ttl !== "number" || r.ttl <= 0)) {
      return `${at}.ttl must be a positive number.`;
    }
    if (r.type === "MX" && typeof r.priority !== "number") return `${at}.priority is required for MX records.`;
  }
  return null;
}
