/**
 * Lecturas directas de `xerenity.market_marks` desde Supabase.
 *
 * `market_marks` es la fuente unica de verdad EOD para valoracion (FX spot,
 * curvas IBR/SOFR/NDF). El backend Django ya lee esta tabla para OTC pricing
 * (via /pricing/marks). Este modulo es el equivalente frontend-only para que
 * el modulo de Riesgos pueda anclar sus calculos a la MISMA fuente que OTC,
 * sin pasar por Django.
 *
 * Fallback policy: cuando no hay dato para una fecha exacta, retornamos el
 * ultimo valor disponible <= esa fecha (carry-forward). Mismo comportamiento
 * que `MarketDataLoader.fetch_usdcop_spot()` en pysdk.
 */
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

const supabase = createClientComponentClient();
const SCHEMA = 'xerenity';

export interface MarketMarkRow {
  fecha: string;             // ISO YYYY-MM-DD
  status?: string | null;
  fx_spot: number | null;
  sofr_on?: number | null;
  ibr?: Record<string, number> | null;
  sofr?: Record<string, number> | null;
  ndf?: Record<string, number> | null;
}

export interface FxSpotPoint {
  fecha: string;
  fx_spot: number;
}

// ─────────────────────────────────────────────────────────────────
// FX spot puntual (con carry-forward)
// ─────────────────────────────────────────────────────────────────

/**
 * Lee USD/COP spot EOD para una fecha especifica.
 * Si no hay dato exacto, retorna el ultimo valor disponible <= fecha.
 * Si no hay NADA en la tabla, retorna null (caller debe manejar).
 */
export async function fetchFxSpot(targetDate: string): Promise<number | null> {
  // 1) Try exact date
  const exactRes = await supabase
    .schema(SCHEMA)
    .from('market_marks')
    .select('fx_spot')
    .eq('fecha', targetDate)
    .maybeSingle();
  if (exactRes.error) throw new Error(`Failed to fetch market_marks: ${exactRes.error.message}`);
  if (exactRes.data?.fx_spot != null) return Number(exactRes.data.fx_spot);

  // 2) Carry-forward: ultimo dia con dato <= targetDate
  const cfRes = await supabase
    .schema(SCHEMA)
    .from('market_marks')
    .select('fx_spot, fecha')
    .lte('fecha', targetDate)
    .not('fx_spot', 'is', null)
    .order('fecha', { ascending: false })
    .limit(1);
  if (cfRes.error) throw new Error(`Failed to fetch market_marks (carry-forward): ${cfRes.error.message}`);
  const row = cfRes.data?.[0];
  return row?.fx_spot != null ? Number(row.fx_spot) : null;
}

// ─────────────────────────────────────────────────────────────────
// FX spot serie historica (para Rolling VaR, vol calc, etc.)
// ─────────────────────────────────────────────────────────────────

/**
 * Lee serie de USD/COP spot EOD entre dos fechas inclusivas.
 * Solo retorna dias con dato (sin carry-forward — el caller decide si rellena).
 *
 * Tipico uso: rolling VaR 180d, calculo de volatilidad, charts historicos.
 */
export async function fetchFxSpotSeries(
  startDate: string,
  endDate: string,
): Promise<FxSpotPoint[]> {
  const { data, error } = await supabase
    .schema(SCHEMA)
    .from('market_marks')
    .select('fecha, fx_spot')
    .gte('fecha', startDate)
    .lte('fecha', endDate)
    .not('fx_spot', 'is', null)
    .order('fecha', { ascending: true });
  if (error) throw new Error(`Failed to fetch fx_spot series: ${error.message}`);
  return (data ?? []).map((r) => ({
    fecha: String(r.fecha),
    fx_spot: Number(r.fx_spot),
  }));
}

// ─────────────────────────────────────────────────────────────────
// Mark completo (FX + IBR + SOFR + NDF JSONB)
// ─────────────────────────────────────────────────────────────────

/**
 * Lee la fila completa de market_marks para una fecha. Util si el caller
 * necesita IBR/SOFR/NDF curves ademas del fx_spot.
 *
 * Sin carry-forward por defecto — el caller decide si quiere fallback al
 * ultimo disponible (usar fetchLatestMarketMark).
 */
export async function fetchMarketMark(targetDate: string): Promise<MarketMarkRow | null> {
  const { data, error } = await supabase
    .schema(SCHEMA)
    .from('market_marks')
    .select('*')
    .eq('fecha', targetDate)
    .maybeSingle();
  if (error) throw new Error(`Failed to fetch market_marks row: ${error.message}`);
  return (data as MarketMarkRow | null) ?? null;
}

/**
 * Lee la fila mas reciente de market_marks <= targetDate.
 * Util para anclar curvas al ultimo dia con dato cuando el target tiene gap.
 */
export async function fetchLatestMarketMark(
  targetDate: string,
): Promise<MarketMarkRow | null> {
  const { data, error } = await supabase
    .schema(SCHEMA)
    .from('market_marks')
    .select('*')
    .lte('fecha', targetDate)
    .order('fecha', { ascending: false })
    .limit(1);
  if (error) throw new Error(`Failed to fetch latest market_marks: ${error.message}`);
  return (data?.[0] as MarketMarkRow | undefined) ?? null;
}
