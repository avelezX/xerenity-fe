/* eslint-disable no-restricted-syntax, import/prefer-default-export */
/**
 * Resumen calculator — consolidates data from all portfolio sections.
 * Reads from Supabase (commodities, OTC positions) and Zustand stores (loans, TES).
 * No Fly.io dependency.
 */

import type { ResumenData, ResumenSection, ResumenRow } from 'src/types/risk';
import { fetchFuturesPortfolio } from 'src/models/risk/riskApi';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

const supabase = createClientComponentClient();

// ── Commodities (Futures) ──

async function fetchCommoditiesResumen(
  filterDate: string,
  companyId?: string,
): Promise<ResumenSection> {
  try {
    const { portfolio } = await fetchFuturesPortfolio(filterDate, true, companyId);
    const totalRow = portfolio.find((p) => p.asset === 'Total');
    const positions = portfolio.filter((p) => p.asset !== 'Total');

    const detalle: ResumenRow[] = positions.map((p) => ({
      nombre: `${p.asset} ${p.direction} x${p.nominal}`,
      posiciones: 1,
      valor: p.valor_t,
      pnl: p.pnl_month,
      isSubRow: true,
    }));

    return {
      nombre: 'Commodities',
      icon: 'chart-area',
      posiciones: positions.length,
      valor_total: totalRow?.valor_t ?? null,
      pnl_mes: totalRow?.pnl_month ?? null,
      detalle,
    };
  } catch {
    return { nombre: 'Commodities', icon: 'chart-area', posiciones: 0, valor_total: null, pnl_mes: null, detalle: [] };
  }
}

// ── Derivados OTC (XCCY, NDF, IBR) ──

async function fetchOTCResumen(): Promise<ResumenSection> {
  try {
    const [xccyRes, ndfRes, ibrRes] = await Promise.all([
      supabase.schema('xerenity').rpc('get_xccy_positions'),
      supabase.schema('xerenity').rpc('get_ndf_positions'),
      supabase.schema('xerenity').rpc('get_ibr_positions'),
    ]);

    const xccy = (xccyRes.data ?? []) as Array<{ notional_usd: number; label: string }>;
    const ndf = (ndfRes.data ?? []) as Array<{ notional_usd: number; label: string }>;
    const ibr = (ibrRes.data ?? []) as Array<{ notional: number; label: string }>;

    const xccyNotional = xccy.reduce((s, p) => s + (p.notional_usd ?? 0), 0);
    const ndfNotional = ndf.reduce((s, p) => s + (p.notional_usd ?? 0), 0);
    const ibrNotional = ibr.reduce((s, p) => s + (p.notional ?? 0), 0);

    const detalle: ResumenRow[] = [];
    if (xccy.length > 0) detalle.push({ nombre: `XCCY Swaps (${xccy.length})`, posiciones: xccy.length, valor: xccyNotional, pnl: null, isSubRow: true });
    if (ndf.length > 0) detalle.push({ nombre: `NDF Forwards (${ndf.length})`, posiciones: ndf.length, valor: ndfNotional, pnl: null, isSubRow: true });
    if (ibr.length > 0) detalle.push({ nombre: `IBR Swaps (${ibr.length})`, posiciones: ibr.length, valor: ibrNotional, pnl: null, isSubRow: true });

    return {
      nombre: 'Derivados OTC',
      icon: 'exchange',
      posiciones: xccy.length + ndf.length + ibr.length,
      valor_total: xccyNotional + ndfNotional + ibrNotional,
      pnl_mes: null, // P&L requires repricing via Fly.io — not available
      detalle,
    };
  } catch {
    return { nombre: 'Derivados OTC', icon: 'exchange', posiciones: 0, valor_total: null, pnl_mes: null, detalle: [] };
  }
}

// ── Créditos (Loans) — from Zustand store ──

interface LoanStoreData {
  total_value: number;
  loan_count: number;
  accrued_interest: number;
}

function buildLoansResumen(fullLoan?: LoanStoreData): ResumenSection {
  if (!fullLoan) {
    return { nombre: 'Créditos', icon: 'landmark', posiciones: 0, valor_total: null, pnl_mes: null, detalle: [] };
  }

  return {
    nombre: 'Créditos',
    icon: 'landmark',
    posiciones: fullLoan.loan_count ?? 0,
    valor_total: fullLoan.total_value ?? null,
    pnl_mes: null, // Loans don't have monthly P&L
    detalle: [
      { nombre: 'Saldo total', posiciones: fullLoan.loan_count, valor: fullLoan.total_value, pnl: null, isSubRow: true },
      { nombre: 'Intereses causados', posiciones: 0, valor: fullLoan.accrued_interest, pnl: null, isSubRow: true },
    ],
  };
}

// ── Portafolio TES — from Zustand store ──

interface TesBondData {
  bond_name: string;
  notional: number;
  npv?: number;
  pnl_mtm?: number;
}

function buildTESResumen(bonds: TesBondData[]): ResumenSection {
  if (!bonds || bonds.length === 0) {
    return { nombre: 'Portafolio TES', icon: 'landmark', posiciones: 0, valor_total: null, pnl_mes: null, detalle: [] };
  }

  const totalNpv = bonds.reduce((s, b) => s + (b.npv ?? b.notional ?? 0), 0);
  const totalPnl = bonds.reduce((s, b) => s + (b.pnl_mtm ?? 0), 0);

  const detalle: ResumenRow[] = bonds.map((b) => ({
    nombre: b.bond_name,
    posiciones: 1,
    valor: b.npv ?? b.notional,
    pnl: b.pnl_mtm ?? null,
    isSubRow: true,
  }));

  return {
    nombre: 'Portafolio TES',
    icon: 'building-columns',
    posiciones: bonds.length,
    valor_total: totalNpv,
    pnl_mes: totalPnl !== 0 ? totalPnl : null,
    detalle,
  };
}

// ── Main: fetch all sections ──

export async function fetchResumenData(
  filterDate: string,
  companyId?: string,
  storeData?: {
    fullLoan?: LoanStoreData;
    pricedTesBonds?: TesBondData[];
  },
): Promise<ResumenData> {
  // Fetch commodities and OTC in parallel (async), use store data for loans/TES (sync)
  const [commodities, otc] = await Promise.all([
    fetchCommoditiesResumen(filterDate, companyId),
    fetchOTCResumen(),
  ]);

  const loans = buildLoansResumen(storeData?.fullLoan);
  const tes = buildTESResumen(storeData?.pricedTesBonds ?? []);

  const secciones = [commodities, otc, loans, tes];

  const totales = {
    posiciones: secciones.reduce((s, sec) => s + sec.posiciones, 0),
    valor_total: secciones.reduce((s, sec) => s + (sec.valor_total ?? 0), 0),
    pnl_mes: secciones.reduce((s, sec) => s + (sec.pnl_mes ?? 0), 0),
  };

  return { fecha: filterDate, secciones, totales };
}
