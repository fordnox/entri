import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckIcon,
  CopyIcon,
  ExternalLinkIcon,
  PlayIcon,
  RefreshCcwIcon,
  TriangleAlertIcon,
  UsersIcon,
  WrenchIcon,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { Alert, AlertDescription, AlertTitle } from "@orbit/ui/alert";
import { Badge } from "@orbit/ui/badge";
import { Button } from "@orbit/ui/button";
import { Input } from "@orbit/ui/input";
import { toastManager } from "@orbit/ui/toast";
// +feature:auth-admin
import type { AuditEntryDTO } from "@orbit/shared/dto";
// -feature:auth-admin
import { api } from "@/lib/api/client";
import { queryKeys } from "@/lib/query-keys";
import { memberDisplayName, useWorkspace, type Member } from "@/lib/workspace";
// +feature:realtime
import { useRealtimeClient } from "@/lib/db/provider";
// -feature:realtime
import { useWorkspaceSlug } from "@/lib/use-workspace-slug";

export function DevPage() {
  const workspaceSlug = useWorkspaceSlug();
  // +feature:realtime
  const realtime = useRealtimeClient();
  // -feature:realtime

  if (!workspaceSlug) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain">
      <div className="mx-auto w-full max-w-3xl space-y-8 px-4 py-8 md:px-6">
        <Alert variant="warning">
          <TriangleAlertIcon />
          <AlertTitle>Dev-only feature inventory — delete before shipping</AlertTitle>
          <AlertDescription>
            This page is for verifying which opt-in features are wired into the
            current build. Remove{" "}
            <code>apps/web-tanstack/src/pages/dev-page.tsx</code> and its route
            file before going to production.
          </AlertDescription>
        </Alert>

        <ActiveProvidersPanel />

        {/* +feature:auth-magic-link */}
        <MagicLinkPanel />
        {/* -feature:auth-magic-link */}

        <SeedActionsPanel slug={workspaceSlug} />

        {/* +feature:jobs */}
        <RunJobPanel />
        {/* -feature:jobs */}

        {/* +feature:audit-log */}
        <RecentAuditPanel slug={workspaceSlug} />
        {/* -feature:audit-log */}

        <div>
          <h2 className="font-semibold text-lg">Feature inventory</h2>
          <p className="mt-1 max-w-prose text-[13px] text-muted-foreground">
            Each card maps to a feature in <code>features.json</code>. Cards
            disappear when the matching feature is stripped by the generator
            CLI.
          </p>
        </div>

        <div className="space-y-3">

          {/* +feature:billing */}
          <FeatureCard
            name="billing"
            label="Billing (subscriptions + webhooks)"
            description="Subscriptions via the BillingProvider port. Active provider comes from BILLING_PROVIDER in apps/api/.env."
          >
            <Button
              variant="outline"
              size="sm"
              render={
                <Link
                  to="/d/$workspaceSlug/workspace/settings/$section"
                  params={{ workspaceSlug, section: "billing" }}
                />
              }
            >
              Open billing settings
            </Button>
          </FeatureCard>
          {/* -feature:billing */}

          {/* +feature:uploads */}
          <FeatureCard
            name="uploads"
            label="File uploads (UploadThing / S3 / R2)"
            description="`/v1/uploads/*` endpoints are mounted. Set UPLOADTHING_TOKEN or the S3_* keys in apps/api/.env."
          />
          {/* -feature:uploads */}


          {/* +feature:realtime */}
          <FeatureCard
            name="realtime"
            label="Realtime (WebSocket + presence)"
            description="useRealtimeClient() returns a live client when the workspace WS is connected."
            extraStatus={
              realtime ? (
                <Badge variant="success">connected</Badge>
              ) : (
                <Badge variant="warning">disconnected</Badge>
              )
            }
          />
          {/* -feature:realtime */}

          {/* +feature:auth-admin */}
          <AuthAdminCard />
          {/* -feature:auth-admin */}

          {/* +feature:auth-oauth */}
          <FeatureCard
            name="auth-oauth"
            label="OAuth providers (Google + Apple)"
            description="Social sign-in is exposed on the login screen via better-auth socialProviders."
          >
            <Button
              variant="outline"
              size="sm"
              render={<a href="/login" target="_blank" rel="noreferrer" />}
            >
              <ExternalLinkIcon />
              Open /login
            </Button>
          </FeatureCard>
          {/* -feature:auth-oauth */}
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Active providers — at-a-glance view of which adapters are wired in
// ───────────────────────────────────────────────────────────────────────────
function ActiveProvidersPanel() {
  const query = useQuery({
    queryKey: ["dev", "active-providers"],
    queryFn: () => api.dev.getActiveProviders(),
    staleTime: 60_000,
  });
  const data = query.data;

  return (
    <Section
      title="Active providers"
      subtitle="What's actually wired into the running container — not just what's in features.json."
    >
      {!data ? (
        <p className="text-[13px] text-muted-foreground">Loading…</p>
      ) : (
        <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-[13px] sm:grid-cols-[max-content_1fr]">
          <ProviderRow label="NODE_ENV" value={data.nodeEnv} />
          <ProviderRow label="Mailer" value={data.mailer} />
          {/* +feature:billing */}
          <ProviderRow
            label="Billing"
            value={
              data.billing.enabled
                ? data.billing.provider ?? "—"
                : "disabled"
            }
            tone={data.billing.enabled ? "ok" : "muted"}
          />
          {/* -feature:billing */}
          {/* +feature:jobs */}
          <ProviderRow
            label="Jobs"
            value={
              data.jobs.enabled
                ? `${data.jobs.provider ?? "—"} (${data.jobs.registered.length} registered)`
                : "disabled"
            }
            tone={data.jobs.enabled ? "ok" : "muted"}
          />
          {/* -feature:jobs */}
          {/* +feature:uploads */}
          <ProviderRow
            label="Uploads"
            value={data.uploads.provider}
            tone={data.uploads.enabled ? "ok" : "muted"}
          />
          {/* -feature:uploads */}
        </dl>
      )}
    </Section>
  );
}

function ProviderRow({
  label,
  value,
  tone = "ok",
}: {
  label: string;
  value: string;
  tone?: "ok" | "warn" | "muted";
}) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="flex items-center gap-2 font-mono text-[12.5px]">
        <span
          className={
            tone === "warn"
              ? "text-amber-500"
              : tone === "muted"
                ? "text-muted-foreground"
                : "text-foreground"
          }
        >
          {value}
        </span>
      </dd>
    </>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Magic link fetcher
// ───────────────────────────────────────────────────────────────────────────
// +feature:auth-magic-link
function MagicLinkPanel() {
  const [email, setEmail] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const fetchMutation = useMutation({
    mutationFn: (e: string) => api.dev.getLastMagicLink(e),
    onSuccess: (res) => setLink(res.link),
  });

  const onCopy = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Section
      title="Last magic link"
      subtitle="Pulls the most recent magic link for the given email from the dev mailer cache."
    >
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (email.trim()) fetchMutation.mutate(email.trim().toLowerCase());
        }}
      >
        <Input
          type="email"
          value={email}
          placeholder="user@example.com"
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1"
        />
        <Button
          type="submit"
          variant="outline"
          size="sm"
          disabled={!email.trim() || fetchMutation.isPending}
          loading={fetchMutation.isPending}
        >
          Fetch
        </Button>
      </form>
      {fetchMutation.isSuccess ? (
        link ? (
          <div className="mt-3 flex items-center gap-2 rounded-md border border-border/60 bg-muted/40 px-3 py-2">
            <code className="flex-1 truncate text-[12px]">{link}</code>
            <Button
              variant="ghost"
              size="sm"
              onClick={onCopy}
              aria-label="Copy magic link"
            >
              {copied ? <CheckIcon /> : <CopyIcon />}
            </Button>
            <Button
              variant="outline"
              size="sm"
              render={<a href={link} target="_blank" rel="noreferrer" />}
            >
              Open
            </Button>
          </div>
        ) : (
          <p className="mt-3 text-[12px] text-muted-foreground">
            No magic link cached for that email. Trigger one from the login
            page first.
          </p>
        )
      ) : null}
    </Section>
  );
}
// -feature:auth-magic-link

