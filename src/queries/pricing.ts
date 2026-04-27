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

export const pricingKeys = {
  curveStatus: ['pricing', 'curveStatus'] as const,
  ndfImpliedCurve: ['pricing', 'ndfImpliedCurve'] as const,
  ibrParCurve: ['pricing', 'ibrParCurve'] as const,
  tesCatalog: ['pricing', 'tesCatalog'] as const,
  marksDates: ['pricing', 'marksDates'] as const,
  marks: ['pricing', 'marks'] as const,
  markByDate: (fecha: string) => ['pricing', 'marks', fecha] as const,
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
