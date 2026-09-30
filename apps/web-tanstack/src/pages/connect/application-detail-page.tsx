import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Fragment, type FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowLeftIcon,
  ChevronRightIcon,
  EyeIcon,
  EyeOffIcon,
  FlaskConicalIcon,
  RefreshCwIcon,
  SendIcon,
} from "lucide-react";
import type {
  ApplicationWithSecretDTO,
  ConnectApplicationDTO,
  WebhookDeliveryDTO,
} from "@orbit/shared/connect";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from "@orbit/ui/alert-dialog";
import { Button } from "@orbit/ui/button";
import { Skeleton } from "@orbit/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@orbit/ui/table";
import { Tabs, TabsList, TabsTab } from "@orbit/ui/tabs";
import { toastManager } from "@orbit/ui/toast";
import { ApiError, api } from "@/lib/api/client";
import { useCan } from "@/lib/permissions";
import { queryKeys } from "@/lib/query-keys";
import { API_URL } from "@/lib/urls";
import { useWorkspaceSlug } from "@/lib/use-workspace-slug";
import { useWorkspace } from "@/lib/workspace";
import { SettingsSection } from "@/pages/workspace-settings/shared";
import { ApplicationFields } from "./applications-page";
import {
  AppIcon,
  CodeBlock,
  CopyButton,
  CopyField,
  DeliveryStatusBadge,
  ErrorNotice,
  EmptyNotice,
  Fact,
  FieldLabel,
  JsonBlock,
  MutedPill,
  PANEL,
  PermissionNotice,
  SecretOnceDialog,
  formatDate,
  formatDateTime,
  formatRelative,
  parseLines,
  toastError,
} from "./shared";