// ───────────────────────────────────────────────────────────────────────────
// Seed actions
// ───────────────────────────────────────────────────────────────────────────
function SeedActionsPanel({ slug }: { slug: string }) {
  const queryClient = useQueryClient();
  const seedMembers = useMutation({
    mutationFn: (count: number) => api.dev.seedMembers(slug, count),
    onSuccess: (res) => {
      toastManager.add({
        type: "success",
        title: `Added ${res.created.length} member${res.created.length === 1 ? "" : "s"}`,
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaceSnapshot(slug) });
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaceMembers(slug) });
    },
    onError: (err) =>
      toastManager.add({
        type: "danger",
        title: "Failed to seed members",
        description: err instanceof Error ? err.message : "unknown error",
      }),
  });

  return (
    <Section
      title="Seed data"
      subtitle="Drop fake users / teams into the current workspace. Useful for stress-testing layouts and demoing populated states."
    >
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => seedMembers.mutate(5)}
          disabled={seedMembers.isPending}
          loading={seedMembers.isPending}
        >
          <UsersIcon />
          Add 5 members
        </Button>
      </div>
    </Section>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Run a job ad-hoc
// ───────────────────────────────────────────────────────────────────────────
// +feature:jobs
function RunJobPanel() {
  const providers = useQuery({
    queryKey: ["dev", "active-providers"],
    queryFn: () => api.dev.getActiveProviders(),
    staleTime: 60_000,
  });
  const jobs = useQuery({
    queryKey: ["dev", "jobs"],
    queryFn: () => api.dev.listJobs(),
    staleTime: 60_000,
  });
  const [name, setName] = useState<string>("");

  const runMutation = useMutation({
    mutationFn: (n: string) => api.dev.runJob(n),
    onSuccess: (res) =>
      toastManager.add({
        type: "success",
        title: `Enqueued '${res.name}'`,
      }),
    onError: (err) =>
      toastManager.add({
        type: "danger",
        title: "Failed to enqueue job",
        description: err instanceof Error ? err.message : "unknown error",
      }),
  });

  const items = jobs.data?.items ?? [];
  const selectedName = name || items[0]?.name || "";
  const jobsEnabled = providers.data?.jobs.enabled ?? true;

  return (
    <Section
      title="Run a job"
      subtitle="Enqueue a registered job with an empty payload. Use this to exercise handlers without waiting for their cron to fire."
    >
      {!jobsEnabled ? (
        <p className="text-[13px] text-muted-foreground">
          Background jobs are not configured. Set{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
            JOBS_PROVIDER
          </code>{" "}
          in <code className="font-mono text-[11px]">apps/api/.env</code> (e.g.{" "}
          <code className="font-mono text-[11px]">graphile</code>) and restart
          the API to enable enqueuing.
        </p>
      ) : items.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">
          No jobs registered.
        </p>
      ) : (
        <div className="flex gap-2">
          <select
            value={selectedName}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 rounded-md border border-border/60 bg-background px-3 py-1.5 font-mono text-[12px]"
          >
            {items.map((j) => (
              <option key={j.name} value={j.name}>
                {j.name}
                {j.schedule ? ` · cron '${j.schedule}'` : ""}
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => runMutation.mutate(selectedName)}
            disabled={!selectedName || runMutation.isPending}
            loading={runMutation.isPending}
          >
            <PlayIcon />
            Enqueue
          </Button>
        </div>
      )}
    </Section>
  );
}
// -feature:jobs

// ───────────────────────────────────────────────────────────────────────────
// Recent audit entries
// ───────────────────────────────────────────────────────────────────────────
// +feature:audit-log
function RecentAuditPanel({ slug }: { slug: string }) {
  const queryClient = useQueryClient();
  const ws = useWorkspace();
  const audit = useQuery({
    queryKey: ["dev", "audit", slug],
    queryFn: () => api.workspaces.listAudit(slug, { limit: 10 }),
    staleTime: 5_000,
  });

  const memberById = useMemo(() => {
    const map = new Map<string, Member>();
    for (const m of ws?.members ?? []) map.set(m.id, m);
    return map;
  }, [ws?.members]);

  return (
    <Section
      title="Recent audit entries"
      subtitle="Live tail of the workspace audit log — each row was materialised by the AuditProjector after a domain event committed."
      action={
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            queryClient.invalidateQueries({ queryKey: ["dev", "audit", slug] })
          }
          aria-label="Refresh audit log"
        >
          <RefreshCcwIcon />
        </Button>
      }
    >
      {!audit.data ? (
        <p className="text-[13px] text-muted-foreground">Loading…</p>
      ) : audit.data.items.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">
          No entries yet — try seeding members or teams above.
        </p>
      ) : (
        <ul className="divide-y divide-border/40 rounded-md border border-border/60">
          {audit.data.items.map((entry) => (
            <AuditRow
              key={entry.id}
              entry={entry}
              memberById={memberById}
            />
          ))}
        </ul>
      )}
    </Section>
  );
}

