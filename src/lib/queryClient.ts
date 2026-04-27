/**
 * TanStack Query client configuration for xerenity-fe.
 *
 * Defaults are tuned for a financial dashboard:
 * - `staleTime: 30s` — most pricing/loans data is fresh enough to show without
 *   refetching on every mount; individual hooks override when they need
 *   shorter (live reprice) or longer (catalogs, marks).
 * - `retry: 1` — pricing endpoints fail fast on bad input; one retry is enough
 *   to recover from transient network issues without blocking the UI.
 * - `refetchOnWindowFocus: false` — re-running a 30-position reprice every
 *   time the user tabs back is wasteful and surprising.
 * - `gcTime: 5min` — keep responses around so navigating between pages reuses
 *   cache (vs. the previous Zustand store which dropped data on unmount).
 *
 * Tracked in epic #299, sub-issue #311 (Fase 2 — TanStack Query setup).
 */
import { QueryClient } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

export default queryClient;