export function ConnectApplicationDetailPage({ applicationId }: { applicationId: string }) {
  const ws = useWorkspace();
  const workspaceSlug = useWorkspaceSlug() ?? ws?.slug;
  const canView = useCan("connect.applications.view");
  const canManage = useCan("connect.applications.manage");

  const appQuery = useQuery({
    queryKey: queryKeys.connectApplication(workspaceSlug ?? "", applicationId),
    queryFn: () => {
      if (!workspaceSlug) throw new Error("missing slug");
      return api.connect.applications.get(workspaceSlug, applicationId);
    },
    enabled: Boolean(workspaceSlug) && canView,
    staleTime: 15_000,
  });

  if (!ws || !workspaceSlug) return null;

  const back = (
    <Button
      variant="ghost"
      size="sm"
      className="-ms-2 mb-4 gap-1.5 text-muted-foreground"
      render={
        <Link to="/d/$workspaceSlug/connect/applications" params={{ workspaceSlug }} />
      }
    >
      <ArrowLeftIcon className="size-3.5" />
      Applications
    </Button>
  );

  if (!canView) {
    return (
      <div>
        {back}
        <PermissionNotice permission="connect.applications.view" what="view Connect applications" />
      </div>
    );
  }

  if (appQuery.isPending) {
    return (
      <div className="space-y-6">
        {back}
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-3 w-64" />
          </div>
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  if (appQuery.isError) {
    return (
      <div>
        {back}
        {appQuery.error instanceof ApiError && appQuery.error.status === 404 ? (
          <EmptyNotice>This application doesn't exist or was deleted.</EmptyNotice>
        ) : (
          <ErrorNotice error={appQuery.error} what="the application" />
        )}
      </div>
    );
  }

  const app = appQuery.data;

  return (
    <div>
      {back}
      <header className="mb-10 flex flex-wrap items-center gap-3">
        <AppIcon url={app.iconUrl} name={app.name} className="size-10 rounded-lg" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold tracking-tight">{app.name}</h1>
          <div className="mt-0.5 flex items-center gap-1 text-[12px] text-muted-foreground">
            <code className="truncate font-mono">{app.id}</code>
            <CopyButton value={app.id} label="Copy application ID" />
            <span className="ms-1">
              · {app.domainCount} domain{app.domainCount === 1 ? "" : "s"} · created{" "}
              {formatDate(app.createdAt)}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            render={
              <Link
                to="/d/$workspaceSlug/connect/domains"
                params={{ workspaceSlug }}
                search={{ applicationId: app.id }}
              />
            }
          >
            View domains
          </Button>
          {canManage ? (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              render={
                <Link
                  to="/d/$workspaceSlug/connect/playground"
                  params={{ workspaceSlug }}
                  search={{ applicationId: app.id }}
                />
              }
            >
              <FlaskConicalIcon className="size-3.5" />
              Try in playground
            </Button>
          ) : null}
        </div>
      </header>

      <div className="space-y-12">
        <SettingsForm app={app} workspaceSlug={workspaceSlug} canManage={canManage} />
        <CredentialsSection app={app} workspaceSlug={workspaceSlug} canManage={canManage} />
        <WebhooksSection app={app} workspaceSlug={workspaceSlug} canManage={canManage} />
        <QuickStartSection app={app} />
        {canManage ? <DangerZone app={app} workspaceSlug={workspaceSlug} /> : null}
      </div>
    </div>
  );
}

function useInvalidateApp(workspaceSlug: string, appId: string) {
  const queryClient = useQueryClient();
  return (next?: ConnectApplicationDTO) => {
    if (next) {
      queryClient.setQueryData(queryKeys.connectApplication(workspaceSlug, appId), next);
    }
    return queryClient.invalidateQueries({
      queryKey: queryKeys.connectApplications(workspaceSlug),
    });
  };
}

/* -------------------------------------------------------------------------- */
/* Settings                                                                   */
/* -------------------------------------------------------------------------- */

function SettingsForm({
  app,
  workspaceSlug,
  canManage,
}: {
  app: ConnectApplicationDTO;
  workspaceSlug: string;
  canManage: boolean;
}) {
  const refresh = useInvalidateApp(workspaceSlug, app.id);
  const [name, setName] = useState(app.name);
  const [iconUrl, setIconUrl] = useState(app.iconUrl ?? "");
  const [origins, setOrigins] = useState(app.allowedOrigins.join("\n"));
  const [webhookUrl, setWebhookUrl] = useState(app.webhookUrl ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(app.name);
    setIconUrl(app.iconUrl ?? "");
    setOrigins(app.allowedOrigins.join("\n"));
    setWebhookUrl(app.webhookUrl ?? "");
  }, [app.name, app.iconUrl, app.allowedOrigins, app.webhookUrl]);

  const dirty =
    name.trim() !== app.name ||
    (iconUrl.trim() || null) !== app.iconUrl ||
    parseLines(origins).join("\n") !== app.allowedOrigins.join("\n") ||
    (webhookUrl.trim() || null) !== app.webhookUrl;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const next = await api.connect.applications.update(workspaceSlug, app.id, {
        name: name.trim(),
        iconUrl: iconUrl.trim() || null,
        allowedOrigins: parseLines(origins),
        webhookUrl: webhookUrl.trim() || null,
      });
      await refresh(next);
      toastManager.add({ type: "success", title: "Application saved", timeout: 3000 });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsSection
      title="Settings"
      description="What end users see in the modal, where it may be embedded, and where events are delivered."
    >
      <form onSubmit={submit} className={`${PANEL} p-5`}>
        <ApplicationFields
          idPrefix="app-settings"
          name={name}
          setName={setName}
          iconUrl={iconUrl}
          setIconUrl={setIconUrl}
          origins={origins}
          setOrigins={setOrigins}
          webhookUrl={webhookUrl}
          setWebhookUrl={setWebhookUrl}
          disabled={!canManage}
        />
        {error ? (
          <p className="mt-3 text-[12px] text-rose-600 dark:text-rose-400">{error}</p>
        ) : null}
        <div className="mt-5 flex items-center justify-end gap-2 border-t border-border/40 pt-4">
          {!canManage ? (
            <span className="me-auto text-[11px] text-muted-foreground">
              Editing requires <code className="font-mono">connect.applications.manage</code>.
            </span>
          ) : null}
          {canManage && dirty ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => {
                setName(app.name);
                setIconUrl(app.iconUrl ?? "");
                setOrigins(app.allowedOrigins.join("\n"));
                setWebhookUrl(app.webhookUrl ?? "");
              }}
            >
              Reset
            </Button>
          ) : null}
          <Button
            type="submit"
            size="sm"
            disabled={!canManage || !dirty || !name.trim()}
            loading={busy}
          >
            Save changes
          </Button>
        </div>
      </form>
    </SettingsSection>
  );
}

