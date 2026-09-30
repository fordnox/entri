import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRightIcon, BookOpenIcon, FlaskConicalIcon, PlusIcon } from "lucide-react";
import type { DomainConnectionStatus } from "@orbit/shared/connect";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@orbit/ui/card";
import { Button } from "@orbit/ui/button";
import { Skeleton } from "@orbit/ui/skeleton";
import { api } from "@/lib/api/client";
import { useCan } from "@/lib/permissions";
import { queryKeys } from "@/lib/query-keys";
import { useWorkspaceSlug } from "@/lib/use-workspace-slug";
import { useConnectApplications } from "@/pages/connect/applications-page";
import { PANEL } from "@/pages/connect/shared";

export function WorkspaceHomePage(): React.ReactElement {
  const slug = useWorkspaceSlug() ?? "";
  const canViewApps = useCan("connect.applications.view");
  const canManageApps = useCan("connect.applications.manage");
  const canViewDomains = useCan("connect.domains.view");

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overscroll-y-contain bg-background">
      <div className="mx-auto w-full max-w-4xl space-y-8 px-4 py-8 md:px-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
            <p className="text-sm text-muted-foreground">
              Let your users connect their own domains to your product.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canManageApps ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  render={<Link to="/d/$workspaceSlug/connect/playground" params={{ workspaceSlug: slug }} />}
                >
                  <FlaskConicalIcon className="size-3.5" />
                  Open playground
                </Button>
                <Button
                  size="sm"
                  className="gap-1.5"
                  render={<Link to="/d/$workspaceSlug/connect/applications" params={{ workspaceSlug: slug }} />}
                >
                  <PlusIcon className="size-3.5" />
                  New application
                </Button>
              </>
            ) : null}
          </div>
        </header>

        {canViewApps || canViewDomains ? (
          <ConnectOverview slug={slug} canViewApps={canViewApps} canViewDomains={canViewDomains} />
        ) : null}

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Integration guide</CardTitle>
              <CardDescription>Five steps from secret to signed webhook.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                render={
                  <Link to="/d/$workspaceSlug/connect/guide" params={{ workspaceSlug: slug }}>
                    <BookOpenIcon className="size-3.5" />
                    Read the guide
                  </Link>
                }
              />
            </CardContent>
          </Card>
          {/* +feature:billing */}
          <Card>
            <CardHeader>
              <CardTitle>Billing</CardTitle>
              <CardDescription>Manage your plan and invoices.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                size="sm"
                render={
                  <Link to="/d/$workspaceSlug/billing" params={{ workspaceSlug: slug }}>
                    Open billing
                  </Link>
                }
              />
            </CardContent>
          </Card>
          {/* -feature:billing */}
          <Card>
            <CardHeader>
              <CardTitle>Settings</CardTitle>
              <CardDescription>Workspace-wide configuration.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                size="sm"
                render={
                  <Link
                    to="/d/$workspaceSlug/workspace/settings/$section"
                    params={{ workspaceSlug: slug, section: "general" }}
                  >
                    Open settings
                  </Link>
                }
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function useDomainCount(slug: string, status: DomainConnectionStatus, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.connectDomainCount(slug, status),
    queryFn: () => api.connect.domains.list(slug, { status }),
    enabled: Boolean(slug) && enabled,
    staleTime: 30_000,
    select: (page) => ({ count: page.items.length, more: page.nextCursor !== null }),
  });
}

function ConnectOverview({
  slug,
  canViewApps,
  canViewDomains,
}: {
  slug: string;
  canViewApps: boolean;
  canViewDomains: boolean;
}) {
  const apps = useConnectApplications(slug, canViewApps);
  const connected = useDomainCount(slug, "connected", canViewDomains);
  const propagating = useDomainCount(slug, "propagating", canViewDomains);
  const failed = useDomainCount(slug, "failed", canViewDomains);

  const noApps = canViewApps && apps.data?.length === 0;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Connect</h2>
        {canViewDomains ? (
          <Link
            to="/d/$workspaceSlug/connect/domains"
            params={{ workspaceSlug: slug }}
            className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground"
          >
            All domains <ArrowRightIcon className="size-3" />
          </Link>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {canViewApps ? (
          <Stat
            label="Applications"
            loading={apps.isPending}
            error={apps.isError}
            value={apps.data?.length}
            to={{ to: "/d/$workspaceSlug/connect/applications", params: { workspaceSlug: slug } }}
          />
        ) : null}
        {canViewDomains ? (
          <>
            <Stat
              label="Connected"
              tone="text-emerald-600 dark:text-emerald-400"
              loading={connected.isPending}
              error={connected.isError}
              value={connected.data?.count}
              more={connected.data?.more}
              to={{ to: "/d/$workspaceSlug/connect/domains", params: { workspaceSlug: slug }, search: { status: "connected" } }}
            />
            <Stat
              label="Propagating"
              tone="text-amber-600 dark:text-amber-400"
              loading={propagating.isPending}
              error={propagating.isError}
              value={propagating.data?.count}
              more={propagating.data?.more}
              to={{ to: "/d/$workspaceSlug/connect/domains", params: { workspaceSlug: slug }, search: { status: "propagating" } }}
            />
            <Stat
              label="Failed"
              tone="text-rose-600 dark:text-rose-400"
              loading={failed.isPending}
              error={failed.isError}
              value={failed.data?.count}
              more={failed.data?.more}
              to={{ to: "/d/$workspaceSlug/connect/domains", params: { workspaceSlug: slug }, search: { status: "failed" } }}
            />
          </>
        ) : null}
      </div>
      {noApps ? (
        <div className={`${PANEL} flex flex-wrap items-center gap-4 p-5`}>
          <div className="min-w-0 flex-1">
            <h3 className="text-[14px] font-semibold">Get started with Connect</h3>
            <p className="mt-1 text-[13px] text-muted-foreground leading-relaxed [text-wrap:pretty]">
              Create an application to get credentials, then launch the modal from
              the playground to connect your first domain.
            </p>
          </div>
          <Button
            size="sm"
            render={<Link to="/d/$workspaceSlug/connect/applications" params={{ workspaceSlug: slug }} />}
          >
            Create application
          </Button>
        </div>
      ) : null}
    </section>
  );
}

type StatLink =
  | { to: "/d/$workspaceSlug/connect/applications"; params: { workspaceSlug: string } }
  | {
      to: "/d/$workspaceSlug/connect/domains";
      params: { workspaceSlug: string };
      search: { status: DomainConnectionStatus };
    };

function Stat({
  label,
  value,
  more,
  loading,
  error,
  tone,
  to,
}: {
  label: string;
  value: number | undefined;
  more?: boolean;
  loading: boolean;
  error: boolean;
  tone?: string;
  to: StatLink;
}) {
  return (
    <Link
      {...to}
      className={`${PANEL} group block p-4 transition-colors hover:bg-muted/30`}
    >
      <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className={`mt-2 text-[24px] font-semibold leading-none tabular-nums ${tone ?? ""}`}>
        {loading ? (
          <Skeleton className="h-6 w-10" />
        ) : error ? (
          <span className="text-[13px] font-normal text-muted-foreground">—</span>
        ) : (
          <>
            {value ?? 0}
            {more ? "+" : ""}
          </>
        )}
      </div>
    </Link>
  );
}
