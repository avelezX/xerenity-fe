/* eslint-disable no-restricted-syntax, import/prefer-default-export */
/**
 * Resumen calculator — consolidates data from all portfolio sections.
 * Reads from Supabase (commodities, OTC) and Zustand stores (loans).
 */

import type { ResumenData, CommoditiesResumen, CommodityRow, OTCResumen, CreditosResumen } from 'src/types/risk';
import { fetchBenchmarkFactors } from 'src/models/risk/riskApi';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

const supabase = createClientComponentClient();

// ── Commodities ──

async function fetchCommoditiesResumen(
  filterDate: string,
): Promise<CommoditiesResumen> {
  const emptyTotals: CommodityRow = { asset: 'Total', contract: null, exposicion_natural: null, portafolio_gr: null, total: null, pnl_super: null, pnl_gr: null, pnl_total: null };
  try {
    const data = await fetchBenchmarkFactors(filterDate, 0.99);
    const assets = data.assets || [];

    const rows: CommodityRow[] = assets.map((asset) => {
      const f = data.factors[asset];
      const priceStart = f?.price_start ?? 0;
      const priceEnd = f?.price_end ?? 0;
      // Exposición natural placeholder — uses price_end as proxy for position value
      // Real position data comes from benchmark table (user-editable)
      const exposicion = priceEnd !== 0 ? priceEnd : null;
      const pnlSuper = priceStart !== 0 ? priceEnd - priceStart : null;

      return {
        asset,
        contract: f?.contract ?? null,
        exposicion_natural: exposicion,
        portafolio_gr: null, // GR is manual input in benchmark
        total: exposicion,
        pnl_super: pnlSuper,
        pnl_gr: null,
        pnl_total: pnlSuper,
      };
    });

    // Totals
    const totExpNat = rows.reduce((s, r) => s + (r.exposicion_natural ?? 0), 0);
    const totPnlSuper = rows.reduce((s, r) => s + (r.pnl_super ?? 0), 0);

    return {
      rows,
      totals: {
        asset: 'Total',
        contract: null,
        exposicion_natural: totExpNat,
        portafolio_gr: null,
        total: totExpNat,
        pnl_super: totPnlSuper,
        pnl_gr: null,
        pnl_total: totPnlSuper,
      },
    };
  } catch {
    return { rows: [], totals: emptyTotals };
  }
}

// ── Derivados OTC ──

async function fetchOTCResumen(companyId?: string): Promise<OTCResumen> {
  try {
    const [xccyRes, ndfRes, ibrRes] = await Promise.all([
      supabase.schema('xerenity').rpc('get_xccy_positions', { p_company_id: companyId ?? null }),
      supabase.schema('xerenity').rpc('get_ndf_positions', { p_company_id: companyId ?? null }),
      supabase.schema('xerenity').rpc('get_ibr_swap_positions', { p_company_id: companyId ?? null }),
    ]);

    const xccy = (xccyRes.data ?? []) as Array<Record<string, number>>;
    const ndf = (ndfRes.data ?? []) as Array<Record<string, number>>;
    const ibr = (ibrRes.data ?? []) as Array<Record<string, number>>;

    const totalPositions = xccy.length + ndf.length + ibr.length;

    return {
      posiciones: totalPositions,
      npv_cop: null,
      npv_usd: null,
      fx_delta: null,
      pnl_mtd_cop: null,
      pnl_mtd_usd: null,
    };
  } catch {
    return { posiciones: 0, npv_cop: null, npv_usd: null, fx_delta: null, pnl_mtd_cop: null, pnl_mtd_usd: null };
  }
}

// ── Créditos (directo de Supabase) ──

async function fetchCreditosResumen(companyId?: string): Promise<CreditosResumen> {
  try {
    const { data, error } = await supabase
      .schema('xerenity')
      .rpc('get_loans', { bank_name_filter: null, p_company_id: companyId ?? null });

    if (error || !data) {
      return { total_creditos: 0, deuda_total: null, creditos_ibr: 0, creditos_tasa_fija: 0, creditos_uvr: 0, tasa_promedio: null };
    }

    const loans = data as Array<{ original_balance?: number; interest_rate?: number; type?: string }>;
    const totalDeuda = loans.reduce((s, l) => s + (l.original_balance ?? 0), 0);
    const ibrCount = loans.filter((l) => l.type === 'IBR').length;
    const fijaCount = loans.filter((l) => l.type === 'Tasa Fija').length;
    const uvrCount = loans.filter((l) => l.type === 'UVR').length;
    const avgRate = loans.length > 0
      ? loans.reduce((s, l) => s + (l.interest_rate ?? 0), 0) / loans.length
      : null;

    return {
      total_creditos: loans.length,
      deuda_total: totalDeuda,
      creditos_ibr: ibrCount || (loans.length - fijaCount - uvrCount),
      creditos_tasa_fija: fijaCount,
      creditos_uvr: uvrCount,
      tasa_promedio: avgRate,
    };
  } catch {
    return { total_creditos: 0, deuda_total: null, creditos_ibr: 0, creditos_tasa_fija: 0, creditos_uvr: 0, tasa_promedio: null };
  }
}

// ── Main ──

interface OTCStoreData {
  summary?: { total_npv_cop: number; total_npv_usd: number };
  fxDeltaTotal?: number;
  pnlMtdCop?: number;
  pnlMtdUsd?: number;
}

export async function fetchResumenData(
  filterDate: string,
  companyId?: string,
  storeData?: OTCStoreData & {
    commoditiesOverride?: CommoditiesResumen;
  },
): Promise<ResumenData> {
  // Fetch OTC + credits in parallel, use commodities from benchmark if available
  const [otc, creditos] = await Promise.all([
    fetchOTCResumen(companyId),
    fetchCreditosResumen(companyId),
  ]);

  // Use benchmark data if available, otherwise fetch from scratch
  const commodities = storeData?.commoditiesOverride ?? await fetchCommoditiesResumen(filterDate);

  // Fill OTC metrics from store (after repricing in Portafolio OTC page)
  if (storeData?.summary) {
    otc.npv_cop = storeData.summary.total_npv_cop;
    otc.npv_usd = storeData.summary.total_npv_usd;
  }
  if (storeData?.fxDeltaTotal != null) {
    otc.fx_delta = storeData.fxDeltaTotal;
  }
  if (storeData?.pnlMtdCop != null) {
    otc.pnl_mtd_cop = storeData.pnlMtdCop;
  }
  if (storeData?.pnlMtdUsd != null) {
    otc.pnl_mtd_usd = storeData.pnlMtdUsd;
  }

  return { fecha: filterDate, commodities, otc, creditos };
}
