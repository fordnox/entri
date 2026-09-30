import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { GlobeIcon, RefreshCwIcon, SearchIcon, Trash2Icon } from "lucide-react";
import type {
  DomainConnectionListItemDTO,
  DomainConnectionStatus,
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
import { InputGroup, InputGroupAddon, InputGroupInput } from "@orbit/ui/input-group";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@orbit/ui/select";
import {
  Sheet,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetPanel,
  SheetPopup,
  SheetTitle,
} from "@orbit/ui/sheet";
import { Skeleton } from "@orbit/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@orbit/ui/table";
import { toastManager } from "@orbit/ui/toast";
import { api } from "@/lib/api/client";
import { useCan } from "@/lib/permissions";
import { queryKeys } from "@/lib/query-keys";
import { useWorkspaceSlug } from "@/lib/use-workspace-slug";
import { useWorkspace } from "@/lib/workspace";
import { useConnectApplications } from "./applications-page";
import {
  CopyButton,
  DOMAIN_STATUS_LABEL,
  DomainStatusBadge,
  EmptyNotice,
  ErrorNotice,
  Fact,
  JsonBlock,
  MutedPill,
  PANEL,
  PageHeader,
  PermissionNotice,
  RecordStatusBadge,
  formatDate,
  formatDateTime,
  formatRelative,
  toastError,
  useDebouncedValue,
} from "./shared";

export type DomainsSearch = {
  applicationId?: string;
  status?: DomainConnectionStatus;
};

const ALL = "__all__";
const STATUSES: DomainConnectionStatus[] = ["pending", "propagating", "connected", "failed"];

export function ConnectDomainsPage({
  search,
  onSearchChange,
}: {
  search: DomainsSearch;
  onSearchChange: (next: DomainsSearch) => void;
}) {
  const ws = useWorkspace();
  const workspaceSlug = useWorkspaceSlug() ?? ws?.slug;
  const canView = useCan("connect.domains.view");
  const canViewApps = useCan("connect.applications.view");
  const canManage = useCan("connect.domains.manage");

  const [qRaw, setQRaw] = useState("");
  const q = useDebouncedValue(qRaw.trim(), 300);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedSeed, setSelectedSeed] = useState<DomainConnectionListItemDTO | null>(null);

  const appsQuery = useConnectApplications(workspaceSlug, canViewApps);

  const filters = useMemo(
    () => ({
      applicationId: search.applicationId,
      status: search.status,
      q: q || undefined,
    }),
    [search.applicationId, search.status, q],
  );

  const domainsQuery = useInfiniteQuery({
    queryKey: queryKeys.connectDomainList(workspaceSlug ?? "", filters),
    queryFn: ({ pageParam }) => {
      if (!workspaceSlug) throw new Error("missing slug");
      return api.connect.domains.list(workspaceSlug, { ...filters, cursor: pageParam });
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: Boolean(workspaceSlug) && canView,
    staleTime: 10_000,
  });

  const rows = useMemo(
    () => domainsQuery.data?.pages.flatMap((p) => p.items) ?? [],
    [domainsQuery.data],
  );

  if (!ws || !workspaceSlug) return null;

  const header = (
    <PageHeader
      title="Domains"
      description="Every domain your end users connected through the modal, across all applications, with live DNS status."
      actions={
        canView ? (
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => void domainsQuery.refetch()}
            disabled={domainsQuery.isFetching}
          >
            <RefreshCwIcon className={`size-3.5 ${domainsQuery.isRefetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        ) : null
      }
    />
  );

  if (!canView) {
    return (
      <div>
        {header}
        <PermissionNotice permission="connect.domains.view" what="view connected domains" />
      </div>
    );
  }

  const appItems = [
    { value: ALL, label: "All applications" },
    ...(appsQuery.data ?? []).map((a) => ({ value: a.id as string, label: a.name })),
  ];
  const statusItems = [
    { value: ALL, label: "Any status" },
    ...STATUSES.map((s) => ({ value: s as string, label: DOMAIN_STATUS_LABEL[s] })),
  ];
  const hasFilters = Boolean(search.applicationId || search.status || q);

  return (
    <div>
      {header}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <InputGroup className="min-w-56 flex-1">
          <InputGroupAddon>
            <SearchIcon aria-hidden />
          </InputGroupAddon>
          <InputGroupInput
            value={qRaw}
            onChange={(e) => setQRaw(e.target.value)}
            placeholder="Search domain or user ID…"
            aria-label="Search domains"
          />
        </InputGroup>
        {canViewApps ? (
          <Select
            items={appItems}
            value={search.applicationId ?? ALL}
            onValueChange={(v) =>
              onSearchChange({
                ...search,
                applicationId: !v || v === ALL ? undefined : (v as string),
              })
            }
          >
            <SelectTrigger className="w-48" aria-label="Filter by application">
              <SelectValue />
            </SelectTrigger>
            <SelectPopup>
              {appItems.map((i) => (
                <SelectItem key={i.value} value={i.value}>
                  {i.label}
                </SelectItem>
              ))}
            </SelectPopup>
          </Select>
        ) : null}
        <Select
          items={statusItems}
          value={search.status ?? ALL}
          onValueChange={(v) =>
            onSearchChange({
              ...search,
              status: !v || v === ALL ? undefined : (v as DomainConnectionStatus),
            })
          }
        >
          <SelectTrigger className="w-40" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectPopup>
            {statusItems.map((i) => (
              <SelectItem key={i.value} value={i.value}>
                {i.label}
              </SelectItem>
            ))}
          </SelectPopup>
        </Select>
        {hasFilters ? (
          <Button
            size="sm"
            variant="ghost"
            className="text-muted-foreground"
            onClick={() => {
              setQRaw("");
              onSearchChange({});
            }}
          >
            Clear
          </Button>
        ) : null}
      </div>

      {domainsQuery.isPending ? (
        <TableSkeleton />
      ) : domainsQuery.isError ? (
        <ErrorNotice error={domainsQuery.error} what="domains" />
      ) : rows.length === 0 ? (
        hasFilters ? (
          <EmptyNotice>No domains match these filters.</EmptyNotice>
        ) : (
          <div className={`${PANEL} flex flex-col items-center gap-3 px-6 py-12 text-center`}>
            <div className="rounded-lg bg-muted p-2.5 text-muted-foreground">
              <GlobeIcon className="size-5" />
            </div>
            <h2 className="text-[15px] font-semibold">No connected domains yet</h2>
            <p className="max-w-md text-[13px] text-muted-foreground leading-relaxed [text-wrap:pretty]">
              Domains appear here as soon as an end user enters one in the Connect
              modal. Launch the modal from the playground to create your first one.
            </p>
            <Button
              size="sm"
              variant="outline"
              render={<Link to="/d/$workspaceSlug/connect/playground" params={{ workspaceSlug }} />}
            >
              Open playground
            </Button>
          </div>
        )
      ) : (
        <>
          <div className={`${PANEL} overflow-hidden`}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Domain</TableHead>
                  <TableHead>Application</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Setup</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>User ID</TableHead>
                  <TableHead className="text-right">Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className="cursor-pointer"
                    tabIndex={0}
                    onClick={() => {
                      setSelectedSeed(row);
                      setSelectedId(row.id);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedSeed(row);
                        setSelectedId(row.id);
                      }
                    }}
                  >
                    <TableCell className="font-medium">{row.domain}</TableCell>
                    <TableCell className="text-muted-foreground">{row.applicationName}</TableCell>
                    <TableCell className="text-muted-foreground">{row.provider?.name ?? "—"}</TableCell>
                    <TableCell>
                      {row.setupMethod ? (
                        <MutedPill>{row.setupMethod}</MutedPill>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <DomainStatusBadge status={row.status} />
                    </TableCell>
                    <TableCell className="max-w-40 truncate font-mono text-[12px] text-muted-foreground">
                      {row.userId ?? "—"}
                    </TableCell>
                    <TableCell
                      className="text-right text-[12px] text-muted-foreground tabular-nums"
                      title={formatDateTime(row.createdAt)}
                    >
                      {formatDate(row.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="mt-4 flex items-center justify-between text-[12px] text-muted-foreground">
            <span>
              {rows.length} domain{rows.length === 1 ? "" : "s"}
              {domainsQuery.hasNextPage ? " loaded" : ""}
            </span>
            {domainsQuery.hasNextPage ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => void domainsQuery.fetchNextPage()}
                loading={domainsQuery.isFetchingNextPage}
              >
                Load more
              </Button>
            ) : null}
          </div>
        </>
      )}

      <DomainSheet
        workspaceSlug={workspaceSlug}
        connectionId={selectedId}
        seed={selectedSeed}
        canManage={canManage}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className={`${PANEL} divide-y divide-border/40`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3">
          <Skeleton className="h-3.5 w-40" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="ms-auto h-4 w-20" />
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Detail sheet                                                               */
/* -------------------------------------------------------------------------- */

function DomainSheet({
  workspaceSlug,
  connectionId,
  seed,
  canManage,
  onClose,
}: {
  workspaceSlug: string;
  connectionId: string | null;
  seed: DomainConnectionListItemDTO | null;
  canManage: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [verifying, setVerifying] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [removing, setRemoving] = useState(false);

  const detailQuery = useQuery({
    queryKey: queryKeys.connectDomain(workspaceSlug, connectionId ?? ""),
    queryFn: () => api.connect.domains.get(workspaceSlug, connectionId!),
    enabled: Boolean(connectionId),
    initialData: seed && seed.id === connectionId ? seed : undefined,
    initialDataUpdatedAt: 0,
    staleTime: 5_000,
  });

  const conn = detailQuery.data ?? (seed && seed.id === connectionId ? seed : null);

  const verify = async () => {
    if (!conn) return;
    setVerifying(true);
    try {
      const next = await api.connect.domains.verify(workspaceSlug, conn.id);
      queryClient.setQueryData(queryKeys.connectDomain(workspaceSlug, conn.id), next);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.connectDomains(workspaceSlug),
      });
      toastManager.add({
        type: next.status === "connected" ? "success" : "info",
        title: next.status === "connected" ? "Domain connected" : `Status: ${DOMAIN_STATUS_LABEL[next.status]}`,
        description:
          next.status === "connected"
            ? `${next.domain} is serving every record.`
            : "DNS changes can take a while to propagate.",
        timeout: 4000,
      });
    } catch (err) {
      toastError("Could not verify domain", err);
    } finally {
      setVerifying(false);
    }
  };

  const remove = async () => {
    if (!conn) return;
    setRemoving(true);
    try {
      await api.connect.domains.delete(workspaceSlug, conn.id);
      queryClient.removeQueries({ queryKey: queryKeys.connectDomain(workspaceSlug, conn.id) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.connect(workspaceSlug) });
      toastManager.add({
        type: "success",
        title: "Domain removed",
        description: `${conn.domain} was disconnected.`,
        timeout: 4000,
      });
      setConfirmOpen(false);
      onClose();
    } catch (err) {
      toastError("Could not remove domain", err);
    } finally {
      setRemoving(false);
    }
  };

  return (
    <Sheet
      open={connectionId !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetPopup className="max-w-2xl">
        {conn ? (
          <>
            <SheetHeader>
              <div className="flex flex-wrap items-center gap-2 pe-8">
                <SheetTitle className="break-all">{conn.domain}</SheetTitle>
                <DomainStatusBadge status={conn.status} />
              </div>
              <SheetDescription>
                {conn.applicationName}
                {conn.provider ? ` · ${conn.provider.name}` : ""}
                {conn.setupMethod ? ` · ${conn.setupMethod} setup` : ""}
              </SheetDescription>
            </SheetHeader>
            <SheetPanel className="space-y-6">
              {conn.lastError ? (
                <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-[12px] text-rose-700 dark:text-rose-300">
                  <div className="font-mono text-[10px] uppercase tracking-wider opacity-80">Last error</div>
                  <div className="mt-1 font-mono">{conn.lastError}</div>
                </div>
              ) : null}

              <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Fact label="Connection ID">
                  <span className="inline-flex max-w-full items-center gap-0.5">
                    <code className="truncate font-mono">{conn.id}</code>
                    <CopyButton value={conn.id} label="Copy connection ID" />
                  </span>
                </Fact>
                <Fact label="User ID">
                  <code className="font-mono">{conn.userId ?? "—"}</code>
                </Fact>
                <Fact label="Root domain">{conn.rootDomain}</Fact>
                <Fact label="Created">{formatDateTime(conn.createdAt)}</Fact>
                <Fact label="Last checked">
                  <span title={formatDateTime(conn.lastCheckedAt)}>{formatRelative(conn.lastCheckedAt)}</span>
                </Fact>
                <Fact label="Connected">{formatDateTime(conn.connectedAt)}</Fact>
              </dl>

              <div>
                <h3 className="mb-2 text-[13px] font-semibold">DNS records</h3>
                {conn.records.length === 0 ? (
                  <EmptyNotice>No records resolved for this connection.</EmptyNotice>
                ) : (
                  <div className={`${PANEL} overflow-hidden`}>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Type</TableHead>
                          <TableHead>Host</TableHead>
                          <TableHead>Value</TableHead>
                          <TableHead className="text-right">TTL</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {conn.records.map((r, i) => (
                          <TableRow key={`${r.type}-${r.fqdn}-${i}`} className="align-top">
                            <TableCell className="font-mono text-[12px]">{r.type}</TableCell>
                            <TableCell className="whitespace-normal">
                              <div className="font-mono text-[12px]">{r.host}</div>
                              <div className="text-[11px] text-muted-foreground break-all">{r.fqdn}</div>
                            </TableCell>
                            <TableCell className="max-w-56 whitespace-normal">
                              <div className="flex items-start gap-0.5">
                                <code className="min-w-0 font-mono text-[12px] break-all">
                                  {r.priority != null ? `${r.priority} ` : ""}
                                  {r.value}
                                </code>
                                <CopyButton value={r.value} label="Copy value" />
                              </div>
                              {r.status !== "verified" && r.observed.length > 0 ? (
                                <div className="mt-1 text-[11px] text-muted-foreground">
                                  Observed:{" "}
                                  <span className="font-mono break-all">{r.observed.join(", ")}</span>
                                </div>
                              ) : r.status !== "verified" ? (
                                <div className="mt-1 text-[11px] text-muted-foreground">Observed: nothing yet</div>
                              ) : null}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-[12px]">{r.ttl}</TableCell>
                            <TableCell>
                              <RecordStatusBadge status={r.status} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              <div>
                <h3 className="mb-2 text-[13px] font-semibold">Metadata</h3>
                {conn.metadata && Object.keys(conn.metadata).length > 0 ? (
                  <JsonBlock value={conn.metadata} />
                ) : (
                  <p className="text-[12px] text-muted-foreground">No metadata was passed for this connection.</p>
                )}
              </div>
            </SheetPanel>
            <SheetFooter>
              {canManage ? (
                <>
                  <Button
                    variant="destructive-outline"
                    size="sm"
                    className="gap-1.5 sm:me-auto"
                    onClick={() => setConfirmOpen(true)}
                  >
                    <Trash2Icon className="size-3.5" />
                    Remove
                  </Button>
                  <Button size="sm" className="gap-1.5" onClick={() => void verify()} loading={verifying}>
                    <RefreshCwIcon className="size-3.5" />
                    Re-verify now
                  </Button>
                </>
              ) : (
                <span className="text-[11px] text-muted-foreground">
                  Re-verifying and removing requires <code className="font-mono">connect.domains.manage</code>.
                </span>
              )}
            </SheetFooter>
          </>
        ) : detailQuery.isError ? (
          <SheetPanel>
            <ErrorNotice error={detailQuery.error} what="this domain" />
          </SheetPanel>
        ) : (
          <SheetPanel className="space-y-3">
            <SheetTitle className="sr-only">Loading domain</SheetTitle>
            <Skeleton className="h-6 w-56" />
            <Skeleton className="h-40 w-full rounded-xl" />
          </SheetPanel>
        )}
      </SheetPopup>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogPopup>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {conn?.domain}?</AlertDialogTitle>
            <AlertDialogDescription>
              Connect stops tracking this domain and notifies your webhook with{" "}
              <code className="font-mono">domain.disconnected</code>. Records the
              user already added at their DNS provider stay in place.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" render={<AlertDialogClose />} disabled={removing}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void remove()} loading={removing}>
              Remove domain
            </Button>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>
    </Sheet>
  );
}
