import { type DefaultOptions, QueryClient } from "@tanstack/react-query";

const DEFAULT_OPTIONS: DefaultOptions = {
  queries: {
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
  },
  mutations: {
    retry: 0,
  },
};

export function createQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: DEFAULT_OPTIONS });
}

/**
 * Browser-wide client. Never use this during SSR: the server process is
 * shared by every visitor, so a module-level cache would serve one
 * user's `/v1/me` to the next. `getRouter()` hands each server request
 * a fresh client via router context instead.
 */
export const queryClient = createQueryClient();
