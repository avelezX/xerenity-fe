import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type {
  HistoricalMark,
  HistoricalTesPoint,
  IbrQuotesCurveRow,
  HistoricalSofrPoint,
  HistoricalNdfPoint,
} from 'src/types/trading';

const supabase = createClientComponentClient();

/**
 * Fetches all historical curve data for a given fecha (YYYY-MM-DD).
 *
 * ibr_quotes_curve.fecha is stored as ISO text '2026-02-28T00:00:00'
 * so we use .like('fecha', `${fecha}%`) for safe matching.
 *
 * sofr_swap_curve and cop_fwd_points store fecha as a native date column
 * so we use .eq('fecha', fecha) — LIKE does not work on date columns.
 */
// eslint-disable-next-line import/prefer-default-export
export const fetchHistoricalMark = async (
  fecha: string // 'YYYY-MM-DD'
): Promise<HistoricalMark> => {
  const [ibrRes, sofrRes, ndfRes, tesRes, marksRes] = await Promise.allSettled([
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
      .eq('fecha', fecha)
      .order('tenor_months'),

    supabase
      .schema('xerenity')
      .from('cop_fwd_points')
      .select('tenor, tenor_months, fwd_points, mid')
      .eq('fecha', fecha)
      .order('tenor_months'),

    supabase
      .schema('xerenity')
      .rpc('get_tes_yield_curve_for_date', { p_money: 'COLTES-COP', p_fecha: fecha }),

    supabase
      .schema('xerenity')
      .from('market_marks')
      .select('fx_spot, ndf')
      .eq('fecha', fecha)
      .limit(1)
      .maybeSingle(),
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

  const tes =
    tesRes.status === 'fulfilled' && !tesRes.value.error && tesRes.value.data
      ? (tesRes.value.data as HistoricalTesPoint[])
      : [];

  const marksRow =
    marksRes.status === 'fulfilled' && !marksRes.value.error && marksRes.value.data
      ? (marksRes.value.data as { fx_spot: number; ndf: Record<string, unknown> | null })
      : null;

  const fx_spot = marksRow?.fx_spot ?? null;

  // NDF: prefer cop_fwd_points (live), fall back to market_marks.ndf (snapshot)
  const hasNdfLive = ndf.length > 0;
  const hasNdfSnapshot = marksRow?.ndf != null && Object.keys(marksRow.ndf).length > 0;

  return {
    fecha,
    ibr,
    sofr,
    ndf,
    tes,
    fx_spot,
    ndfSnapshot: marksRow?.ndf ?? null,
    hasIbr: ibr !== null,
    hasSofr: sofr.length > 0,
    hasNdf: hasNdfLive || hasNdfSnapshot,
    hasTes: tes.length > 0,
  };
};