function AuditRow({
  entry,
  memberById,
}: {
  entry: AuditEntryDTO;
  memberById: Map<string, Member>;
}) {
  const when = useMemo(
    () => new Date(entry.occurredAt).toLocaleTimeString(),
    [entry.occurredAt],
  );
  const actor = resolveActor(entry, memberById);
  return (
    <li className="flex items-center justify-between gap-3 px-3 py-2 text-[12.5px]">
      <div className="min-w-0 flex-1">
        <code className="font-mono">{entry.action}</code>
        {entry.targetType ? (
          <span className="ml-2 text-muted-foreground">
            on <code className="font-mono">{entry.targetType}</code>
          </span>
        ) : null}
        <span className="ml-2 text-muted-foreground">
          by{" "}
          <span
            className={actor.muted ? "text-muted-foreground" : "text-foreground"}
            title={actor.title}
          >
            {actor.label}
          </span>
        </span>
      </div>
      <span className="shrink-0 text-muted-foreground">{when}</span>
    </li>
  );
}

function resolveActor(
  entry: AuditEntryDTO,
  memberById: Map<string, Member>,
): { label: string; title?: string; muted: boolean } {
  if (entry.actorKind === "system") {
    return { label: "system", muted: true };
  }
  if (entry.actorMemberId) {
    const m = memberById.get(entry.actorMemberId);
    if (m) {
      return {
        label: memberDisplayName(m),
        title: m.email,
        muted: false,
      };
    }
    return {
      label: "former member",
      title: entry.actorMemberId,
      muted: true,
    };
  }
  if (entry.actorUserId) {
    return {
      label: "external user",
      title: entry.actorUserId,
      muted: true,
    };
  }
  return { label: "unknown", muted: true };
}
// -feature:audit-log

