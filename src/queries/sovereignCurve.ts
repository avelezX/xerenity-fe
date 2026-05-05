/**
 * TanStack Query hook for the Colombian IBR curve.
 *
 * Used by the Créditos page to compute the effective rate of variable-rate
 * loans (IBR matched to the loan's periodicity + spread).
 *
 * Originally also exposed a sovereign (COLTES-COP) curve hook — that was
 * removed when the debt-curve chart switched from "loan rates vs TES" to
 * "loan rates vs duration". File name kept for backwards-compat with
 * existing imports.
 */
import { useQuery } from '@tanstack/react-query';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { GridEntry } from 'src/types/tes';

const SCHEMA = 'xerenity';
const STALE_MS = 5 * 60_000;

const supabase = createClientComponentClient();

export const curveKeys = {
  ibr: ['curves', 'ibr'] as const,
};

export interface IbrCurvePoint {
  /** Tenor in months (1, 3, 6, 12, 24...). */
  tenorMonths: number;
  /** Close rate, in percent. */
  rate: number;
  displayname: string;
  operationTime: string;
}

/** Keep only the most-recent operation_time per displayname. */
function latestPerInstrument(entries: GridEntry[]): GridEntry[] {
  const map = new Map<string, GridEntry>();
  entries.forEach((e) => {
    const prev = map.get(e.displayname);
    if (!prev || e.operation_time > prev.operation_time) map.set(e.displayname, e);
  });
  return Array.from(map.values());
}

function buildIbrCurve(raw: GridEntry[]): IbrCurvePoint[] {
  const latest = latestPerInstrument(raw.filter((e) => e.close > 0 && e.tes_months > 0));
  return latest
    .map((entry) => ({
      tenorMonths: entry.tes_months,
      rate: entry.close,
      displayname: entry.displayname,
      operationTime: entry.operation_time,
    }))
    .sort((a, b) => a.tenorMonths - b.tenorMonths);
}

/** Latest close of every IBR tenor (1M, 3M, 6M, 12M…). */
export function useIbrCurve() {
  return useQuery({
    queryKey: curveKeys.ibr,
    queryFn: async ({ signal }): Promise<IbrCurvePoint[]> => {
      const { data, error } = await supabase
        .schema(SCHEMA)
        .rpc('get_ibr_grid_raw', {})
        .abortSignal(signal);
      if (error) throw new Error(error.message);
      return buildIbrCurve((data as GridEntry[]) ?? []);
    },
    staleTime: STALE_MS,
    retry: 0 as const,
  });
}
