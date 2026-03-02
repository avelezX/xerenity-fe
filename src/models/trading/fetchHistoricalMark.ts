import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type {
  HistoricalMark,
  IbrQuotesCurveRow,
  HistoricalSofrPoint,
  HistoricalNdfPoint,
} from 'src/types/trading';

const supabase = createClientComponentClient();

/**
 * Fetches all historical curve data for a given fecha (YYYY-MM-DD).
 *
 * ibr_quotes_curve.fecha is stored as ISO text '2026-02-28T00:00:00'
 * so we use .like('fecha', `${fecha}%`) for safe matching across both
 * text and date column types.
 */
export const fetchHistoricalMark = async (
  fecha: string // 'YYYY-MM-DD'
): Promise<HistoricalMark> => {
  const [ibrRes, sofrRes, ndfRes] = await Promise.allSettled([
    supabase
      .schema('xerenity')
      .from('ibr_quotes_curve')
      .select('*')
      .like('fecha', `${fecha}%`)
      .limit(1)
      .maybeSingle(),

    supabase
      .schema('xerenity')
      .from('sofr_swap_curve')
      .select('tenor_months, swap_rate')
      .like('fecha', `${fecha}%`)
      .order('tenor_months'),

    supabase
      .schema('xerenity')
      .from('cop_fwd_points')
      .select('tenor, tenor_months, fwd_points, mid')
      .like('fecha', `${fecha}%`)
      .order('tenor_months'),
  ]);

  const ibr =
    ibrRes.status === 'fulfilled' && !ibrRes.value.error && ibrRes.value.data
      ? (ibrRes.value.data as IbrQuotesCurveRow)
      : null;

  const sofr =
    sofrRes.status === 'fulfilled' && !sofrRes.value.error
      ? ((sofrRes.value.data ?? []) as HistoricalSofrPoint[])
      : [];

  const ndf =
    ndfRes.status === 'fulfilled' && !ndfRes.value.error
      ? ((ndfRes.value.data ?? []) as HistoricalNdfPoint[])
      : [];

  return {
    fecha,
    ibr,
    sofr,
    ndf,
    hasIbr: ibr !== null,
    hasSofr: sofr.length > 0,
    hasNdf: ndf.length > 0,
  };
};
