// +feature:audit-log
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import type { AuditEntryDTO } from "@orbit/shared/dto";
import { SearchIcon } from "lucide-react";
import { Badge } from "@orbit/ui/badge";
import { Button } from "@orbit/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@orbit/ui/input-group";
import { Skeleton } from "@orbit/ui/skeleton";
import { api } from "@/lib/api/client";
import { useCan } from "@/lib/permissions";
import { queryKeys } from "@/lib/query-keys";
import { useWorkspaceSlug } from "@/lib/use-workspace-slug";
import { memberDisplayName, useWorkspace, type Member } from "@/lib/workspace";
import { SettingsSection } from "@/pages/workspace-settings/shared";

const PAGE_SIZE = 50;

export function WorkspaceAuditPage() {
  const slug = useWorkspaceSlug();
  const ws = useWorkspace();
  const canView = useCan("workspace.audit_log.view");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim(), 300);

  const query = useInfiniteQuery({
    enabled: Boolean(slug) && canView,
    queryKey: slug
      ? [...queryKeys.workspaceAudit(slug), debouncedSearch]
      : [...queryKeys.workspaceAudit(""), debouncedSearch],
    queryFn: ({ pageParam }) =>
      api.workspaces.listAudit(slug!, {
        cursor: pageParam ?? undefined,
        limit: PAGE_SIZE,
        q: debouncedSearch || undefined,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
  });


  const memberById = useMemo(() => {
    const map = new Map<string, Member>();
    for (const m of ws?.members ?? []) map.set(m.id, m);
    return map;
  }, [ws?.members]);


  if (!canView) {
    return (
      <SettingsSection
        title="Audit log"
        description="You don't have permission to view the workspace audit log."
      >
        <></>
      </SettingsSection>
    );
  }

  if (query.isLoading) {
    return (
      <SettingsSection
        title="Audit log"
        description="Append-only trail of actions in this workspace."
      >
        <div className="space-y-2">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      </SettingsSection>
    );
  }

  const items = query.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <SettingsSection
      title="Audit log"
      description="Append-only trail of actions across this workspace and every team inside it."
    >
      <div className="mb-3">
        <InputGroup>
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            placeholder="Search actions (e.g. 'role.', 'invite', 'team.deleted')"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </InputGroup>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {debouncedSearch ? "No entries match." : "No audit entries yet."}
        </p>
      ) : (
        <div className="overflow-hidden rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Time</th>
                <th className="px-3 py-2 font-medium">Action</th>
                <th className="px-3 py-2 font-medium">Actor</th>
                <th className="px-3 py-2 font-medium">Scope</th>
                <th className="px-3 py-2 font-medium">Target</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((e) => (
                <AuditTableRow
                  key={e.id}
                  entry={e}
                  memberById={memberById}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-4 flex justify-center">
        <Button
          variant="outline"
          size="sm"
          disabled={!query.hasNextPage || query.isFetchingNextPage}
          onClick={() => query.fetchNextPage()}
        >
          {query.isFetchingNextPage
            ? "Loading…"
            : query.hasNextPage
              ? "Load more"
              : "End of log"}
        </Button>
      </div>
    </SettingsSection>
  );
}

function AuditTableRow({
  entry,
  memberById,
}: {
  entry: AuditEntryDTO;
  memberById: Map<string, Member>;
}) {
  const actor = resolveActor(entry, memberById);
  return (
    <tr className="align-top">
      <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
        {new Date(entry.occurredAt).toLocaleString()}
      </td>
      <td className="px-3 py-2 font-mono text-xs">{entry.action}</td>
      <td className="px-3 py-2 text-xs">
        <span
          className={actor.muted ? "text-muted-foreground" : "text-foreground"}
          title={actor.title}
        >
          {actor.label}
        </span>
      </td>
      <td className="px-3 py-2 text-xs">
      </td>
      <td className="px-3 py-2 text-xs">
        {entry.targetType ? (
          <span>
            <span className="text-muted-foreground">{entry.targetType}</span>
            {entry.targetId ? (
              <span className="ml-1 font-mono">
                {truncateId(entry.targetId)}
              </span>
            ) : null}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
    </tr>
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

function truncateId(id: string): string {
  if (id.length <= 14) return id;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

function useDebouncedValue<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}
// -feature:audit-log
