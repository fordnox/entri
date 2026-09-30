// +feature:auth-admin
// +feature:audit-log
import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { SearchIcon } from "lucide-react";
import { Button } from "@orbit/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@orbit/ui/input-group";
import { Skeleton } from "@orbit/ui/skeleton";
import { api } from "@/lib/api/client";
import { queryKeys } from "@/lib/query-keys";

const PAGE_SIZE = 50;

export function AdminAuditPanel(): React.ReactElement {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim(), 300);

  const query = useInfiniteQuery({
    queryKey: [...queryKeys.adminAudit(), debouncedSearch],
    queryFn: ({ pageParam }) =>
      api.admin.listAudit({
        cursor: pageParam ?? undefined,
        limit: PAGE_SIZE,
        q: debouncedSearch || undefined,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
  });

  if (query.isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10" />
        <Skeleton className="h-10" />
        <Skeleton className="h-10" />
      </div>
    );
  }

  if (query.isError) {
    return (
      <p className="text-sm text-destructive">
        Could not load audit log.{" "}
        {query.error instanceof Error ? query.error.message : null}
      </p>
    );
  }

  const items = query.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="space-y-4">
      <InputGroup>
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput
          type="search"
          placeholder="Search actions (e.g. 'app_user.', 'invite', 'workspace.deleted')"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </InputGroup>
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
              <th className="px-3 py-2 font-medium">Target</th>
              <th className="px-3 py-2 font-medium">IP</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map((e) => (
              <tr key={e.id} className="align-top">
                <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
                  {new Date(e.occurredAt).toLocaleString()}
                </td>
                <td className="px-3 py-2 font-mono text-xs">{e.action}</td>
                <td className="px-3 py-2 text-xs">
                  {e.actorKind === "system" ? (
                    <span className="text-muted-foreground">system</span>
                  ) : (
                    <span className="font-mono">{e.actorUserId ?? "—"}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-xs">
                  {e.targetType ? (
                    <span>
                      <span className="text-muted-foreground">{e.targetType}</span>
                      {e.targetId ? (
                        <span className="font-mono"> {e.targetId}</span>
                      ) : null}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
                  {e.ipAddress ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
      <div className="flex justify-center">
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
    </div>
  );
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
// -feature:auth-admin
