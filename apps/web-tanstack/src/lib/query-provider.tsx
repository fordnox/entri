import { type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import type { ReactNode } from "react";
import { queryClient } from "@/lib/query-client";
import { isTanstackDevtoolsEnabled } from "@/lib/tanstack-devtools-enabled";

export function AppQueryProvider({
  children,
  client = queryClient,
}: {
  children: ReactNode;
  /** The router context's client, so SSR renders read the request's own cache. */
  client?: QueryClient;
}) {
  return (
    <QueryClientProvider client={client}>
      {children}
      {isTanstackDevtoolsEnabled() ? (
        <ReactQueryDevtools buttonPosition="bottom-left" />
      ) : null}
    </QueryClientProvider>
  );
}
