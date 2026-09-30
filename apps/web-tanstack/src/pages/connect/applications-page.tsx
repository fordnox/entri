import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { type FormEvent, useEffect, useState } from "react";
import { AppWindowIcon, ChevronRightIcon, PlusIcon } from "lucide-react";
import type { ApplicationWithSecretDTO, ConnectApplicationDTO } from "@orbit/shared/connect";
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
import { Input } from "@orbit/ui/input";
import { Label } from "@orbit/ui/label";
import { Skeleton } from "@orbit/ui/skeleton";
import { Textarea } from "@orbit/ui/textarea";
import { toastManager } from "@orbit/ui/toast";
import { ApiError, api } from "@/lib/api/client";
import { useCan } from "@/lib/permissions";
import { queryKeys } from "@/lib/query-keys";
import { useWorkspaceSlug } from "@/lib/use-workspace-slug";
import { useWorkspace } from "@/lib/workspace";
import {
  AppIcon,
  CopyButton,
  ErrorNotice,
  PANEL,
  PageHeader,
  PermissionNotice,
  SecretOnceDialog,
  formatDate,
  parseLines,
} from "./shared";

export function useConnectApplications(workspaceSlug: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: queryKeys.connectApplications(workspaceSlug ?? ""),
    queryFn: () => {
      if (!workspaceSlug) throw new Error("missing slug");
      return api.connect.applications.list(workspaceSlug);
    },
    enabled: Boolean(workspaceSlug) && enabled,
    staleTime: 15_000,
  });
}

export function ConnectApplicationsPage() {
  const ws = useWorkspace();
  const workspaceSlug = useWorkspaceSlug() ?? ws?.slug;
  const canView = useCan("connect.applications.view");
  const canManage = useCan("connect.applications.manage");
  const navigate = useNavigate();

  const [createOpen, setCreateOpen] = useState(false);
  const [created, setCreated] = useState<ApplicationWithSecretDTO | null>(null);

  const appsQuery = useConnectApplications(workspaceSlug, canView);

  if (!ws || !workspaceSlug) return null;

  const header = (
    <PageHeader
      title="Applications"
      description="An application represents one of your products that embeds the Connect modal. Each has its own credentials, allowed origins and webhook endpoint."
      actions={
        canManage ? (
          <Button size="sm" className="gap-1" onClick={() => setCreateOpen(true)}>
            <PlusIcon className="size-3.5" />
            New application
          </Button>
        ) : null
      }
    />
  );

  let body: React.ReactNode;
  if (!canView) {
    body = <PermissionNotice permission="connect.applications.view" what="view Connect applications" />;
  } else if (appsQuery.isPending) {
    body = <ListSkeleton />;
  } else if (appsQuery.isError) {
    body = <ErrorNotice error={appsQuery.error} what="applications" />;
  } else if (appsQuery.data.length === 0) {
    body = (
      <div className={`${PANEL} flex flex-col items-center gap-3 px-6 py-12 text-center`}>
        <div className="rounded-lg bg-muted p-2.5 text-muted-foreground">
          <AppWindowIcon className="size-5" />
        </div>
        <h2 className="text-[15px] font-semibold">No applications yet</h2>
        <p className="max-w-md text-[13px] text-muted-foreground leading-relaxed [text-wrap:pretty]">
          Create an application to get an <code className="font-mono text-[12px]">applicationId</code>{" "}
          and a server secret. Your backend exchanges the secret for a short-lived
          token, and your frontend opens the Connect modal with it so end users
          can point their own domain at your platform.
        </p>
        {canManage ? (
          <Button size="sm" className="mt-1 gap-1" onClick={() => setCreateOpen(true)}>
            <PlusIcon className="size-3.5" />
            Create your first application
          </Button>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            Creating applications requires <code className="font-mono">connect.applications.manage</code>.
          </p>
        )}
      </div>
    );
  } else {
    body = (
      <ul className={`${PANEL} divide-y divide-border/40`}>
        {appsQuery.data.map((app) => (
          <ApplicationRow key={app.id} app={app} workspaceSlug={workspaceSlug} />
        ))}
      </ul>
    );
  }

  return (
    <div>
      {header}
      {body}

      <CreateApplicationDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        workspaceSlug={workspaceSlug}
        onCreated={(res) => setCreated(res)}
      />

      <SecretOnceDialog
        title="Application created"
        secret={created?.secret ?? null}
        applicationId={created?.application.id}
        onClose={() => {
          const id = created?.application.id;
          setCreated(null);
          if (id) {
            void navigate({
              to: "/d/$workspaceSlug/connect/applications/$applicationId",
              params: { workspaceSlug, applicationId: id },
            });
          }
        }}
      />
    </div>
  );
}