// ───────────────────────────────────────────────────────────────────────────
// Existing AuthAdminCard
// ───────────────────────────────────────────────────────────────────────────
// +feature:auth-admin
function AuthAdminCard() {
  const [lastResult, setLastResult] = useState<
    { role: string } | { error: string } | null
  >(null);

  const promote = useMutation({
    mutationFn: () => api.dev.makeMeAdmin(),
    onSuccess: (data) => setLastResult({ role: data.role }),
    onError: (err) =>
      setLastResult({ error: err instanceof Error ? err.message : "failed" }),
  });

  return (
    <FeatureCard
      name="auth-admin"
      label="App-level admin (better-auth admin plugin)"
      description="Adds app-wide role/banned fields on users. The dev endpoint below self-promotes the current session to role=admin so you can exercise the admin endpoints (listUsers, setRole, banUser, impersonate)."
      extraStatus={
        lastResult && "role" in lastResult ? (
          <Badge variant="success">role={lastResult.role}</Badge>
        ) : null
      }
    >
      <Button
        variant="outline"
        size="sm"
        onClick={() => promote.mutate()}
        disabled={promote.isPending}
        loading={promote.isPending}
      >
        Promote me to app admin
      </Button>
      {lastResult && "error" in lastResult ? (
        <span className="text-[12px] text-destructive">
          {lastResult.error}
        </span>
      ) : null}
    </FeatureCard>
  );
}
// -feature:auth-admin

// ───────────────────────────────────────────────────────────────────────────
// Layout primitives
// ───────────────────────────────────────────────────────────────────────────
function Section({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border/60 bg-card/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-sm">{title}</h2>
          {subtitle ? (
            <p className="mt-0.5 text-[12.5px] text-muted-foreground [text-wrap:pretty]">
              {subtitle}
            </p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function FeatureCard({
  name,
  label,
  description,
  extraStatus,
  children,
}: {
  name: string;
  label: string;
  description: ReactNode;
  extraStatus?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/40 px-4 py-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="font-semibold text-sm">{label}</h3>
            <code className="text-[11px] text-muted-foreground">{name}</code>
          </div>
          <p className="mt-1 text-[13px] text-muted-foreground [text-wrap:pretty]">
            {description}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {extraStatus}
          <Badge variant="success">enabled</Badge>
        </div>
      </div>
      {children ? (
        <div className="mt-3 flex flex-wrap gap-2">{children}</div>
      ) : null}
    </div>
  );
}