/* -------------------------------------------------------------------------- */
/* Credentials                                                                */
/* -------------------------------------------------------------------------- */

function CredentialsSection({
  app,
  workspaceSlug,
  canManage,
}: {
  app: ConnectApplicationDTO;
  workspaceSlug: string;
  canManage: boolean;
}) {
  const refresh = useInvalidateApp(workspaceSlug, app.id);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rotated, setRotated] = useState<ApplicationWithSecretDTO | null>(null);

  const rotate = async () => {
    setBusy(true);
    try {
      const res = await api.connect.applications.rotateSecret(workspaceSlug, app.id);
      await refresh(res.application);
      setConfirmOpen(false);
      setRotated(res);
    } catch (err) {
      toastError("Could not rotate secret", err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsSection
      title="Credentials"
      description="Your server exchanges the application ID and secret for a one-hour token at POST /v1/connect/token."
    >
      <div className={`${PANEL} space-y-4 p-5`}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <FieldLabel>Application ID</FieldLabel>
            <CopyField value={app.id} />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Secret</FieldLabel>
            <div className="flex h-[34px] items-center rounded-lg border border-border/60 bg-muted/30 px-2.5 font-mono text-[12px] text-muted-foreground">
              sk_••••••••{app.secretPreview.replace(/^…/, "")}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-border/40 pt-4">
          <span className="me-auto text-[11px] text-muted-foreground">
            Last rotated {formatRelative(app.secretRotatedAt)}
          </span>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={!canManage}
            onClick={() => setConfirmOpen(true)}
          >
            <RefreshCwIcon className="size-3.5" />
            Rotate secret
          </Button>
        </div>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogPopup>
          <AlertDialogHeader>
            <AlertDialogTitle>Rotate application secret?</AlertDialogTitle>
            <AlertDialogDescription>
              The current secret stops working immediately. Any server still using
              it will fail to mint tokens until you deploy the new one. Tokens
              already issued stay valid until they expire.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" render={<AlertDialogClose />} disabled={busy}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void rotate()} loading={busy}>
              Rotate secret
            </Button>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>

      <SecretOnceDialog
        title="New secret"
        secret={rotated?.secret ?? null}
        applicationId={rotated?.application.id}
        onClose={() => setRotated(null)}
      />
    </SettingsSection>
  );
}

/* -------------------------------------------------------------------------- */
/* Webhooks                                                                   */
/* -------------------------------------------------------------------------- */

function WebhooksSection({
  app,
  workspaceSlug,
  canManage,
}: {
  app: ConnectApplicationDTO;
  workspaceSlug: string;
  canManage: boolean;
}) {
  const queryClient = useQueryClient();
  const refresh = useInvalidateApp(workspaceSlug, app.id);
  const [revealed, setRevealed] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [testing, setTesting] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const deliveriesQuery = useQuery({
    queryKey: queryKeys.connectDeliveries(workspaceSlug, app.id),
    queryFn: () => api.connect.applications.deliveries(workspaceSlug, app.id),
    staleTime: 10_000,
    refetchInterval: (q) =>
      q.state.data?.some((d) => d.status === "pending") ? 3_000 : false,
  });

  const rotate = async () => {
    setRotating(true);
    try {
      const next = await api.connect.applications.rotateWebhookSecret(workspaceSlug, app.id);
      await refresh(next);
      setConfirmOpen(false);
      setRevealed(true);
      toastManager.add({
        type: "success",
        title: "Signing secret rotated",
        description: "Update your webhook handler with the new secret.",
        timeout: 4000,
      });
    } catch (err) {
      toastError("Could not rotate signing secret", err);
    } finally {
      setRotating(false);
    }
  };

  const sendTest = async () => {
    setTesting(true);
    try {
      const delivery = await api.connect.applications.testWebhook(workspaceSlug, app.id);
      queryClient.setQueryData<WebhookDeliveryDTO[]>(
        queryKeys.connectDeliveries(workspaceSlug, app.id),
        (prev) => [delivery, ...(prev ?? []).filter((d) => d.id !== delivery.id)],
      );
      setExpanded(delivery.id);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.connectDeliveries(workspaceSlug, app.id),
      });
      toastManager.add({
        type: delivery.status === "failed" ? "error" : "success",
        title:
          delivery.status === "failed"
            ? "Test webhook failed"
            : delivery.status === "succeeded"
              ? "Test webhook delivered"
              : "Test webhook queued",
        description: delivery.lastError ?? undefined,
        timeout: 4000,
      });
    } catch (err) {
      toastError("Could not send test webhook", err);
    } finally {
      setTesting(false);
    }
  };

  const secret = app.webhookSigningSecret;
  const masked = `${secret.slice(0, 6)}${"•".repeat(Math.max(8, Math.min(24, secret.length - 6)))}`;

  return (
    <SettingsSection
      title="Webhooks"
      description="Signed POSTs to your webhook URL. Verify the Connect-Signature header with the signing secret below."
    >
      <div className={`${PANEL} space-y-4 p-5`}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <FieldLabel>Endpoint</FieldLabel>
            {app.webhookUrl ? (
              <CopyField value={app.webhookUrl} />
            ) : (
              <div className="flex h-[34px] items-center rounded-lg border border-dashed border-border/60 px-2.5 text-[12px] text-muted-foreground">
                Not configured — set a webhook URL above.
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Signing secret</FieldLabel>
            <div className="flex min-w-0 items-center gap-1 rounded-lg border border-border/60 bg-muted/30 py-1 ps-2.5 pe-1">
              <code className="min-w-0 flex-1 truncate font-mono text-[12px]">
                {revealed ? secret : masked}
              </code>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="text-muted-foreground"
                aria-label={revealed ? "Hide signing secret" : "Reveal signing secret"}
                onClick={() => setRevealed((v) => !v)}
              >
                {revealed ? <EyeOffIcon className="size-3.5" /> : <EyeIcon className="size-3.5" />}
              </Button>
              <CopyButton value={secret} label="Copy signing secret" />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/40 pt-4">
          {!canManage ? (
            <span className="me-auto text-[11px] text-muted-foreground">
              Requires <code className="font-mono">connect.applications.manage</code>.
            </span>
          ) : null}
          <Button
            size="sm"
            variant="ghost"
            className="gap-1.5 text-muted-foreground"
            disabled={!canManage}
            onClick={() => setConfirmOpen(true)}
          >
            <RefreshCwIcon className="size-3.5" />
            Rotate signing secret
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={!canManage || !app.webhookUrl}
            loading={testing}
            onClick={() => void sendTest()}
            title={app.webhookUrl ? undefined : "Set a webhook URL first"}
          >
            <SendIcon className="size-3.5" />
            Send test webhook
          </Button>
        </div>
      </div>

      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-[13px] font-semibold">Recent deliveries</h3>
          <Button
            size="xs"
            variant="ghost"
            className="gap-1 text-muted-foreground"
            onClick={() => void deliveriesQuery.refetch()}
            disabled={deliveriesQuery.isFetching}
          >
            <RefreshCwIcon className={`size-3 ${deliveriesQuery.isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
        {deliveriesQuery.isPending ? (
          <Skeleton className="h-32 w-full rounded-xl" />
        ) : deliveriesQuery.isError ? (
          <ErrorNotice error={deliveriesQuery.error} what="deliveries" />
        ) : deliveriesQuery.data.length === 0 ? (
          <EmptyNotice>
            No deliveries yet. Events appear here once an end user connects a
            domain — or send a test webhook to try your endpoint.
          </EmptyNotice>
        ) : (
          <DeliveriesTable
            deliveries={deliveriesQuery.data}
            expanded={expanded}
            onToggle={(id) => setExpanded((cur) => (cur === id ? null : id))}
          />
        )}
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogPopup>
          <AlertDialogHeader>
            <AlertDialogTitle>Rotate webhook signing secret?</AlertDialogTitle>
            <AlertDialogDescription>
              Deliveries are signed with the new secret immediately. Your handler
              will reject them until you deploy the new secret.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" render={<AlertDialogClose />} disabled={rotating}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void rotate()} loading={rotating}>
              Rotate signing secret
            </Button>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>
    </SettingsSection>
  );
}

function DeliveriesTable({
  deliveries,
  expanded,
  onToggle,
}: {
  deliveries: WebhookDeliveryDTO[];
  expanded: string | null;
  onToggle: (id: string) => void;
}) {
  return (
    <div className={`${PANEL} overflow-hidden`}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-6" />
            <TableHead>Event</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Attempts</TableHead>
            <TableHead className="text-right">Code</TableHead>
            <TableHead className="text-right">Time</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {deliveries.map((d) => {
            const open = expanded === d.id;
            return (
              <Fragment key={d.id}>
                <TableRow
                  className="cursor-pointer"
                  onClick={() => onToggle(d.id)}
                  aria-expanded={open}
                >
                  <TableCell className="pe-0">
                    <ChevronRightIcon
                      className={`size-3.5 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`}
                    />
                  </TableCell>
                  <TableCell>
                    <code className="font-mono text-[12px]">{d.eventType}</code>
                    {d.payload.data.connection ? (
                      <span className="ms-2 text-[12px] text-muted-foreground">
                        {d.payload.data.connection.domain}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <DeliveryStatusBadge status={d.status} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{d.attempts}</TableCell>
                  <TableCell className="text-right font-mono text-[12px] tabular-nums">
                    {d.lastStatusCode ?? "—"}
                  </TableCell>
                  <TableCell
                    className="text-right text-[12px] text-muted-foreground tabular-nums"
                    title={formatDateTime(d.createdAt)}
                  >
                    {formatRelative(d.createdAt)}
                  </TableCell>
                </TableRow>
                {open ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={6} className="bg-muted/15 p-4 whitespace-normal">
                      <dl className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <Fact label="Delivery ID">
                          <code className="font-mono">{d.id}</code>
                        </Fact>
                        <Fact label="URL">{d.url}</Fact>
                        <Fact label="Created">{formatDateTime(d.createdAt)}</Fact>
                        <Fact label="Delivered">{formatDateTime(d.deliveredAt)}</Fact>
                      </dl>
                      {d.lastError ? (
                        <p className="mb-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 font-mono text-[12px] text-rose-700 dark:text-rose-300">
                          {d.lastError}
                        </p>
                      ) : null}
                      <JsonBlock value={d.payload} />
                    </TableCell>
                  </TableRow>
                ) : null}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Quick start                                                                */
/* -------------------------------------------------------------------------- */

export function serverSnippet(applicationId: string, apiOrigin = API_URL): string {
  return `curl -X POST ${apiOrigin}/v1/connect/token \\
  -H 'content-type: application/json' \\
  -d '{"applicationId":"${applicationId}","secret":"'"$CONNECT_SECRET"'"}'
# → {"auth_token":"eyJ…","expires_in":3600}`;
}

export function clientSnippet(applicationId: string, apiOrigin = API_URL): string {
  return `import { showConnect } from "@orbit/connect-js";

// authToken comes from your backend (see the server snippet)
showConnect({
  applicationId: "${applicationId}",
  token: authToken,
  apiOrigin: "${apiOrigin}",
  prefilledDomain: "acme.com",
  userId: "cus_123",
  dnsRecords: {
    domain: [
      { type: "A", host: "@", value: "76.76.21.21", ttl: 300 },
      { type: "CNAME", host: "www", value: "cname.yourapp.com" },
    ],
    subDomain: [{ type: "CNAME", host: "@", value: "cname.yourapp.com" }],
  },
  onSuccess: ({ domain, connectionId, setupType }) => {
    console.log("connected", domain, connectionId, setupType);
  },
  onClose: ({ success, lastStatus }) => {
    console.log("closed", success, lastStatus);
  },
});`;
}

export function scriptTagSnippet(applicationId: string, apiOrigin = API_URL): string {
  return `<script src="${apiOrigin}/sdk/connect.js"></script>
<script>
  // window.Connect is defined by the script above
  Connect.showConnect({
    applicationId: "${applicationId}",
    token: authToken,
    dnsRecords: [{ type: "CNAME", host: "@", value: "cname.yourapp.com" }],
  });
</script>`;
}

function QuickStartSection({ app }: { app: ConnectApplicationDTO }) {
  const [tab, setTab] = useState<"npm" | "script">("npm");
  const server = useMemo(() => serverSnippet(app.id), [app.id]);
  const client = useMemo(
    () => (tab === "npm" ? clientSnippet(app.id) : scriptTagSnippet(app.id)),
    [app.id, tab],
  );
  return (
    <SettingsSection
      title="Quick start"
      description="Pre-filled with this application's ID. Keep the secret on your server."
    >
      <div className="space-y-4">
        <div>
          <div className="mb-1.5 flex items-center gap-2 text-[12px] font-medium">
            <MutedPill>1</MutedPill> Mint a token on your server
          </div>
          <CodeBlock code={server} label="bash" />
        </div>
        <div>
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[12px] font-medium">
              <MutedPill>2</MutedPill> Open the modal in the browser
            </div>
            <Tabs value={tab} onValueChange={(v) => setTab(v as "npm" | "script")}>
              <TabsList>
                <TabsTab value="npm">npm</TabsTab>
                <TabsTab value="script">Script tag</TabsTab>
              </TabsList>
            </Tabs>
          </div>
          <CodeBlock code={client} label={tab === "npm" ? "js" : "html"} />
        </div>
      </div>
    </SettingsSection>
  );
}

/* -------------------------------------------------------------------------- */
/* Danger zone                                                                */
/* -------------------------------------------------------------------------- */

function DangerZone({ app, workspaceSlug }: { app: ConnectApplicationDTO; workspaceSlug: string }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const runDelete = async () => {
    setBusy(true);
    try {
      await api.connect.applications.delete(workspaceSlug, app.id);
      queryClient.removeQueries({ queryKey: queryKeys.connectApplication(workspaceSlug, app.id) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.connect(workspaceSlug) });
      toastManager.add({
        type: "success",
        title: "Application deleted",
        description: `${app.name} has been removed.`,
        timeout: 4000,
      });
      setOpen(false);
      void navigate({ to: "/d/$workspaceSlug/connect/applications", params: { workspaceSlug } });
    } catch (err) {
      toastError("Could not delete application", err);
      setBusy(false);
    }
  };

  return (
    <SettingsSection
      title="Danger zone"
      description="Deleting an application revokes its credentials immediately."
    >
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-rose-500/30 bg-rose-500/5 p-5">
        <div className="min-w-0 flex-1">
          <h3 className="text-[13px] font-semibold">Delete this application</h3>
          <p className="mt-1 text-[12px] text-muted-foreground leading-relaxed [text-wrap:pretty]">
            The modal stops working for every integration using{" "}
            <code className="font-mono">{app.id}</code>. Existing DNS records on
            your users' domains are left untouched.
          </p>
        </div>
        <Button variant="destructive-outline" size="sm" onClick={() => setOpen(true)}>
          Delete application
        </Button>
      </div>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogPopup>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {app.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Its credentials stop working immediately and its{" "}
              {app.domainCount} domain connection{app.domainCount === 1 ? "" : "s"}{" "}
              will no longer be tracked. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" render={<AlertDialogClose />} disabled={busy}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void runDelete()} loading={busy}>
              Delete application
            </Button>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>
    </SettingsSection>
  );
}
