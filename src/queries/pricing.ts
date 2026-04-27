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
import { useQuery, useQueries } from '@tanstack/react-query';
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
import { computePnlRefDates } from 'src/utils/pnlDates';
import type {
  XccyPosition,
  NdfPosition,
  IbrSwapPosition,
  PortfolioRepriceResponse,
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
  refDates: (fechaMarca: string) => ['pricing', 'refDates', fechaMarca] as const,
  refPrice: (
    period: 'daily' | 'mtd' | 'ytd',
    fecha: string,
    xccyIds: string[],
    ndfIds: string[],
    ibrIds: string[],
  ) => [
    'pricing', 'refPrice', period, fecha,
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

/**
 * #314 — Compute reference prices (daily, MTD, YTD) needed to derive P&L
 * columns in the portfolio blotter.
 *
 * Replaces `loadReferencePrices` from `src/store/trading/index.ts`. The
 * legacy version:
 *   1. Awaited `computePnlRefDates(fechaMarca)` to get the 3 reference dates.
 *   2. Fired 3 `repricePortfolio` calls in parallel with `Promise.allSettled`.
 *   3. Stored results in `state.refPrices.{daily, mtd, ytd}`.
 *
 * The hook does the same in two stages:
 *   - One `useQuery` for `refDates` keyed on `fechaMarca`.
 *   - `useQueries` for the 3 sub-reprices, gated by `refDates` being
 *     resolved. Each sub-query has its own key so partial failures don't
 *     cascade and TanStack dedupes if another component asks for the same
 *     period+date combo.
 */
export type RefPricePeriod = 'daily' | 'mtd' | 'ytd';

export interface UseReferencePricesInput {
  xccy: XccyPosition[];
  ndf: NdfPosition[];
  ibr: IbrSwapPosition[];
  fechaMarca: string;
  enabled?: boolean;
}

export interface UseReferencePricesResult {
  refPrices: {
    daily: PortfolioRepriceResponse | null;
    mtd: PortfolioRepriceResponse | null;
    ytd: PortfolioRepriceResponse | null;
  };
  isLoading: boolean;
  isError: boolean;
}

export function useReferencePrices(input: UseReferencePricesInput): UseReferencePricesResult {
  const { xccy, ndf, ibr, fechaMarca, enabled = true } = input;

  const refDatesQuery = useQuery({
    queryKey: pricingKeys.refDates(fechaMarca),
    queryFn: () => computePnlRefDates(fechaMarca),
    enabled: enabled && !!fechaMarca,
    // The 3 reference dates depend only on calendar logic for `fechaMarca`,
    // not on market data — keep them cached for an hour.
    staleTime: 60 * 60_000,
  });
  const refDates = refDatesQuery.data;

  const periods: RefPricePeriod[] = ['daily', 'mtd', 'ytd'];

  const subQueries = useQueries({
    queries: periods.map((period) => {
      const fecha = refDates?.[period];
      const filteredXccy = fecha ? xccy.filter((p) => p.start_date <= fecha) : [];
      const filteredNdf = fecha
        ? ndf.filter((p) => !p.trade_date || p.trade_date <= fecha)
        : [];
      const filteredIbr = fecha ? ibr.filter((p) => p.start_date <= fecha) : [];
      return {
        queryKey: pricingKeys.refPrice(
          period,
          fecha ?? '',
          filteredXccy.map((p) => p.id),
          filteredNdf.map((p) => p.id),
          filteredIbr.map((p) => p.id),
        ),
        queryFn: ({ signal }: { signal: AbortSignal }) =>
          repricePortfolio(filteredXccy, filteredNdf, filteredIbr, {
            valuation_date: fecha as string,
            signal,
          }),
        enabled: enabled
          && !!fecha
          && (filteredXccy.length + filteredNdf.length + filteredIbr.length) > 0,
        // Reference prices for past dates are immutable for that snapshot of
        // positions — keep them warm for 5 min so navigating between pages or
        // re-rendering doesn't refetch.
        staleTime: 5 * 60_000,
      };
    }),
  });

  const [daily, mtd, ytd] = subQueries;
  const isLoading = refDatesQuery.isLoading || subQueries.some((q) => q.isLoading);
  const isError = refDatesQuery.isError || subQueries.some((q) => q.isError);

  return {
    refPrices: {
      daily: daily?.data ?? null,
      mtd: mtd?.data ?? null,
      ytd: ytd?.data ?? null,
    },
    isLoading,
    isError,
  };
}



