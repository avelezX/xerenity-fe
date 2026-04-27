/**
 * TanStack Query hooks for pricing endpoints.
 *
 * Phase 2 (#299) sub-issue #312 — read-only queries with stable keys. These
 * replace ad-hoc `useEffect` + `useState` + `await getXxx()` patterns
 * throughout the app, giving us automatic dedupe (multiple components asking
 * for the same data → single fetch), cache, and AbortSignal cancellation.
 *
 * Convention: every hook returns the standard `useQuery` result. `signal`
 * from the query lifecycle flows into the underlying fetcher (#292) so
 * unmounting or invalidating cancels the in-flight request.
 *
 * Stale times are tuned per endpoint:
 * - Curves change when marks are loaded — 30s is fine.
 * - Catalogs and historical marks change rarely — 10 min.
 */
import { useQuery } from '@tanstack/react-query';
import {
  getCurveStatus,
  getNdfImpliedCurve,
  getIbrParCurve,
  getTesCatalog,
  getMarksDates,
  getMarks,
  getMarkByDate,
} from 'src/models/pricing/pricingApi';
import { repricePortfolio } from 'src/models/trading/repricePortfolio';
import type {
  XccyPosition,
  NdfPosition,
  IbrSwapPosition,
} from 'src/types/trading';

export const pricingKeys = {
  curveStatus: ['pricing', 'curveStatus'] as const,
  ndfImpliedCurve: ['pricing', 'ndfImpliedCurve'] as const,
  ibrParCurve: ['pricing', 'ibrParCurve'] as const,
  tesCatalog: ['pricing', 'tesCatalog'] as const,
  marksDates: ['pricing', 'marksDates'] as const,
  marks: ['pricing', 'marks'] as const,
  markByDate: (fecha: string) => ['pricing', 'marks', fecha] as const,
  reprice: (
    valuationDate: string,
    xccyIds: string[],
    ndfIds: string[],
    ibrIds: string[],
  ) => [
    'pricing', 'reprice', valuationDate,
    [...xccyIds].sort(), [...ndfIds].sort(), [...ibrIds].sort(),
  ] as const,
};

export function useCurveStatus(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: pricingKeys.curveStatus,
    queryFn: ({ signal }) => getCurveStatus({ signal }),
    enabled: options?.enabled ?? true,
    staleTime: 30_000,
  });
}

export function useNdfImpliedCurve(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: pricingKeys.ndfImpliedCurve,
    queryFn: ({ signal }) => getNdfImpliedCurve({ signal }),
    enabled: options?.enabled ?? true,
    staleTime: 30_000,
  });
}

export function useIbrParCurve(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: pricingKeys.ibrParCurve,
    queryFn: ({ signal }) => getIbrParCurve({ signal }),
    enabled: options?.enabled ?? true,
    staleTime: 30_000,
  });
}

export function useTesCatalog(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: pricingKeys.tesCatalog,
    queryFn: ({ signal }) => getTesCatalog({ signal }),
    enabled: options?.enabled ?? true,
    // Catalog rarely changes — keep it warm for 10 min.
    staleTime: 10 * 60_000,
  });
}

export function useMarksDates(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: pricingKeys.marksDates,
    queryFn: ({ signal }) => getMarksDates({ signal }),
    enabled: options?.enabled ?? true,
    staleTime: 5 * 60_000,
  });
}

export function useMarks(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: pricingKeys.marks,
    queryFn: ({ signal }) => getMarks({ signal }),
    enabled: options?.enabled ?? true,
    staleTime: 5 * 60_000,
  });
}

export function useMarkByDate(fecha: string | null | undefined) {
  return useQuery({
    queryKey: pricingKeys.markByDate(fecha ?? ''),
    queryFn: ({ signal }) => getMarkByDate(fecha as string, { signal }),
    // Don't fire when no date is selected.
    enabled: !!fecha,
    staleTime: 5 * 60_000,
  });
}

/**
 * #313 — Reprice the entire derivatives portfolio (xccy + ndf + ibr swaps)
 * for a given valuation date.
 *
 * Replaces `repriceAllWithMark` from `src/store/trading/index.ts`. The store
 * version manually managed a token + AbortController to drop stale results
 * (NPV flicker fix from #293); TanStack does it natively via the queryKey
 * (changing date or position list = new query, old one is cancelled).
 *
 * Why the key includes sorted IDs (not the full positions array):
 * - Object identity changes on every render even when content is the same,
 *   which would cause infinite refetches.
 * - Sorting makes `[a,b,c]` and `[c,a,b]` (same set, different order) hit
 *   the same cache entry.
 * - When the user adds/removes a position, the ID set changes → new key →
 *   automatic refetch. This replaces the `repriceTrigger` counter from #295.
 *
 * Why this is a fix for the dual-toast bug the user reported:
 * - Old flow: `await repriceAllWithMark(A); toast.success(A);`. When A was
 *   aborted by a newer call B, the store returned silently and the page
 *   thought A succeeded → fired toast.success(A). User saw two toasts.
 * - New flow: TanStack's `onSuccess` only fires when the query for the
 *   *current* key resolves successfully. Aborted previous queries simply
 *   never trigger any side-effect callback.
 */
export interface UseRepricePortfolioInput {
  xccy: XccyPosition[];
  ndf: NdfPosition[];
  ibr: IbrSwapPosition[];
  /** Valuation date in YYYY-MM-DD. */
  valuationDate: string;
  enabled?: boolean;
}

export function useRepricePortfolio(input: UseRepricePortfolioInput) {
  const { xccy, ndf, ibr, valuationDate, enabled = true } = input;

  // Filter positions whose start/trade date is after the valuation date —
  // those instruments did not exist as of `valuationDate` and pysdk would
  // either error or produce nonsense for them. Same logic as the legacy
  // `repriceAllWithMark` action in the store.
  const filteredXccy = xccy.filter((p) => p.start_date <= valuationDate);
  const filteredNdf = ndf.filter((p) => !p.trade_date || p.trade_date <= valuationDate);
  const filteredIbr = ibr.filter((p) => p.start_date <= valuationDate);

  return useQuery({
    queryKey: pricingKeys.reprice(
      valuationDate,
      filteredXccy.map((p) => p.id),
      filteredNdf.map((p) => p.id),
      filteredIbr.map((p) => p.id),
    ),
    queryFn: ({ signal }) =>
      repricePortfolio(filteredXccy, filteredNdf, filteredIbr, {
        valuation_date: valuationDate,
        signal,
      }),
    // No data to reprice — return an empty result rather than fetching.
    enabled: enabled && (filteredXccy.length + filteredNdf.length + filteredIbr.length) > 0,
    staleTime: 30_000,
  });
}