function ApplicationRow({ app, workspaceSlug }: { app: ConnectApplicationDTO; workspaceSlug: string }) {
  return (
    <li className="group relative flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/30">
      <AppIcon url={app.iconUrl} name={app.name} />
      <div className="min-w-0 flex-1">
        <Link
          to="/d/$workspaceSlug/connect/applications/$applicationId"
          params={{ workspaceSlug, applicationId: app.id }}
          className="block truncate text-[13px] font-semibold leading-tight after:absolute after:inset-0"
        >
          {app.name}
        </Link>
        <div className="mt-0.5 flex min-w-0 items-center gap-1 text-[11px] text-muted-foreground">
          <code className="truncate font-mono">{app.id}</code>
          <CopyButton value={app.id} label="Copy application ID" className="relative z-10" />
        </div>
      </div>
      <div className="hidden shrink-0 text-right sm:block">
        <div className="text-[13px] font-medium tabular-nums">{app.domainCount}</div>
        <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
          domain{app.domainCount === 1 ? "" : "s"}
        </div>
      </div>
      <div className="hidden w-28 shrink-0 text-right md:block">
        <div className="text-[12px] tabular-nums">{formatDate(app.createdAt)}</div>
        <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">created</div>
      </div>
      <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5" />
    </li>
  );
}

function ListSkeleton() {
  return (
    <div className={`${PANEL} divide-y divide-border/40`}>
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="size-8 rounded-md" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="h-3 w-64" />
          </div>
          <Skeleton className="h-6 w-12" />
        </div>
      ))}
    </div>
  );
}

function CreateApplicationDialog({
  open,
  onOpenChange,
  workspaceSlug,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceSlug: string;
  onCreated: (res: ApplicationWithSecretDTO) => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [iconUrl, setIconUrl] = useState("");
  const [origins, setOrigins] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName("");
    setIconUrl("");
    setOrigins("");
    setWebhookUrl("");
    setError(null);
  }, [open]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await api.connect.applications.create(workspaceSlug, {
        name: name.trim(),
        iconUrl: iconUrl.trim() || null,
        allowedOrigins: parseLines(origins),
        webhookUrl: webhookUrl.trim() || null,
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.connectApplications(workspaceSlug),
      });
      toastManager.add({ type: "success", title: "Application created", timeout: 3500 });
      onOpenChange(false);
      onCreated(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="max-w-lg">
        <form onSubmit={submit} className="contents">
          <DialogHeader>
            <DialogTitle>New application</DialogTitle>
            <DialogDescription>
              Name and icon are shown to your end users in the Connect modal header.
            </DialogDescription>
          </DialogHeader>
          <DialogPanel>
            <ApplicationFields
              idPrefix="new-app"
              name={name}
              setName={setName}
              iconUrl={iconUrl}
              setIconUrl={setIconUrl}
              origins={origins}
              setOrigins={setOrigins}
              webhookUrl={webhookUrl}
              setWebhookUrl={setWebhookUrl}
            />
            {error ? (
              <p className="mt-3 text-[12px] text-rose-600 dark:text-rose-400">{error}</p>
            ) : null}
          </DialogPanel>
          <DialogFooter>
            <Button variant="outline" render={<DialogClose />} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !name.trim()} loading={busy}>
              Create application
            </Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  );
}

/** Shared between the create dialog and the detail settings form. */
export function ApplicationFields({
  idPrefix,
  name,
  setName,
  iconUrl,
  setIconUrl,
  origins,
  setOrigins,
  webhookUrl,
  setWebhookUrl,
  disabled,
}: {
  idPrefix: string;
  name: string;
  setName: (v: string) => void;
  iconUrl: string;
  setIconUrl: (v: string) => void;
  origins: string;
  setOrigins: (v: string) => void;
  webhookUrl: string;
  setWebhookUrl: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset className="space-y-4" disabled={disabled}>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-name`}>Name</Label>
        <Input
          id={`${idPrefix}-name`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Acme Sites"
          maxLength={80}
          required
          disabled={disabled}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-icon`}>Icon URL</Label>
        <Input
          id={`${idPrefix}-icon`}
          type="url"
          value={iconUrl}
          onChange={(e) => setIconUrl(e.target.value)}
          placeholder="https://yourapp.com/icon.png"
          disabled={disabled}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-origins`}>Allowed origins</Label>
        <Textarea
          id={`${idPrefix}-origins`}
          value={origins}
          onChange={(e) => setOrigins(e.target.value)}
          rows={3}
          placeholder={"https://app.yourapp.com\nhttp://localhost:3000"}
          className="font-mono text-[12px]"
          disabled={disabled}
        />
        <p className="text-[11px] text-muted-foreground">
          One per line. Browsers on other origins are rejected. Leave empty to allow any origin.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-webhook`}>Webhook URL</Label>
        <Input
          id={`${idPrefix}-webhook`}
          type="url"
          value={webhookUrl}
          onChange={(e) => setWebhookUrl(e.target.value)}
          placeholder="https://api.yourapp.com/webhooks/connect"
          disabled={disabled}
        />
        <p className="text-[11px] text-muted-foreground">
          Receives signed <code className="font-mono">domain.connected</code>,{" "}
          <code className="font-mono">domain.disconnected</code> and{" "}
          <code className="font-mono">domain.setup_failed</code> events.
        </p>
      </div>
    </fieldset>
  );
}
