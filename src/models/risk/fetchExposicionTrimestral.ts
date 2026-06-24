/**
 * fetchExposicionTrimestral — lee las 4 filas de exposicion trimestral
 * de una empresa para un anho dado (Q1..Q4).
 *
 * Backend: RPC xerenity.get_exposicion_trimestral(company_id, year).
 *
 * Filtrado por empresa:
 *   - super_admin sin p_company_id: ve TODAS (legacy)
 *   - super_admin con p_company_id: filtra a esa empresa (respeta picker)
 *   - corp_admin / gestor / lector: forzados a su empresa (defense in depth)
 */
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

const supabase = createClientComponentClient();
const SCHEMA = 'xerenity';

export type ExposicionTrimestralRow = {
  id: string;
  company_id: string;
  year: number;
  quarter: number;                   // 1..4
  exposicion_usd: number;
  concepto: string | null;
  contraparte: string | null;
  fecha_vencimiento: string | null;  // YYYY-MM-DD
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ExposicionTrimestralResponse = {
  data: ExposicionTrimestralRow[];
  error: string | undefined;
};

export const fetchExposicionTrimestral = async (
  companyId: string | null | undefined,
  year: number,
): Promise<ExposicionTrimestralResponse> => {
  const response: ExposicionTrimestralResponse = { data: [], error: undefined };
  try {
    const { data, error } = await supabase
      .schema(SCHEMA)
      .rpc('get_exposicion_trimestral', {
        p_company_id: companyId ?? null,
        p_year: year,
      });
    if (error) {
      response.error = error.message || 'Error fetching exposicion trimestral';
      return response;
    }
    response.data = (data ?? []) as ExposicionTrimestralRow[];
    return response;
  } catch (e) {
    response.error = (e as Error)?.message || 'Error fetching exposicion trimestral';
    return response;
  }
};

export type UpsertExposicionTrimestralInput = {
  company_id: string;
  year: number;
  quarter: number;
  exposicion_usd: number;
  concepto?: string | null;
  contraparte?: string | null;
  fecha_vencimiento?: string | null;
  notes?: string | null;
};

export const upsertExposicionTrimestral = async (
  input: UpsertExposicionTrimestralInput,
): Promise<{ id?: string; error?: string }> => {
  try {
    const { data, error } = await supabase
      .schema(SCHEMA)
      .rpc('upsert_exposicion_trimestral', { p: input });
    if (error) {
      return { error: error.message || 'Error upserting exposicion' };
    }
    const obj = (data ?? {}) as { id?: string };
    return { id: obj.id };
  } catch (e) {
    return { error: (e as Error)?.message || 'Error upserting exposicion' };
  }
};

// ── Helpers ────────────────────────────────────────────────

export const QUARTER_LABEL: Record<number, string> = {
  1: 'Q1 (Ene–Mar)',
  2: 'Q2 (Abr–Jun)',
  3: 'Q3 (Jul–Sep)',
  4: 'Q4 (Oct–Dic)',
};

/** Q actual (1..4) basado en un ISO date string YYYY-MM-DD. */
export const getQuarterFromDate = (isoDate: string): number => {
  const month = parseInt(isoDate.slice(5, 7), 10);
  return Math.ceil(month / 3);
};

/** Suma exposicion_usd del Q indicado (filtra year + quarter). */
export const getExposicionForQuarter = (
  rows: ExposicionTrimestralRow[],
  year: number,
  quarter: number,
): number => {
  const row = rows.find((r) => r.year === year && r.quarter === quarter);
  return row?.exposicion_usd ?? 0;
};
