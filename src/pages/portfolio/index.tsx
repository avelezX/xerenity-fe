'use client';

/* eslint-disable no-nested-ternary, no-underscore-dangle, no-restricted-syntax, prefer-template, jsx-a11y/control-has-associated-label */
import { CoreLayout } from '@layout';
import { Row, Col, Form, Modal } from 'react-bootstrap';
import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import Container from 'react-bootstrap/Container';
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import {
  faBriefcase,
  faSyncAlt,
  faPlus,
  faCog,
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'react-toastify';
import PageTitle from '@components/PageTitle';
import Button from '@components/UI/Button';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  buildCurves,
  getCurveStatus,
  getNdfSettlement,
} from 'src/models/pricing/pricingApi';
import type { NdfSettlementResult } from 'src/models/pricing/pricingApi';
import { useRepricePortfolio, useReferencePrices } from 'src/queries/pricing';
import {
  useXccyPositions,
  useNdfPositions,
  useIbrSwapPositions,
  useAddXccyPosition,
  useAddNdfPosition,
  useAddIbrSwapPosition,
  useRemoveXccyPositions,
  useRemoveNdfPositions,
  useRemoveIbrSwapPositions,
} from 'src/queries/trading';
import { useQueryClient } from '@tanstack/react-query';
import { fetchHistoricalMark } from 'src/models/trading/fetchHistoricalMark';
import type { CurveStatus } from 'src/types/pricing';
import type {
  HistoricalMark,
  NewXccyPosition,
  NewNdfPosition,
  NewIbrSwapPosition,
  PricedXccy,
  PricedNdf,
  PricedIbrSwap,
  PortfolioSummary,
  PortfolioRepriceResponse,
} from 'src/types/trading';
import useAppStore from 'src/store';
import BlotterTable, { type PortfolioRow } from '@components/portfolio/BlotterTable';
import LiquidateNdfModal from '@components/portfolio/LiquidateNdfModal';
import { fetchNdfLiquidations, type NdfLiquidationRow } from 'src/models/trading';
import {
  sumLiquidationsBetween,
  sumSettlementsBetween,
  sumXccySettlementsBetween,
} from 'src/lib/trading/historicalPositions';
import { useXccySettlements } from 'src/queries/xccySettlements';
import { useBlotterPreferences } from 'src/models/user/blotter-preferences';
import MarketDataConfigModal from './_MarketDataConfigModal';
// MarksContent ya no se importa aqui (mayo 2026): vive standalone en /marks.

const PAGE_TITLE = 'Portafolio de Derivados';

// Helpers de fecha locales removidos. La fecha viene del store global.

// ── Mark Chip with dropdown ──
function MarkChip({ label, ok, rows }: { label: string; ok: boolean; rows: [string, string][] }) {
  const [open, setOpen] = useState(false);
  return (
    <span style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => ok && rows.length > 0 && setOpen((v) => !v)}
        style={{
          padding: '1px 6px', borderRadius: 4, fontSize: 11, fontWeight: 600,
          background: ok ? '#d4edda' : '#f8d7da',
          color: ok ? '#155724' : '#721c24',
          border: 'none', cursor: ok && rows.length > 0 ? 'pointer' : 'default',
        }}
      >
        {label} {ok ? '✓' : '✗'} {ok && rows.length > 0 ? '▾' : ''}
      </button>
      {open && (
        <div
          style={{
            position: 'absolute', top: '100%', left: 0, zIndex: 999,
            background: '#fff', border: '1px solid #dee2e6', borderRadius: 6,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)', padding: '6px 0',
            minWidth: 180, marginTop: 4,
          }}
          onMouseLeave={() => setOpen(false)}
        >
          <div style={{ padding: '2px 10px 4px', fontSize: 10, color: '#6c757d', fontWeight: 600, borderBottom: '1px solid #f0f0f0' }}>
            {label}
          </div>
          {rows.map(([tenor, value]) => (
            <div key={tenor} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 10px', fontSize: 11 }}>
              <span style={{ color: '#495057' }}>{tenor}</span>
              <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{value}</span>
            </div>
          ))}
        </div>
      )}
    </span>
  );
}

const fmt = (v: number | null | undefined, decimals = 2) =>
  v != null
    ? v.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })
    : '\u2014';

const IBR_TENOR_KEYS: [string, string][] = [
  ['O/N', 'ibr_1d'], ['1M', 'ibr_1m'], ['3M', 'ibr_3m'], ['6M', 'ibr_6m'],
  ['1Y', 'ibr_12m'], ['2Y', 'ibr_2y'], ['5Y', 'ibr_5y'], ['10Y', 'ibr_10y'],
];

function ibrMarkRows(mark: HistoricalMark | null): [string, string][] {
  if (!mark?.ibr) return [];
  return IBR_TENOR_KEYS
    .filter(([, k]) => mark.ibr![k] != null)
    .map(([label, k]) => [label, `${(mark.ibr![k] as number).toFixed(3)}%`]);
}

function sofrMarkRows(mark: HistoricalMark | null): [string, string][] {
  if (!mark?.sofr) return [];
  const tenorLabel = (m: number) => m < 12 ? `${m}M` : `${m / 12}Y`;
  return Object.entries(mark.sofr)
    .filter(([, v]) => v != null)
    .map(([months, v]) => [tenorLabel(Number(months)), `${(v as number).toFixed(3)}%`]);
}

function ndfMarkRows(mark: HistoricalMark | null): [string, string][] {
  if (!mark?.ndf) return [];
  const label = (months: string) => Number(months) < 12 ? `${months}M` : `${Number(months) / 12}Y`;
  return Object.entries(mark.ndf).map(([months, v]) => [
    label(months),
    v?.F_market != null ? fmt(v.F_market, 2) : '—',
  ]);
}

function MarkDateBar({
  repricing,
  fecha,
}: {
  repricing: boolean;
  fecha: string;
}) {
  const [mark, setMark] = useState<HistoricalMark | null>(null);
  const [loadingMark, setLoadingMark] = useState(false);
  // Hydration guard: `fecha` viene de globalEvaluationDate (localStorage),
  // que difiere entre SSR (default) y CSR (valor persistido). Renderizamos
  // un placeholder hasta despues del mount para evitar text-content-mismatch.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    setLoadingMark(true);
    setMark(null);
    fetchHistoricalMark(fecha).then(setMark).finally(() => setLoadingMark(false));
  }, [fecha, mounted]);

  const chips: { label: string; ok: boolean; rows: [string, string][] }[] = [
    { label: 'IBR', ok: mark?.hasIbr ?? false, rows: ibrMarkRows(mark) },
    { label: 'SOFR', ok: mark?.hasSofr ?? false, rows: sofrMarkRows(mark) },
    { label: 'NDF', ok: mark?.hasNdf ?? false, rows: ndfMarkRows(mark) },
  ];

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12,
      fontSize: 12, flexWrap: 'wrap', background: '#f8f9fa',
      borderRadius: 6, padding: '6px 12px',
    }}
    >
      <span style={{ color: '#495057', fontWeight: 600 }}>Marca:</span>
      <span style={{
        fontFamily: 'ui-monospace, monospace',
        fontWeight: 500,
        color: '#0f172a',
        padding: '2px 8px',
        border: '1px solid #cbd5e1',
        borderRadius: 4,
        background: '#fff',
        letterSpacing: '0.03em',
        minWidth: 92,
        display: 'inline-block',
        textAlign: 'center',
      }}
      >
        {mounted ? fecha : ' '}
      </span>
      {mounted && loadingMark && (
        <span style={{ color: '#6c757d' }}>…</span>
      )}
      {mounted && !loadingMark && (
        <>
          <span style={{ display: 'flex', gap: 4 }}>
            {chips.map((c) => (
              <MarkChip key={c.label} label={c.label} ok={c.ok} rows={c.rows} />
            ))}
          </span>
          {repricing && (
            <span style={{ color: '#6c757d', fontSize: 11 }}>Repriceando…</span>
          )}
        </>
      )}
    </div>
  );
}

const SOURCE_LABELS: Record<string, string> = {
  set_fx: 'SET FX',
  fxempire: 'FXEmpire',
  fxempire_fwd_pts: 'FXEmpire',
  dtcc: 'DTCC',
  implied: 'Implied',
  banrep: 'Banrep',
  set: 'SET',
  fed: 'Fed',
  manual: 'Manual',
};

const ADD_TYPE_OPTIONS = [
  { value: 'xccy', label: 'XCCY Swap' },
  { value: 'ndf', label: 'NDF' },
  { value: 'ibr', label: 'IBR Swap' },
];

const fmtMM = (v: number | null | undefined) => {
  if (v == null) return '\u2014';
  const abs = Math.abs(v);
  if (abs >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return fmt(v, 2);
};

const fmtInput = (v: number) =>
  v ? v.toLocaleString('en-US', { maximumFractionDigits: 0 }) : '';

const parseInput = (s: string): number => {
  const cleaned = s.replace(/,/g, '');
  return parseFloat(cleaned) || 0;
};

const npvColor = (v: number) => (v >= 0 ? '#28a745' : '#dc3545');

// Compute accrued carry from XCCY cashflows.
// Handles mid-life swaps: backend schedule starts at valuation_date+2d,
// so the first cashflow may start slightly after today. In that case we
// treat period 0 as current and count days from the trade's start_date.

// ── Summary Card ──
function SummaryBar({
  summary,
  pricedAt,
  pnlTotals,
  realizedPnlMtdCop,
  realizedPnlYtdCop,
}: {
  summary: PortfolioSummary | null;
  pricedAt: string | undefined;
  pnlTotals?: { daily: number | null; mtd: number | null; ytd: number | null };
  // P&G Realizado bruto en COP (liquidaciones manuales + settlements de
  // NDFs vencidos), separado por horizonte:
  //   - MTD: del 1er dia del mes de markFecha hasta markFecha
  //   - YTD: del 1ro de enero hasta markFecha
  realizedPnlMtdCop?: number | null;
  realizedPnlYtdCop?: number | null;
}) {
  if (!summary) return null;
  type Item = { label: string; value: string; color: string; unit?: string };
  const items: Item[] = [
    { label: 'NPV COP',   value: fmtMM(summary.total_npv_cop), color: npvColor(summary.total_npv_cop) },
    { label: 'NPV USD',   value: fmtMM(summary.total_npv_usd), color: npvColor(summary.total_npv_usd) },
    { label: 'Carry COP', value: fmtMM(summary.total_carry_cop), color: npvColor(summary.total_carry_cop) },
    { label: 'P&L Tasas', value: fmtMM(summary.total_pnl_rate_cop), color: npvColor(summary.total_pnl_rate_cop) },
    { label: 'P&L FX',    value: fmtMM(summary.total_pnl_fx_cop), color: npvColor(summary.total_pnl_fx_cop) },
    ...(summary.fx_spot != null ? [{ label: 'Spot USD/COP', value: fmt(summary.fx_spot, 2), color: '#212529' } as Item] : []),
    ...(pnlTotals?.daily != null ? [{ label: 'P&L 1D',  value: fmtMM(pnlTotals.daily), color: npvColor(pnlTotals.daily) } as Item] : []),
    ...(pnlTotals?.mtd   != null ? [{ label: 'P&L MTD', value: fmtMM(pnlTotals.mtd),   color: npvColor(pnlTotals.mtd) } as Item] : []),
    ...(pnlTotals?.ytd   != null ? [{ label: 'P&L YTD', value: fmtMM(pnlTotals.ytd),   color: npvColor(pnlTotals.ytd) } as Item] : []),
    ...(realizedPnlMtdCop != null ? [{ label: 'P&G MTD COP', value: fmtMM(realizedPnlMtdCop), color: npvColor(realizedPnlMtdCop) } as Item] : []),
    ...(realizedPnlYtdCop != null ? [{ label: 'P&G YTD COP', value: fmtMM(realizedPnlYtdCop), color: npvColor(realizedPnlYtdCop) } as Item] : []),
  ];
  return (
    <div
      style={{
        display: 'flex',
        gap: 16,
        flexWrap: 'wrap',
        padding: '12px 16px',
        background: '#f8f9fa',
        border: '1px solid #dee2e6',
        borderRadius: 8,
        marginBottom: 16,
        alignItems: 'center',
      }}
    >
      {items.map(({ label, value, color, unit }) => (
        <div key={label} style={{ minWidth: 120 }}>
          <div style={{ fontSize: 10, color: '#6c757d', textTransform: 'uppercase' }}>{label}</div>
          <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'monospace', color }}>
            {value}
            {unit && (
              <span style={{ fontSize: 9, color: '#6c757d', fontWeight: 400, marginLeft: 4 }}>
                {unit}
              </span>
            )}
          </div>
        </div>
      ))}
      {pricedAt && (
        <div style={{ marginLeft: 'auto', fontSize: 11, color: '#6c757d' }}>
          Valorado al {pricedAt}
        </div>
      )}
    </div>
  );
}


// ── Column header with instant hover tooltip ──
function ColTip({ label, tip }: { label: string; tip: string }) {
  const [show, setShow] = useState(false);
  if (!tip) return <span>{label}</span>;
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
      {label}
      <span
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 13, height: 13, borderRadius: '50%',
          background: '#adb5bd', color: '#fff',
          fontSize: 9, fontWeight: 700, cursor: 'help', userSelect: 'none', flexShrink: 0,
        }}
      >
        ?
      </span>
      {show && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0,
          zIndex: 9999, background: '#212529', color: '#fff',
          padding: '6px 10px', borderRadius: 5, fontSize: 11, lineHeight: 1.5,
          width: 220, whiteSpace: 'normal', pointerEvents: 'none',
          boxShadow: '0 3px 10px rgba(0,0,0,0.35)',
        }}>
          {tip}
        </div>
      )}
    </span>
  );
}

// PortfolioRow is imported from BlotterTable component (includes P&L fields)


function resolveEstado(maturityDate: string, stored?: string, valuationDate?: string): string {
  if (stored && stored !== 'Activo') return stored; // Cancelado u otro valor explícito
  const cutoff = valuationDate || new Date().toISOString().slice(0, 10);
  return maturityDate < cutoff ? 'Vencido' : 'Activo';
}

function buildPortfolioRows(
  xccy: PricedXccy[],
  ndf: PricedNdf[],
  ibr: PricedIbrSwap[],
  settlementMap: Record<string, NdfSettlementResult | 'error'> = {},
  refPrices?: {
    daily: PortfolioRepriceResponse | null;
    mtd: PortfolioRepriceResponse | null;
    ytd: PortfolioRepriceResponse | null;
  },
  valuationDate?: string,
): PortfolioRow[] {
  // Mapas de lookup por id para cada periodo de referencia
  const toMap = <T extends { id: string }>(arr: T[]): Record<string, T> =>
    Object.fromEntries(arr.map((r) => [r.id, r]));

  const dailyXccy = refPrices?.daily ? toMap(refPrices.daily.xccy_results) : null;
  const mtdXccy   = refPrices?.mtd   ? toMap(refPrices.mtd.xccy_results)   : null;
  const ytdXccy   = refPrices?.ytd   ? toMap(refPrices.ytd.xccy_results)   : null;

  const dailyNdf  = refPrices?.daily ? toMap(refPrices.daily.ndf_results) : null;
  const mtdNdf    = refPrices?.mtd   ? toMap(refPrices.mtd.ndf_results)   : null;
  const ytdNdf    = refPrices?.ytd   ? toMap(refPrices.ytd.ndf_results)   : null;

  const dailyIbr  = refPrices?.daily ? toMap(refPrices.daily.ibr_swap_results) : null;
  const mtdIbr    = refPrices?.mtd   ? toMap(refPrices.mtd.ibr_swap_results)   : null;
  const ytdIbr    = refPrices?.ytd   ? toMap(refPrices.ytd.ibr_swap_results)   : null;

  // Helper genérico: calcula P&L comparando NPV de hoy vs referencia
  // null = marca no disponible; si la posición no existía en referencia → todo el NPV es P&L
  const pnlFrom = <T extends { error?: string }>(
    todayNpv: number,
    map: Record<string, T> | null,
    id: string,
    getNpv: (r: T) => number
  ): number | null => {
    if (map === null) return null;          // sin marca para este periodo
    const ref = map[id];
    if (!ref) return todayNpv;             // posición nueva → P&L desde inception
    if (ref.error) return null;            // referencia con error → N/A
    return todayNpv - getNpv(ref);
  };

  const rows: PortfolioRow[] = [];

  for (const r of xccy) {
    rows.push({
      id: r.id, type: 'XCCY', label: r.label, counterparty: r.counterparty,
      notional_usd: r.notional_usd, maturity_date: r.maturity_date,
      detail: `${r.pay_usd ? 'Pay SOFR' : 'Pay IBR'} | ${fmt(r.usd_spread_bps, 0)}bps | ${r.amortization_type} ${r.payment_frequency}`,
      npv_cop: r.npv_cop, npv_usd: r.npv_usd,
      pnl_cop: r.error ? 0 : (r.pnl_rate_cop ?? 0) + (r.pnl_fx_cop ?? 0),
      carry_cop: r.carry_cop, carry_label: '/dia',
      dv01: r.dv01_ibr, dv01_label: 'IBR',
      dv01_2: r.dv01_sofr, dv01_2_label: 'SOFR',
      fx_delta: r.fx_delta, error: r.error,
      id_operacion: r.id_operacion, trade_date: r.trade_date, sociedad: r.sociedad, id_banco: r.id_banco, estado: resolveEstado(r.maturity_date, r.estado, valuationDate),
      _xccy: r,
      pnl_1d_cop:  pnlFrom(r.npv_cop, dailyXccy, r.id, (x) => x.npv_cop),
      pnl_mtd_cop: pnlFrom(r.npv_cop, mtdXccy,   r.id, (x) => x.npv_cop),
      pnl_ytd_cop: pnlFrom(r.npv_cop, ytdXccy,   r.id, (x) => x.npv_cop),
      pnl_1d_usd:  pnlFrom(r.npv_usd, dailyXccy, r.id, (x) => x.npv_usd),
      pnl_mtd_usd: pnlFrom(r.npv_usd, mtdXccy,   r.id, (x) => x.npv_usd),
      pnl_ytd_usd: pnlFrom(r.npv_usd, ytdXccy,   r.id, (x) => x.npv_usd),
    });
  }

  for (const r of ndf) {
    // r.notional_usd aqui es el RECONSTRUIDO para valuationDate (el hook
    // de reprice ya lo recalculo). Si > 0, la posicion estaba activa al
    // markFecha aunque el estado HOY sea 'Liquidado'. Reemplazamos el
    // stored estado por 'Activo' para que la vista historica sea coherente.
    const storedEstado = r.notional_usd > 0 ? 'Activo' : r.estado;
    const estado = resolveEstado(r.maturity_date, storedEstado, valuationDate);
    const settlementEntry = settlementMap[r.id];
    const settlement = settlementEntry != null && settlementEntry !== 'error' ? settlementEntry : null;
    const isSettled = estado === 'Vencido' && settlement != null;
    const todayNpvCop = isSettled ? settlement.pyl_cop : r.npv_cop;
    const todayNpvUsd = isSettled ? settlement.pyl_usd : r.npv_usd;
    rows.push({
      id: r.id, type: 'NDF', label: r.label, counterparty: r.counterparty,
      notional_usd: r.notional_usd, maturity_date: r.maturity_date,
      detail: isSettled
        ? `${r.direction === 'buy' ? 'Compra' : 'Venta'} | Strike ${fmt(r.strike, 2)} | TRM ${fmt(settlement.trm_fixing, 2)} (${settlement.trm_date})`
        : `${r.direction === 'buy' ? 'Compra' : 'Venta'} | Strike ${fmt(r.strike, 2)} | Fwd ${r.error ? '-' : fmt(r.forward, 2)} | ${r.days_to_maturity ?? '?'}d`,
      npv_cop: todayNpvCop,
      npv_usd: todayNpvUsd,
      pnl_cop: isSettled ? settlement.pyl_cop : (r.error ? 0 : r.npv_cop),
      carry_cop: isSettled ? 0 : r.carry_cop_daily, carry_label: isSettled ? 'Liq.' : '/dia',
      dv01: isSettled ? 0 : r.dv01_cop, dv01_label: 'COP',
      dv01_2: isSettled ? 0 : r.dv01_usd, dv01_2_label: 'USD',
      fx_delta: isSettled ? 0 : r.fx_delta,
      error: isSettled ? undefined : r.error,
      id_operacion: r.id_operacion, trade_date: r.trade_date, sociedad: r.sociedad, id_banco: r.id_banco, estado,
      _ndf: r,
      pnl_1d_cop:  pnlFrom(todayNpvCop, dailyNdf, r.id, (x) => x.npv_cop),
      pnl_mtd_cop: pnlFrom(todayNpvCop, mtdNdf,   r.id, (x) => x.npv_cop),
      pnl_ytd_cop: pnlFrom(todayNpvCop, ytdNdf,   r.id, (x) => x.npv_cop),
      pnl_1d_usd:  pnlFrom(todayNpvUsd, dailyNdf, r.id, (x) => x.npv_usd),
      pnl_mtd_usd: pnlFrom(todayNpvUsd, mtdNdf,   r.id, (x) => x.npv_usd),
      pnl_ytd_usd: pnlFrom(todayNpvUsd, ytdNdf,   r.id, (x) => x.npv_usd),
    });
  }

  for (const r of ibr) {
    const todayNpvCop = r.npv;
    const todayNpvUsd = r.npv / 4200;
    rows.push({
      id: r.id, type: 'IBR', label: r.label, counterparty: r.counterparty,
      notional_usd: r.notional / 4200, // approx USD for sorting
      maturity_date: r.maturity_date,
      detail: `${r.pay_fixed ? 'Pay Fija' : 'Pay IBR'} | Fija ${fmt(r.fixed_rate * 100, 2)}% | Fair ${r.error ? '-' : fmt(r.fair_rate * 100, 2)}% | IBR O/N ${r.error ? '-' : fmt(r.ibr_overnight_pct, 2)}% | Diff ${r.error ? '-' : fmt(r.carry_daily_diff_bps, 0)}bps`,
      npv_cop: todayNpvCop, npv_usd: todayNpvUsd,
      pnl_cop: r.error ? 0 : r.npv,
      carry_cop: r.carry_daily_cop, carry_label: '/dia',
      dv01: r.dv01, dv01_label: 'IBR',
      error: r.error,
      id_operacion: r.id_operacion, trade_date: r.trade_date, sociedad: r.sociedad, id_banco: r.id_banco, estado: resolveEstado(r.maturity_date, r.estado, valuationDate),
      _ibr: r,
      pnl_1d_cop:  pnlFrom(todayNpvCop, dailyIbr, r.id, (x) => x.npv),
      pnl_mtd_cop: pnlFrom(todayNpvCop, mtdIbr,   r.id, (x) => x.npv),
      pnl_ytd_cop: pnlFrom(todayNpvCop, ytdIbr,   r.id, (x) => x.npv),
      pnl_1d_usd:  pnlFrom(todayNpvUsd, dailyIbr, r.id, (x) => x.npv / 4200),
      pnl_mtd_usd: pnlFrom(todayNpvUsd, mtdIbr,   r.id, (x) => x.npv / 4200),
      pnl_ytd_usd: pnlFrom(todayNpvUsd, ytdIbr,   r.id, (x) => x.npv / 4200),
    });
  }

  return rows;
}

// PortfolioTable has been replaced by BlotterTable component

// ── Add Position Modals ──

function AddXccyModal({
  show,
  onHide,
  onSave,
}: {
  show: boolean;
  onHide: () => void;
  onSave: (v: NewXccyPosition) => void;
}) {
  const [label, setLabel] = useState('');
  const [counterparty, setCounterparty] = useState('');
  const [notionalUsd, setNotionalUsd] = useState(0);
  const [startDate, setStartDate] = useState('');
  const [maturityDate, setMaturityDate] = useState('');
  const [usdSpread, setUsdSpread] = useState(0);
  const [copSpread, setCopSpread] = useState(0);
  const [payUsd, setPayUsd] = useState(true);
  const [fxInitial, setFxInitial] = useState(0);
  const [freq, setFreq] = useState('3M');
  const [amortType, setAmortType] = useState('bullet');
  // Operational
  const [idOperacion, setIdOperacion] = useState('');
  const [tradeDate, setTradeDate] = useState('');
  const [sociedad, setSociedad] = useState('BP01');
  const [idBanco, setIdBanco] = useState('');
  const [modalidad, setModalidad] = useState('Non Delivery');
  const [settlementDate, setSettlementDate] = useState('');
  const [tipoDivisa, setTipoDivisa] = useState('USD/COP');
  const [estado, setEstado] = useState('Activo');
  const [docSap, setDocSap] = useState('');

  const handleSave = () => {
    if (!notionalUsd || !startDate || !maturityDate) {
      toast.warn('Completa nocional, fecha inicio y vencimiento');
      return;
    }
    onSave({
      label,
      counterparty,
      notional_usd: notionalUsd,
      start_date: startDate,
      maturity_date: maturityDate,
      usd_spread_bps: usdSpread,
      cop_spread_bps: copSpread,
      pay_usd: payUsd,
      fx_initial: fxInitial,
      payment_frequency: freq,
      amortization_type: amortType,
      id_operacion: idOperacion || undefined,
      trade_date: tradeDate || undefined,
      sociedad: sociedad || undefined,
      id_banco: idBanco || undefined,
      modalidad: modalidad || undefined,
      settlement_date: settlementDate || undefined,
      tipo_divisa: tipoDivisa || undefined,
      estado: estado || undefined,
      doc_sap: docSap || undefined,
    });
    onHide();
  };

  return (
    <Modal show={show} onHide={onHide} size="lg">
      <Modal.Header closeButton>
        <Modal.Title style={{ fontSize: 16 }}>Nueva Posicion XCCY</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#004085', marginBottom: 6 }}>Datos del Instrumento</div>
        <Row className="g-2 mb-3">
          <Col md={4}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>ID Operacion</Form.Label>
              <Form.Control size="sm" value={idOperacion} onChange={(e) => setIdOperacion(e.target.value)} />
            </Form.Group>
          </Col>
          <Col md={4}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Contraparte</Form.Label>
              <Form.Control size="sm" value={counterparty} onChange={(e) => setCounterparty(e.target.value)} />
            </Form.Group>
          </Col>
          <Col md={4}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Label</Form.Label>
              <Form.Control size="sm" value={label} onChange={(e) => setLabel(e.target.value)} />
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Nocional USD</Form.Label>
              <Form.Control
                size="sm"
                value={fmtInput(notionalUsd)}
                onChange={(e) => setNotionalUsd(parseInput(e.target.value))}
              />
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>FX Pactacion</Form.Label>
              <Form.Control
                size="sm"
                type="number"
                step="0.01"
                value={fxInitial || ''}
                onChange={(e) => setFxInitial(parseFloat(e.target.value) || 0)}
              />
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>USD Spread (bps)</Form.Label>
              <Form.Control
                size="sm"
                type="number"
                step="0.1"
                value={usdSpread || ''}
                onChange={(e) => setUsdSpread(parseFloat(e.target.value) || 0)}
              />
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>COP Spread (bps)</Form.Label>
              <Form.Control
                size="sm"
                type="number"
                step="0.1"
                value={copSpread || ''}
                onChange={(e) => setCopSpread(parseFloat(e.target.value) || 0)}
              />
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Pago</Form.Label>
              <Form.Select size="sm" value={payUsd ? 'usd' : 'cop'} onChange={(e) => setPayUsd(e.target.value === 'usd')}>
                <option value="usd">Pago SOFR</option>
                <option value="cop">Pago IBR</option>
              </Form.Select>
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Frecuencia</Form.Label>
              <Form.Select size="sm" value={freq} onChange={(e) => setFreq(e.target.value)}>
                <option value="1M">Mensual</option>
                <option value="3M">Trimestral</option>
                <option value="6M">Semestral</option>
                <option value="12M">Anual</option>
              </Form.Select>
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Amortizacion</Form.Label>
              <Form.Select size="sm" value={amortType} onChange={(e) => setAmortType(e.target.value)}>
                <option value="bullet">Bullet</option>
                <option value="linear">Lineal</option>
              </Form.Select>
            </Form.Group>
          </Col>
        </Row>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#004085', marginBottom: 6 }}>Fechas y Operacion</div>
        <Row className="g-2">
          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Fecha Celebracion</Form.Label>
              <Form.Control size="sm" type="date" value={tradeDate} onChange={(e) => setTradeDate(e.target.value)} />
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Fecha Inicio</Form.Label>
              <Form.Control size="sm" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Fecha Vencimiento</Form.Label>
              <Form.Control size="sm" type="date" value={maturityDate} onChange={(e) => setMaturityDate(e.target.value)} />
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Fecha Cumplimiento</Form.Label>
              <Form.Control size="sm" type="date" value={settlementDate} onChange={(e) => setSettlementDate(e.target.value)} />
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Modalidad</Form.Label>
              <Form.Select size="sm" value={modalidad} onChange={(e) => setModalidad(e.target.value)}>
                <option value="Non Delivery">Non Delivery</option>
                <option value="Delivery">Delivery</option>
              </Form.Select>
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Tipo Divisa</Form.Label>
              <Form.Select size="sm" value={tipoDivisa} onChange={(e) => setTipoDivisa(e.target.value)}>
                <option value="USD/COP">USD/COP</option>
                <option value="EUR/COP">EUR/COP</option>
              </Form.Select>
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Sociedad</Form.Label>
              <Form.Control size="sm" value={sociedad} onChange={(e) => setSociedad(e.target.value)} />
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>ID Operacion Banco</Form.Label>
              <Form.Control size="sm" value={idBanco} onChange={(e) => setIdBanco(e.target.value)} />
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Estado</Form.Label>
              <Form.Select size="sm" value={estado} onChange={(e) => setEstado(e.target.value)}>
                <option value="Activo">Activo</option>
                <option value="Vencido">Vencido</option>
                <option value="Cancelado">Cancelado</option>
              </Form.Select>
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Doc SAP</Form.Label>
              <Form.Control size="sm" value={docSap} onChange={(e) => setDocSap(e.target.value)} />
            </Form.Group>
          </Col>
        </Row>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" size="sm" onClick={onHide}>Cancelar</Button>
        <Button variant="primary" size="sm" onClick={handleSave}>Guardar</Button>
      </Modal.Footer>
    </Modal>
  );
}

function AddNdfModal({
  show,
  onHide,
  onSave,
}: {
  show: boolean;
  onHide: () => void;
  onSave: (v: NewNdfPosition) => void;
}) {
  const [label, setLabel] = useState('');
  const [counterparty, setCounterparty] = useState('');
  const [notionalUsd, setNotionalUsd] = useState(0);
  const [strike, setStrike] = useState(0);
  const [maturityDate, setMaturityDate] = useState('');
  const [direction, setDirection] = useState('sell');
  // Operational fields
  const [idOperacion, setIdOperacion] = useState('');
  const [tradeDate, setTradeDate] = useState('');
  const [sociedad, setSociedad] = useState('BP01');
  const [idBanco, setIdBanco] = useState('');
  const [modalidad, setModalidad] = useState('Non Delivery');
  const [settlementDate, setSettlementDate] = useState('');
  const [tipoDivisa, setTipoDivisa] = useState('USD/COP');
  const [estado, setEstado] = useState('Activo');
  const [docSap, setDocSap] = useState('');

  const handleSave = () => {
    if (!notionalUsd || !strike || !maturityDate) {
      toast.warn('Completa nocional, strike y fecha vencimiento');
      return;
    }
    onSave({
      label,
      counterparty,
      notional_usd: notionalUsd,
      strike,
      maturity_date: maturityDate,
      direction,
      id_operacion: idOperacion || undefined,
      trade_date: tradeDate || undefined,
      sociedad: sociedad || undefined,
      id_banco: idBanco || undefined,
      modalidad: modalidad || undefined,
      settlement_date: settlementDate || undefined,
      tipo_divisa: tipoDivisa || undefined,
      estado: estado || undefined,
      doc_sap: docSap || undefined,
    });
    onHide();
  };

  return (
    <Modal show={show} onHide={onHide} size="lg">
      <Modal.Header closeButton>
        <Modal.Title style={{ fontSize: 16 }}>Nueva Posicion NDF</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {/* Core fields */}
        <div style={{ fontSize: 11, fontWeight: 700, color: '#004085', marginBottom: 6 }}>Datos del Instrumento</div>
        <Row className="g-2 mb-3">
          <Col md={4}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>ID Operacion Interno</Form.Label>
              <Form.Control size="sm" value={idOperacion} onChange={(e) => setIdOperacion(e.target.value)} placeholder="FW-BOCS-05.02.2026" />
            </Form.Group>
          </Col>
          <Col md={4}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Contraparte</Form.Label>
              <Form.Control size="sm" value={counterparty} onChange={(e) => setCounterparty(e.target.value)} />
            </Form.Group>
          </Col>
          <Col md={4}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Label</Form.Label>
              <Form.Control size="sm" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Nombre descriptivo" />
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Nocional USD</Form.Label>
              <Form.Control
                size="sm"
                value={fmtInput(notionalUsd)}
                onChange={(e) => setNotionalUsd(parseInput(e.target.value))}
              />
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Tasa FW (Strike)</Form.Label>
              <Form.Control
                size="sm"
                type="number"
                step="0.01"
                value={strike || ''}
                onChange={(e) => setStrike(parseFloat(e.target.value) || 0)}
              />
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Tipo Operacion</Form.Label>
              <Form.Select size="sm" value={direction} onChange={(e) => setDirection(e.target.value)}>
                <option value="sell">VENTA (USD)</option>
                <option value="buy">COMPRA (USD)</option>
              </Form.Select>
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Modalidad</Form.Label>
              <Form.Select size="sm" value={modalidad} onChange={(e) => setModalidad(e.target.value)}>
                <option value="Non Delivery">Non Delivery</option>
                <option value="Delivery">Delivery</option>
              </Form.Select>
            </Form.Group>
          </Col>
        </Row>
        {/* Dates & operational */}
        <div style={{ fontSize: 11, fontWeight: 700, color: '#004085', marginBottom: 6 }}>Fechas y Operacion</div>
        <Row className="g-2 mb-3">
          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Fecha Celebracion</Form.Label>
              <Form.Control size="sm" type="date" value={tradeDate} onChange={(e) => setTradeDate(e.target.value)} />
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Fecha Vencimiento</Form.Label>
              <Form.Control size="sm" type="date" value={maturityDate} onChange={(e) => setMaturityDate(e.target.value)} />
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Fecha Cumplimiento</Form.Label>
              <Form.Control size="sm" type="date" value={settlementDate} onChange={(e) => setSettlementDate(e.target.value)} />
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Tipo Divisa</Form.Label>
              <Form.Select size="sm" value={tipoDivisa} onChange={(e) => setTipoDivisa(e.target.value)}>
                <option value="USD/COP">USD/COP</option>
                <option value="EUR/COP">EUR/COP</option>
              </Form.Select>
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Sociedad</Form.Label>
              <Form.Control size="sm" value={sociedad} onChange={(e) => setSociedad(e.target.value)} placeholder="BP01" />
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>ID Operacion Banco</Form.Label>
              <Form.Control size="sm" value={idBanco} onChange={(e) => setIdBanco(e.target.value)} placeholder="FW327520" />
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Estado</Form.Label>
              <Form.Select size="sm" value={estado} onChange={(e) => setEstado(e.target.value)}>
                <option value="Activo">Activo</option>
                <option value="Vencido">Vencido</option>
                <option value="Cancelado">Cancelado</option>
              </Form.Select>
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Doc SAP</Form.Label>
              <Form.Control size="sm" value={docSap} onChange={(e) => setDocSap(e.target.value)} placeholder="6000003210" />
            </Form.Group>
          </Col>
        </Row>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" size="sm" onClick={onHide}>Cancelar</Button>
        <Button variant="primary" size="sm" onClick={handleSave}>Guardar</Button>
      </Modal.Footer>
    </Modal>
  );
}

// Compute default dates
const getTodayStr = () => new Date().toISOString().slice(0, 10);
const getT2Str = () => {
  const d = new Date();
  d.setDate(d.getDate() + 2);
  return d.toISOString().slice(0, 10);
};

function AddIbrSwapModal({
  show,
  onHide,
  onSave,
}: {
  show: boolean;
  onHide: () => void;
  onSave: (v: NewIbrSwapPosition) => void;
}) {
  const [label, setLabel] = useState('');
  const [counterparty, setCounterparty] = useState('');
  const [notional, setNotional] = useState(0);
  const [startDate, setStartDate] = useState(getT2Str);
  const [maturityDate, setMaturityDate] = useState('');
  const [fixedRate, setFixedRate] = useState(0);
  const [payFixed, setPayFixed] = useState(true);
  const [spreadBps, setSpreadBps] = useState(0);
  const [freq, setFreq] = useState('3M');
  const [tenor, setTenor] = useState('');

  const yearsMap: Record<string, number> = { '1Y': 1, '2Y': 2, '3Y': 3, '5Y': 5, '7Y': 7, '10Y': 10, '15Y': 15, '20Y': 20 };

  const calcMaturity = (sd: string, t: string) => {
    if (!sd || !t) return;
    const y = yearsMap[t];
    if (y) {
      const mat = new Date(sd + 'T00:00:00');
      mat.setFullYear(mat.getFullYear() + y);
      setMaturityDate(mat.toISOString().slice(0, 10));
    }
  };

  const handleTenor = (t: string) => {
    setTenor(t);
    calcMaturity(startDate, t);
  };

  const handleStartDate = (sd: string) => {
    setStartDate(sd);
    calcMaturity(sd, tenor);
  };

  // Operational
  const [idOperacion, setIdOperacion] = useState('');
  const [tradeDate, setTradeDate] = useState(getTodayStr);
  const [sociedad, setSociedad] = useState('BP01');
  const [idBanco, setIdBanco] = useState('');
  const [modalidad, setModalidad] = useState('OIS');
  const [settlementDate, setSettlementDate] = useState(getT2Str);
  const [tipoDivisa, setTipoDivisa] = useState('COP');
  const [estado, setEstado] = useState('Activo');
  const [docSap, setDocSap] = useState('');

  const handleSave = () => {
    if (!notional || notional <= 0) {
      toast.warn('El nocional debe ser mayor a cero');
      return;
    }
    if (!fixedRate || fixedRate <= 0) {
      toast.warn('Ingrese una tasa fija válida');
      return;
    }
    if (!startDate) {
      toast.warn('Ingrese la fecha de inicio');
      return;
    }
    if (!maturityDate) {
      toast.warn('Ingrese la fecha de vencimiento (o seleccione un tenor)');
      return;
    }
    if (new Date(maturityDate) <= new Date(startDate)) {
      toast.warn('La fecha de vencimiento debe ser posterior a la fecha de inicio');
      return;
    }
    onSave({
      label,
      counterparty,
      notional,
      start_date: startDate,
      maturity_date: maturityDate,
      fixed_rate: fixedRate / 100,
      pay_fixed: payFixed,
      spread_bps: spreadBps,
      payment_frequency: freq,
      id_operacion: idOperacion || undefined,
      trade_date: tradeDate || undefined,
      sociedad: sociedad || undefined,
      id_banco: idBanco || undefined,
      modalidad: modalidad || undefined,
      settlement_date: settlementDate || undefined,
      tipo_divisa: tipoDivisa || undefined,
      estado: estado || undefined,
      doc_sap: docSap || undefined,
    });
    onHide();
  };

  return (
    <Modal show={show} onHide={onHide} size="lg">
      <Modal.Header closeButton>
        <Modal.Title style={{ fontSize: 16 }}>Nueva Posicion IBR Swap</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#004085', marginBottom: 6 }}>Datos del Instrumento</div>
        <Row className="g-2 mb-3">
          <Col md={4}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>ID Operacion</Form.Label>
              <Form.Control size="sm" value={idOperacion} onChange={(e) => setIdOperacion(e.target.value)} />
            </Form.Group>
          </Col>
          <Col md={4}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Contraparte</Form.Label>
              <Form.Control size="sm" value={counterparty} onChange={(e) => setCounterparty(e.target.value)} />
            </Form.Group>
          </Col>
          <Col md={4}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Label</Form.Label>
              <Form.Control size="sm" value={label} onChange={(e) => setLabel(e.target.value)} />
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Nocional COP</Form.Label>
              <Form.Control
                size="sm"
                value={fmtInput(notional)}
                onChange={(e) => setNotional(parseInput(e.target.value))}
              />
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Tasa Fija (%)</Form.Label>
              <Form.Control
                size="sm"
                type="number"
                step="0.01"
                value={fixedRate || ''}
                onChange={(e) => setFixedRate(parseFloat(e.target.value) || 0)}
              />
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Spread (bps)</Form.Label>
              <Form.Control
                size="sm"
                type="number"
                step="0.1"
                value={spreadBps || ''}
                onChange={(e) => setSpreadBps(parseFloat(e.target.value) || 0)}
              />
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Pago</Form.Label>
              <Form.Select size="sm" value={payFixed ? 'fixed' : 'float'} onChange={(e) => setPayFixed(e.target.value === 'fixed')}>
                <option value="fixed">Pago Fija</option>
                <option value="float">Pago IBR</option>
              </Form.Select>
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Frecuencia</Form.Label>
              <Form.Select size="sm" value={freq} onChange={(e) => setFreq(e.target.value)}>
                <option value="1M">Mensual</option>
                <option value="3M">Trimestral</option>
                <option value="6M">Semestral</option>
                <option value="12M">Anual</option>
                <option value="Bullet">Bullet</option>
              </Form.Select>
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Tenor</Form.Label>
              <Form.Select size="sm" value={tenor} onChange={(e) => handleTenor(e.target.value)}>
                <option value="">Manual</option>
                <option value="1Y">1 Año</option>
                <option value="2Y">2 Años</option>
                <option value="3Y">3 Años</option>
                <option value="5Y">5 Años</option>
                <option value="7Y">7 Años</option>
                <option value="10Y">10 Años</option>
                <option value="15Y">15 Años</option>
                <option value="20Y">20 Años</option>
              </Form.Select>
              {tenor && <Form.Text style={{ fontSize: 10 }} className="text-muted">Vencimiento auto-calculado</Form.Text>}
            </Form.Group>
          </Col>
        </Row>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#004085', marginBottom: 6 }}>Fechas y Operacion</div>
        <Row className="g-2">
          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Fecha Celebracion</Form.Label>
              <Form.Control size="sm" type="date" value={tradeDate} onChange={(e) => setTradeDate(e.target.value)} />
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Fecha Inicio</Form.Label>
              <Form.Control size="sm" type="date" value={startDate} onChange={(e) => handleStartDate(e.target.value)} />
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Fecha Vencimiento</Form.Label>
              <Form.Control size="sm" type="date" value={maturityDate} onChange={(e) => { setMaturityDate(e.target.value); setTenor(''); }} />
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Fecha Cumplimiento</Form.Label>
              <Form.Control size="sm" type="date" value={settlementDate} onChange={(e) => setSettlementDate(e.target.value)} />
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Modalidad</Form.Label>
              <Form.Control size="sm" value={modalidad} onChange={(e) => setModalidad(e.target.value)} placeholder="OIS, Swap, etc." />
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Tipo Divisa</Form.Label>
              <Form.Select size="sm" value={tipoDivisa} onChange={(e) => setTipoDivisa(e.target.value)}>
                <option value="COP">COP</option>
                <option value="USD/COP">USD/COP</option>
              </Form.Select>
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Sociedad</Form.Label>
              <Form.Control size="sm" value={sociedad} onChange={(e) => setSociedad(e.target.value)} />
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>ID Operacion Banco</Form.Label>
              <Form.Control size="sm" value={idBanco} onChange={(e) => setIdBanco(e.target.value)} />
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Estado</Form.Label>
              <Form.Select size="sm" value={estado} onChange={(e) => setEstado(e.target.value)}>
                <option value="Activo">Activo</option>
                <option value="Vencido">Vencido</option>
                <option value="Cancelado">Cancelado</option>
              </Form.Select>
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Doc SAP</Form.Label>
              <Form.Control size="sm" value={docSap} onChange={(e) => setDocSap(e.target.value)} />
            </Form.Group>
          </Col>
        </Row>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" size="sm" onClick={onHide}>Cancelar</Button>
        <Button variant="primary" size="sm" onClick={handleSave}>Guardar</Button>
      </Modal.Footer>
    </Modal>
  );
}

// ── Detail Modals ──

// Operational fields section (shared across all detail modals)
const OperationalSection = ({ row }: { row: { id_operacion?: string; trade_date?: string; sociedad?: string; id_banco?: string; modalidad?: string; settlement_date?: string; tipo_divisa?: string; estado?: string; doc_sap?: string } }) => {
  const hasAny = row.id_operacion || row.trade_date || row.sociedad || row.id_banco || row.estado || row.doc_sap;
  if (!hasAny) return null;
  return (
    <div style={{ padding: 12, border: '1px solid #dee2e6', borderRadius: 8, marginTop: 16, background: '#f8f9fa' }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: '#495057' }}>Datos Operativos</div>
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 12 }}>
        {row.id_operacion && <div><span style={{ color: '#6c757d' }}>ID Operacion:</span> <strong>{row.id_operacion}</strong></div>}
        {row.trade_date && <div><span style={{ color: '#6c757d' }}>Fecha Celebracion:</span> <strong>{row.trade_date}</strong></div>}
        {row.sociedad && <div><span style={{ color: '#6c757d' }}>Sociedad:</span> <strong>{row.sociedad}</strong></div>}
        {row.id_banco && <div><span style={{ color: '#6c757d' }}>ID Banco:</span> <strong>{row.id_banco}</strong></div>}
        {row.modalidad && <div><span style={{ color: '#6c757d' }}>Modalidad:</span> <strong>{row.modalidad}</strong></div>}
        {row.settlement_date && <div><span style={{ color: '#6c757d' }}>Fecha Cumplimiento:</span> <strong>{row.settlement_date}</strong></div>}
        {row.tipo_divisa && <div><span style={{ color: '#6c757d' }}>Tipo Divisa:</span> <strong>{row.tipo_divisa}</strong></div>}
        {row.estado && <div><span style={{ color: '#6c757d' }}>Estado:</span> <strong>{row.estado}</strong></div>}
        {row.doc_sap && <div><span style={{ color: '#6c757d' }}>Doc SAP:</span> <strong>{row.doc_sap}</strong></div>}
      </div>
    </div>
  );
};

const detailRow = (label: string, value: string, color?: string) => (
  <tr key={label}>
    <td style={{ padding: '4px 8px', color: '#6c757d', fontSize: 12, whiteSpace: 'nowrap' }}>{label}</td>
    <td style={{ padding: '4px 8px', fontFamily: 'monospace', fontSize: 12, fontWeight: 600, color: color || '#212529', textAlign: 'right' }}>{value}</td>
  </tr>
);

const npvBox = (label: string, value: number, suffix = '') => (
  <div style={{
    flex: 1, padding: '12px 16px', borderRadius: 8, textAlign: 'center',
    background: value >= 0 ? '#d4edda' : '#f8d7da',
  }}>
    <div style={{ fontSize: 10, textTransform: 'uppercase', color: '#6c757d' }}>{label}</div>
    <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'monospace', color: npvColor(value) }}>
      {fmtMM(value)}{suffix}
    </div>
  </div>
);

function XccyDetailModal({ row, show, onHide }: { row: PricedXccy | null; show: boolean; onHide: () => void }) {
  if (!row) return null;
  return (
    <Modal show={show} onHide={onHide} size="xl">
      <Modal.Header closeButton>
        <Modal.Title style={{ fontSize: 16 }}>{row.label} — {row.counterparty}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {/* NPV boxes */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          {npvBox('NPV USD', row.npv_usd)}
          {npvBox('NPV COP', row.npv_cop)}
          <div style={{ flex: 1, padding: '12px 16px', borderRadius: 8, textAlign: 'center', background: row.par_basis_bps != null ? '#cce5ff' : '#f8f9fa', border: '1px solid #dee2e6' }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', color: row.par_basis_bps != null ? '#004085' : '#6c757d' }}>
              <ColTip label="Par Basis" tip="Spread justo de basis XCCY para una nueva operación hoy. No disponible para swaps mid-life ya que el cálculo de estructura FX fija no es comparable al basis de mercado." />
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'monospace', color: row.par_basis_bps != null ? '#004085' : '#adb5bd' }}>
              {row.par_basis_bps != null ? `${fmt(row.par_basis_bps, 1)} bps` : 'N/A'}
            </div>
          </div>
        </div>

        {/* P&L decomposition */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1, padding: 12, border: '1px solid #dee2e6', borderRadius: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 4 }}>P&L por Tasas</div>
            <div style={{ fontFamily: 'monospace', fontSize: 14, color: npvColor(row.pnl_rate_cop) }}>
              {fmtMM(row.pnl_rate_cop)} COP
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#6c757d' }}>
              {fmtMM(row.pnl_rate_usd)} USD
            </div>
            <div style={{ fontSize: 10, color: '#6c757d', marginTop: 4 }}>Diferencial de tasas (spread contractual vs mercado)</div>
          </div>
          <div style={{ flex: 1, padding: 12, border: '1px solid #dee2e6', borderRadius: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 4 }}>P&L por FX</div>
            <div style={{ fontFamily: 'monospace', fontSize: 14, color: npvColor(row.pnl_fx_cop) }}>
              {fmtMM(row.pnl_fx_cop)} COP
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#6c757d' }}>
              {fmtMM(row.pnl_fx_usd)} USD
            </div>
            <div style={{ fontSize: 10, color: '#6c757d', marginTop: 4 }}>Movimiento del tipo de cambio (spot vs pactacion)</div>
          </div>
        </div>

        {/* Risk Metrics: DV01 & FX Exposure */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1, padding: 12, border: '2px solid #6f42c1', borderRadius: 8, background: '#f3eefa' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#6f42c1', marginBottom: 8 }}>DV01 (sensibilidad +1bp)</div>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 10, color: '#6c757d' }}>DV01 IBR</div>
                <div style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 700, color: npvColor(row.dv01_ibr) }}>
                  {fmtMM(row.dv01_ibr)} COP
                </div>
                <div style={{ fontSize: 10, color: '#6c757d' }}>Si IBR sube 1bp, NPV cambia en este monto</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#6c757d' }}>DV01 SOFR</div>
                <div style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 700, color: npvColor(row.dv01_sofr) }}>
                  {fmtMM(row.dv01_sofr)} COP
                </div>
                <div style={{ fontSize: 10, color: '#6c757d' }}>Si SOFR sube 1bp, NPV cambia en este monto</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#6c757d' }}>DV01 Total</div>
                <div style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 700, color: npvColor(row.dv01_total) }}>
                  {fmtMM(row.dv01_total)} COP
                </div>
              </div>
            </div>
          </div>
          <div style={{ flex: 1, padding: 12, border: '2px solid #fd7e14', borderRadius: 8, background: '#fff8f0' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fd7e14', marginBottom: 8 }}>FX Exposure</div>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 10, color: '#6c757d' }}>FX Delta</div>
                <div style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 700, color: npvColor(row.fx_delta) }}>
                  {fmtMM(row.fx_delta)} COP
                </div>
                <div style={{ fontSize: 10, color: '#6c757d' }}>Cambio en NPV por +$1 en USDCOP</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#6c757d' }}>Exposicion USD</div>
                <div style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 700 }}>
                  {fmtMM(row.fx_exposure_usd)} USD
                </div>
                <div style={{ fontSize: 10, color: '#6c757d' }}>PV total de pata USD (intereses + principal)</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#6c757d' }}>FX Pactacion</div>
                <div style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 700 }}>
                  {fmt(row.fx_initial, 2)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#6c757d' }}>FX Spot</div>
                <div style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 700 }}>
                  {fmt(row.fx_spot, 2)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Carry & Devengado — backend-computed */}
        <div style={{ padding: 12, border: '2px solid #17a2b8', borderRadius: 8, marginBottom: 16, background: '#e8f8fb' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#17a2b8', marginBottom: 8 }}>Carry &amp; Devengado</div>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 10, color: '#6c757d' }}>Dias Abierto</div>
              <div style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 700 }}>{row.days_open ?? 0}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#6c757d' }}>Carry Diario COP</div>
              <div style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 700, color: npvColor(row.carry_cop) }}>
                {fmtMM(row.carry_cop)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#6c757d' }}>Devengado Acumulado</div>
              <div style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 700, color: npvColor(row.carry_accrued_cop ?? 0) }}>
                {fmtMM(row.carry_accrued_cop ?? 0)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#6c757d' }}>Tasa IBR</div>
              <div style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 600 }}>{fmt(row.carry_rate_cop_pct, 4)}%</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#6c757d' }}>Tasa SOFR+Sprd</div>
              <div style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 600 }}>{fmt(row.carry_rate_usd_pct, 4)}%</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#6c757d' }}>Diferencial</div>
              <div style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 700, color: npvColor(row.carry_differential_bps) }}>
                {fmt(row.carry_differential_bps, 1)} bps
              </div>
            </div>
          </div>
        </div>

        {/* Trade details */}
        <Row>
          <Col md={6}>
            <table style={{ width: '100%' }}>
              <tbody>
                {detailRow('Nocional USD', fmtMM(row.notional_usd))}
                {detailRow('Nocional COP', fmtMM(row.notional_cop))}
                {detailRow('FX Pactacion', fmt(row.fx_initial, 2))}
                {detailRow('FX Spot', fmt(row.fx_spot, 2))}
                {detailRow('USD Spread', `${fmt(row.usd_spread_bps, 1)} bps`)}
                {detailRow('COP Spread', `${fmt(row.cop_spread_bps, 1)} bps`)}
              </tbody>
            </table>
          </Col>
          <Col md={6}>
            <table style={{ width: '100%' }}>
              <tbody>
                {detailRow('Pago', row.pay_usd ? 'SOFR (USD)' : 'IBR (COP)')}
                {detailRow('Amortizacion', row.amortization_type)}
                {detailRow('Frecuencia', row.payment_frequency)}
                {detailRow('Periodos', String(row.n_periods))}
                {detailRow('Inicio', row.start_date)}
                {detailRow('Vencimiento', row.maturity_date)}
                {detailRow('Interest PV USD', fmtMM(row.usd_leg_pv))}
                {detailRow('Interest PV COP', fmtMM(row.cop_leg_pv))}
              </tbody>
            </table>
          </Col>
        </Row>

        {/* Flujos de Caja & Carry — unified table, all fields from backend */}
        {row.cashflows && row.cashflows.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Flujos de Caja &amp; Carry</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                    {['#', 'Inicio', 'Fin', 'Dias', 'Rem%', 'Not USD', 'Rate USD %', 'Rate COP %', 'Diff bps', 'Int USD', 'Int COP', 'Neto COP', 'Diario COP', 'D.Dev', 'Devengado', ''].map((h) => (
                      <th key={h} style={{ padding: '4px 4px', fontWeight: 600, whiteSpace: 'nowrap', textAlign: 'right' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {row.cashflows.map((cf) => (
                    <tr
                      key={cf.period}
                      style={{
                        borderBottom: '1px solid #eee',
                        background: cf.status === 'current' ? '#d1ecf1' : cf.status === 'settled' ? '#f0fafb' : 'transparent',
                      }}
                    >
                      <td style={{ padding: '3px 4px', textAlign: 'right' }}>{cf.period}</td>
                      <td style={{ padding: '3px 4px' }}>{cf.start}</td>
                      <td style={{ padding: '3px 4px' }}>{cf.end}</td>
                      <td style={{ padding: '3px 4px', textAlign: 'right', fontFamily: 'monospace' }}>{cf.days_in_period}</td>
                      <td style={{ padding: '3px 4px', textAlign: 'right', fontFamily: 'monospace' }}>{fmt(cf.remaining_pct, 1)}%</td>
                      <td style={{ padding: '3px 4px', textAlign: 'right', fontFamily: 'monospace', color: '#6c757d' }}>{fmtMM(cf.notional_usd)}</td>
                      <td style={{ padding: '3px 4px', textAlign: 'right', fontFamily: 'monospace' }}>{fmt(cf.usd_rate * 100, 4)}</td>
                      <td style={{ padding: '3px 4px', textAlign: 'right', fontFamily: 'monospace' }}>{fmt(cf.cop_rate * 100, 4)}</td>
                      <td style={{ padding: '3px 4px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: npvColor(cf.diff_bps) }}>
                        {fmt(cf.diff_bps, 1)}
                      </td>
                      <td style={{ padding: '3px 4px', textAlign: 'right', fontFamily: 'monospace', color: '#6c757d' }}>{fmtMM(cf.usd_interest)}</td>
                      <td style={{ padding: '3px 4px', textAlign: 'right', fontFamily: 'monospace', color: '#6c757d' }}>{fmtMM(cf.cop_interest)}</td>
                      <td style={{ padding: '3px 4px', textAlign: 'right', fontFamily: 'monospace', color: npvColor(cf.net_cop) }}>{fmtMM(cf.net_cop)}</td>
                      <td style={{ padding: '3px 4px', textAlign: 'right', fontFamily: 'monospace', color: npvColor(cf.daily_carry_cop) }}>{fmtMM(cf.daily_carry_cop)}</td>
                      <td style={{ padding: '3px 4px', textAlign: 'right', fontFamily: 'monospace' }}>
                        {cf.days_elapsed > 0 ? cf.days_elapsed : '\u2014'}
                      </td>
                      <td style={{ padding: '3px 4px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: npvColor(cf.accrued_carry_cop) }}>
                        {cf.days_elapsed > 0 ? fmtMM(cf.accrued_carry_cop) : '\u2014'}
                      </td>
                      <td style={{ padding: '3px 4px', textAlign: 'center', fontSize: 10, color: cf.status === 'current' ? '#0c5460' : '#6c757d' }}>
                        {cf.status === 'current' ? 'HOY' : cf.status === 'settled' ? 'OK' : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <OperationalSection row={row} />
      </Modal.Body>
    </Modal>
  );
}

function NdfDetailModal({ row, show, onHide }: { row: PricedNdf | null; show: boolean; onHide: () => void }) {
  if (!row) return null;
  return (
    <Modal show={show} onHide={onHide} size="lg">
      <Modal.Header closeButton>
        <Modal.Title style={{ fontSize: 16 }}>{row.label} — {row.counterparty}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          {npvBox('NPV USD', row.npv_usd)}
          {npvBox('NPV COP', row.npv_cop)}
        </div>
        <Row>
          <Col md={6}>
            <table style={{ width: '100%' }}>
              <tbody>
                {detailRow('Forward Implicito', fmt(row.forward, 2))}
                {detailRow('Forward Points', fmt(row.forward_points, 2))}
                {detailRow('Strike', fmt(row.strike, 2))}
                {detailRow('Spot', fmt(row.spot, 2))}
                {detailRow('Direccion', row.direction === 'buy' ? 'Compra USD' : 'Venta USD')}
                {detailRow('Nocional USD', fmtMM(row.notional_usd))}
              </tbody>
            </table>
          </Col>
          <Col md={6}>
            <table style={{ width: '100%' }}>
              <tbody>
                {detailRow('DF USD', fmt(row.df_usd, 6))}
                {detailRow('DF COP', fmt(row.df_cop, 6))}
                {detailRow('Delta COP', fmtMM(row.delta_cop))}
                {detailRow('Dias al Vencimiento', String(row.days_to_maturity))}
                {detailRow('Vencimiento', row.maturity_date)}
              </tbody>
            </table>
          </Col>
        </Row>
        {/* Risk Metrics: DV01 & FX Exposure */}
        <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
          <div style={{ flex: 1, padding: 12, border: '2px solid #6f42c1', borderRadius: 8, background: '#f3eefa' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#6f42c1', marginBottom: 8 }}>DV01 (sensibilidad +1bp)</div>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 10, color: '#6c757d' }}>DV01 COP</div>
                <div style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 700, color: npvColor(row.dv01_cop) }}>
                  {fmtMM(row.dv01_cop)} COP
                </div>
                <div style={{ fontSize: 10, color: '#6c757d' }}>Si tasa COP sube 1bp</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#6c757d' }}>DV01 USD</div>
                <div style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 700, color: npvColor(row.dv01_usd) }}>
                  {fmtMM(row.dv01_usd)} COP
                </div>
                <div style={{ fontSize: 10, color: '#6c757d' }}>Si tasa USD sube 1bp</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#6c757d' }}>DV01 Total</div>
                <div style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 700, color: npvColor(row.dv01_total) }}>
                  {fmtMM(row.dv01_total)} COP
                </div>
              </div>
            </div>
          </div>
          <div style={{ flex: 1, padding: 12, border: '2px solid #fd7e14', borderRadius: 8, background: '#fff8f0' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fd7e14', marginBottom: 8 }}>FX Exposure</div>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 10, color: '#6c757d' }}>FX Delta</div>
                <div style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 700, color: npvColor(row.fx_delta) }}>
                  {fmtMM(row.fx_delta)} COP
                </div>
                <div style={{ fontSize: 10, color: '#6c757d' }}>Cambio en NPV por +$1 en USDCOP</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#6c757d' }}>Exposicion USD</div>
                <div style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 700 }}>
                  {fmtMM(row.fx_exposure_usd)} USD
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#6c757d' }}>Delta COP (notional)</div>
                <div style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 600 }}>
                  {fmtMM(row.delta_cop)}
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* Carry / Theta */}
        <div style={{ padding: 12, border: '2px solid #17a2b8', borderRadius: 8, marginTop: 16, background: '#e8f8fb' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#17a2b8', marginBottom: 8 }}>Carry / Theta Diario</div>
          <div style={{ display: 'flex', gap: 24 }}>
            <div>
              <div style={{ fontSize: 10, color: '#6c757d' }}>Carry COP / dia</div>
              <div style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 700, color: npvColor(row.carry_cop_daily) }}>
                {fmtMM(row.carry_cop_daily)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#6c757d' }}>Carry USD / dia</div>
              <div style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 600 }}>{fmtMM(row.carry_usd_daily)}</div>
            </div>
          </div>
          <div style={{ fontSize: 10, color: '#6c757d', marginTop: 6 }}>
            Theta = decaimiento diario del NPV. Negativo si la posicion pierde valor cada dia.
          </div>
        </div>
        <OperationalSection row={row} />
      </Modal.Body>
    </Modal>
  );
}

// Generate projected cashflows for IBR swap detail
function generateIbrCashflows(row: PricedIbrSwap) {
  const freqMonths: Record<string, number> = { '1M': 1, '3M': 3, '6M': 6, '12M': 12 };
  const floatingRate = row.fair_rate; // proxy for floating leg
  const maturity = new Date(row.maturity_date + 'T00:00:00');
  const result = [];

  if (row.payment_frequency === 'Bullet') {
    const start = new Date(row.start_date + 'T00:00:00');
    const days = Math.round((maturity.getTime() - start.getTime()) / 86400000);
    const fixedAmt = row.notional * row.fixed_rate * days / 365;
    const floatAmt = row.notional * floatingRate * days / 365;
    const net = row.pay_fixed ? floatAmt - fixedAmt : fixedAmt - floatAmt;
    result.push({
      period: 1, start: row.start_date, end: row.maturity_date,
      payment_date: row.maturity_date, days, fixed_rate: row.fixed_rate,
      floating_rate: floatingRate, fixed_amount: fixedAmt,
      floating_amount: floatAmt, net_amount: net, df: 1.0, pv: net,
    });
    return result;
  }

  const months = freqMonths[row.payment_frequency] || 3;
  let periodStart = new Date(row.start_date + 'T00:00:00');
  let period = 1;

  while (periodStart < maturity && period <= 120) {
    const rawEnd = new Date(periodStart);
    rawEnd.setMonth(rawEnd.getMonth() + months);
    const periodEnd = rawEnd > maturity ? maturity : rawEnd;
    const days = Math.round((periodEnd.getTime() - periodStart.getTime()) / 86400000);
    const fixedAmt = row.notional * row.fixed_rate * days / 365;
    const floatAmt = row.notional * floatingRate * days / 365;
    const net = row.pay_fixed ? floatAmt - fixedAmt : fixedAmt - floatAmt;
    result.push({
      period,
      start: periodStart.toISOString().slice(0, 10),
      end: periodEnd.toISOString().slice(0, 10),
      payment_date: periodEnd.toISOString().slice(0, 10),
      days, fixed_rate: row.fixed_rate, floating_rate: floatingRate,
      fixed_amount: fixedAmt, floating_amount: floatAmt,
      net_amount: net, df: 1.0, pv: net,
    });
    periodStart = new Date(periodEnd);
    period += 1;
  }
  return result;
}


function IbrSwapDetailModal({ row, show, onHide }: { row: PricedIbrSwap | null; show: boolean; onHide: () => void }) {
  if (!row) return null;
  const cashflows = row.cashflows ?? (row.error ? [] : generateIbrCashflows(row));
  const totalNet = cashflows.reduce((s, c) => s + c.net_amount, 0);
  const today = new Date();

  return (
    <Modal show={show} onHide={onHide} size="xl">
      <Modal.Header closeButton>
        <Modal.Title style={{ fontSize: 16 }}>{row.label} — {row.counterparty}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          {npvBox('NPV COP', row.npv)}
          <div style={{ flex: 1, padding: '12px 16px', borderRadius: 8, textAlign: 'center', background: '#cce5ff' }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', color: '#004085' }}>Fair Rate</div>
            <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'monospace', color: '#004085' }}>
              {fmt(row.fair_rate * 100, 2)}%
            </div>
          </div>
        </div>
        <Row>
          <Col md={6}>
            <table style={{ width: '100%' }}>
              <tbody>
                {detailRow('Tasa Fija', `${fmt(row.fixed_rate * 100, 2)}%`)}
                {detailRow('Fair Rate', `${fmt(row.fair_rate * 100, 2)}%`)}
                {detailRow('Spread vs Par', `${fmt((row.fixed_rate - row.fair_rate) * 10000, 1)} bps`)}
                {detailRow('DV01', fmtMM(row.dv01))}
                {detailRow('Nocional COP', fmtMM(row.notional))}
              </tbody>
            </table>
          </Col>
          <Col md={6}>
            <table style={{ width: '100%' }}>
              <tbody>
                {detailRow('Fixed Leg NPV', fmtMM(row.fixed_leg_npv))}
                {detailRow('Floating Leg NPV', fmtMM(row.floating_leg_npv))}
                {detailRow('Pago', row.pay_fixed ? 'Fija' : 'IBR')}
                {detailRow('Frecuencia', row.payment_frequency)}
                {detailRow('Inicio', row.start_date)}
                {detailRow('Vencimiento', row.maturity_date)}
              </tbody>
            </table>
          </Col>
        </Row>
        {/* Carry Diario */}
        <div style={{ padding: 12, border: '2px solid #17a2b8', borderRadius: 8, marginTop: 16, background: '#e8f8fb' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#17a2b8', marginBottom: 8 }}>Carry Diario (IBR Overnight)</div>
          <div style={{ display: 'flex', gap: 24 }}>
            <div>
              <div style={{ fontSize: 10, color: '#6c757d' }}>Carry COP / dia</div>
              <div style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 700, color: npvColor(row.carry_daily_cop) }}>
                {fmtMM(row.carry_daily_cop)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#6c757d' }}>IBR Overnight</div>
              <div style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 600 }}>{fmt(row.ibr_overnight_pct, 4)}%</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#6c757d' }}>Tasa Fija</div>
              <div style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 600 }}>{fmt(row.fixed_rate * 100, 4)}%</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#6c757d' }}>Diferencial</div>
              <div style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 700, color: npvColor(row.carry_daily_diff_bps) }}>
                {fmt(row.carry_daily_diff_bps, 1)} bps
              </div>
            </div>
          </div>
        </div>
        {/* Carry Periodo */}
        <div style={{ padding: 12, border: '1px solid #dee2e6', borderRadius: 8, marginTop: 8, background: '#f8f9fa' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#6c757d', marginBottom: 6 }}>Carry Periodo (Forward implícito)</div>
          <div style={{ display: 'flex', gap: 24 }}>
            <div>
              <div style={{ fontSize: 10, color: '#6c757d' }}>Carry Periodo COP</div>
              <div style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 600, color: npvColor(row.carry_period_cop) }}>
                {fmtMM(row.carry_period_cop)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#6c757d' }}>IBR Fwd Periodo</div>
              <div style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 600 }}>{fmt(row.ibr_fwd_period_pct, 4)}%</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#6c757d' }}>Diff Periodo</div>
              <div style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 600, color: npvColor(row.carry_period_diff_bps) }}>
                {fmt(row.carry_period_diff_bps, 1)} bps
              </div>
            </div>
          </div>
        </div>

        {/* Cashflows por periodo */}
        {cashflows.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#495057' }}>Cashflows por Periodo</div>
              <span style={{ fontSize: 12, color: '#6c757d' }}>
                Total neto: <strong style={{ fontFamily: 'monospace', color: npvColor(totalNet) }}>{fmtMM(totalNet)} COP</strong>
                {!row.cashflows && <span style={{ fontSize: 10, color: '#ffc107', marginLeft: 6 }}>* estimado</span>}
              </span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #dee2e6', background: '#f8f9fa' }}>
                    {['#', 'Inicio', 'Fin', 'Días', 'Tasa Fija', 'IBR Fwd', 'Pago Fijo', 'Pago Flotante', 'Neto COP'].map((h) => (
                      <th key={h} style={{ padding: '5px 8px', textAlign: h === '#' || h === 'Días' ? 'center' : 'right', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cashflows.map((cf) => {
                    const isPast = new Date(cf.end) < today;
                    const isCurrent = new Date(cf.start) <= today && new Date(cf.end) >= today;
                    return (
                      <tr
                        key={cf.period}
                        style={{
                          borderBottom: '1px solid #f0f0f0',
                          background: isCurrent ? '#fffde7' : isPast ? '#fafafa' : 'transparent',
                        }}
                      >
                        <td style={{ padding: '3px 8px', textAlign: 'center', color: '#6c757d' }}>{cf.period}</td>
                        <td style={{ padding: '3px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{cf.start}</td>
                        <td style={{ padding: '3px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{cf.end}</td>
                        <td style={{ padding: '3px 8px', textAlign: 'center', color: '#6c757d' }}>{cf.days}</td>
                        <td style={{ padding: '3px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{(cf.fixed_rate * 100).toFixed(4)}%</td>
                        <td style={{ padding: '3px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{(cf.floating_rate * 100).toFixed(4)}%</td>
                        <td style={{ padding: '3px 8px', textAlign: 'right', fontFamily: 'monospace', color: '#dc3545' }}>
                          ({fmtMM(cf.fixed_amount)})
                        </td>
                        <td style={{ padding: '3px 8px', textAlign: 'right', fontFamily: 'monospace', color: '#28a745' }}>
                          {fmtMM(cf.floating_amount)}
                        </td>
                        <td style={{ padding: '3px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: npvColor(cf.net_amount) }}>
                          {fmtMM(cf.net_amount)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '2px solid #dee2e6', background: '#f8f9fa' }}>
                    <td colSpan={8} style={{ padding: '5px 8px', fontWeight: 600, textAlign: 'right', fontSize: 12 }}>Total</td>
                    <td style={{ padding: '5px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: npvColor(totalNet) }}>
                      {fmtMM(totalNet)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        <OperationalSection row={row} />
      </Modal.Body>
    </Modal>
  );
}

// ── Curves Panel (IBR + SOFR side by side) ──
const TENOR_TO_MONTHS: Record<string, number> = {
  '1d': 1 / 30, '1m': 1, '3m': 3, '6m': 6, '9m': 9, '12m': 12,
  '2y': 24, '3y': 36, '5y': 60, '7y': 84, '10y': 120, '15y': 180, '20y': 240,
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function CurvesPanel({ status }: { status: CurveStatus | null }) {
  if (!status || (!status.ibr.built && !status.sofr.built)) {
    return (
      <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', border: '1px dashed #dee2e6', borderRadius: 8 }}>
        Primero construya las curvas
      </div>
    );
  }

  const ibrNodes = status.ibr.nodes || {};
  const sofrNodes = status.sofr.nodes || {};

  const ibrEntries = Object.entries(ibrNodes).sort((a, b) => {
    const aK = a[0].replace('ibr_', '').toLowerCase();
    const bK = b[0].replace('ibr_', '').toLowerCase();
    return (TENOR_TO_MONTHS[aK] ?? 999) - (TENOR_TO_MONTHS[bK] ?? 999);
  });
  const sofrEntries = Object.entries(sofrNodes).sort((a, b) => Number(a[0]) - Number(b[0]));

  const ibrChart = ibrEntries.map(([k, v]) => {
    const t = k.replace('ibr_', '').toLowerCase();
    return { months: TENOR_TO_MONTHS[t] ?? 0, tenor: t.toUpperCase(), rate: v };
  });
  const sofrChart = sofrEntries.map(([k, v]) => ({
    months: Number(k),
    tenor: Number(k) >= 12 ? `${Number(k) / 12}Y` : `${k}M`,
    rate: v,
  }));

  return (
    <Row>
      <Col md={6}>
        <div style={{ background: '#fff', border: '1px solid #dee2e6', borderRadius: 8, padding: 16 }}>
          <h6 style={{ marginBottom: 12, color: '#1f77b4' }}>Curva IBR ({ibrEntries.length} nodos)</h6>
          {ibrChart.length > 0 && (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={ibrChart}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" dataKey="months" ticks={ibrChart.map((d) => d.months)} tickFormatter={(m: number) => ibrChart.find((d) => d.months === m)?.tenor || ''} tick={{ fontSize: 10 }} />
                <YAxis domain={['auto', 'auto']} tickFormatter={(v: number) => `${v.toFixed(1)}%`} tick={{ fontSize: 10 }} />
                <Tooltip labelFormatter={(m: number) => ibrChart.find((d) => d.months === m)?.tenor || ''} formatter={(v: number) => `${v.toFixed(4)}%`} />
                <Line type="monotone" dataKey="rate" stroke="#1f77b4" strokeWidth={2} dot={{ r: 3 }} name="IBR %" />
              </LineChart>
            </ResponsiveContainer>
          )}
          <div style={{ overflowX: 'auto', maxHeight: 250, marginTop: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead><tr style={{ borderBottom: '2px solid #dee2e6' }}><th style={{ padding: '4px 8px', textAlign: 'left' }}>Tenor</th><th style={{ padding: '4px 8px', textAlign: 'right' }}>Tasa (%)</th></tr></thead>
              <tbody>
                {ibrEntries.map(([k, v]) => (
                  <tr key={k} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '3px 8px', fontWeight: 600 }}>{k.replace('ibr_', '').toUpperCase()}</td>
                    <td style={{ padding: '3px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{v.toFixed(4)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Col>
      <Col md={6}>
        <div style={{ background: '#fff', border: '1px solid #dee2e6', borderRadius: 8, padding: 16 }}>
          <h6 style={{ marginBottom: 12, color: '#ff7f0e' }}>Curva SOFR ({sofrEntries.length} nodos)</h6>
          {sofrChart.length > 0 && (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={sofrChart}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" dataKey="months" ticks={sofrChart.map((d) => d.months)} tickFormatter={(m: number) => sofrChart.find((d) => d.months === m)?.tenor || ''} tick={{ fontSize: 10 }} />
                <YAxis domain={['auto', 'auto']} tickFormatter={(v: number) => `${v.toFixed(1)}%`} tick={{ fontSize: 10 }} />
                <Tooltip labelFormatter={(m: number) => sofrChart.find((d) => d.months === m)?.tenor || ''} formatter={(v: number) => `${v.toFixed(4)}%`} />
                <Line type="monotone" dataKey="rate" stroke="#ff7f0e" strokeWidth={2} dot={{ r: 3 }} name="SOFR %" />
              </LineChart>
            </ResponsiveContainer>
          )}
          <div style={{ overflowX: 'auto', maxHeight: 250, marginTop: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead><tr style={{ borderBottom: '2px solid #dee2e6' }}><th style={{ padding: '4px 8px', textAlign: 'left' }}>Tenor</th><th style={{ padding: '4px 8px', textAlign: 'right' }}>Tasa (%)</th></tr></thead>
              <tbody>
                {sofrEntries.map(([k, v]) => (
                  <tr key={k} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '3px 8px', fontWeight: 600 }}>{Number(k) >= 12 ? `${Number(k) / 12}Y` : `${k}M`}</td>
                    <td style={{ padding: '3px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{v.toFixed(4)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Col>
    </Row>
  );
}

// ── Main Page ──

function PortfolioPage() {
  const [loading, setLoading] = useState(false);
  const [markRepricing, setMarkRepricing] = useState(false);
  // markFecha esta declarado mas abajo (cerca de liquidations) ahora que
  // liquidationsAsOf depende de el. Fecha global del modulo de Riesgos:
  // el blotter OTC se anclla 100% a ella, sin override local (mismo
  // comportamiento que Resumen y Exposicion). Cambia via selector global
  // de CoreLayout (toggle Mes/Dia).
  const [curveStatus, setCurveStatus] = useState<CurveStatus | null>(null);
  const [addType, setAddType] = useState<string | null>(null); // 'xccy' | 'ndf' | 'ibr' | null
  // (#313 removed repriceTrigger — useRepricePortfolio's key includes position
  //  IDs, so adding/removing a position triggers refetch automatically.)
  const { prefs: blotterPrefs, setPrefs: setBlotterPrefs } = useBlotterPreferences();
  const [selectedXccy, setSelectedXccy] = useState<PricedXccy | null>(null);
  const [selectedNdf, setSelectedNdf] = useState<PricedNdf | null>(null);
  const [selectedIbrSwap, setSelectedIbrSwap] = useState<PricedIbrSwap | null>(null);
  // viewTab eliminado (mayo 2026): el tab Marcas se movio al sidebar como /marks.
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [settlementMap, setSettlementMap] = useState<Record<string, NdfSettlementResult | 'error'>>({});

  const {
    tradingError,
    loadUserRole,
    userRole,
    marketDataConfig,
    loadMarketDataConfig,
    updateMarketDataConfig,
    activeCompanyId,
    selectedCompanyId,
  } = useAppStore();
  // Derive canEdit reactively from userProfile so it stays correct even when
  // loadUserProfile resolves after loadUserRole. The store flag goes stale
  // across that race; userProfile is the canonical source.
  const userProfile = useAppStore((s) => s.userProfile);
  const canEdit =
    userProfile?.role === 'super_admin' ||
    userProfile?.role === 'corp_admin' ||
    userProfile?.role === 'gestor' ||
    userRole.role === 'admin' ||
    userRole.role === 'manager';
  // canLiquidate = mismos roles que acepta xerenity.liquidate_ndf_position.
  // No incluye 'admin'/'manager' legacy: la RPC los rechaza con permission
  // denied, mejor no mostrar el boton.
  const canLiquidate =
    userProfile?.role === 'super_admin' ||
    userProfile?.role === 'corp_admin' ||
    userProfile?.role === 'gestor';

  // Estado del modal de liquidacion + cache de liquidaciones para el card.
  const [liquidateRow, setLiquidateRow] = useState<PortfolioRow | null>(null);
  const [showLiquidate, setShowLiquidate] = useState(false);
  const [liquidations, setLiquidations] = useState<NdfLiquidationRow[]>([]);
  const [liquidationsLoading, setLiquidationsLoading] = useState(false);

  // markFecha = global evaluation date desde el CoreLayout selector. Single
  // source of truth para TODA la pagina (incluye reprice, refPrices,
  // liquidations as-of, banderita historica).
  const markFecha = useAppStore((s) => s.globalEvaluationDate);

  // Liquidaciones "as-of" la fecha seleccionada: solo las que ya habian
  // ocurrido al markFecha. Para el SummaryBar y el tab Liquidado del blotter,
  // asi la vista historica es coherente.
  const liquidationsAsOf = useMemo(
    () => liquidations.filter((l) => l.liquidation_date <= markFecha),
    [liquidations, markFecha],
  );

  // Total P&G realizado bruto en COP HASTA markFecha. null mientras carga.
  // Suma DOS componentes:
  //   1. Liquidaciones manuales (NDFs liquidados via boton Liquidar).
  //   2. Settlements automaticos (NDFs vencidos al maturity_date, P&L via
  //      BanRep TRM). Se calculan en el useEffect de settlementMap mas
  //      abajo y se filtran via sumSettlementsAsOf (skip si tiene
  //      liquidacion manual para no doble-contar).
  // realizedPnlTotalCop se calcula MAS ABAJO (despues de declarar ndfPositions
  // y settlementMap) para evitar TDZ en SSR. Linea ~2080.

  // Vista historica = markFecha < hoy. Util para mostrar la banderita
  // informativa y para que el usuario entienda por que los numeros difieren.
  const todayIso = new Date().toISOString().slice(0, 10);
  const isHistoricalView = !!markFecha && markFecha < todayIso;

  // Anti cross-tenant: `activeCompanyId` es FUNCION del Zustand store —
  // su referencia es estatica y NO cambia cuando el user cambia de
  // empresa. Usabamos esa funcion en el dep array y como resultado las
  // liquidaciones de la empresa anterior se quedaban cacheadas al
  // cambiar de Super -> Los Coches (visible como $651M de P&G MTD COP
  // en Los Coches, que era exactamente el total de Super).
  //
  // Fix: dependemos del VALOR `selectedCompanyId` (subscrito reactivamente
  // a Zustand) y del fallback `userProfile?.company_id`. Cuando cualquiera
  // de los dos cambia, refire la carga.
  const userProfileCompanyId = userProfile?.company_id;
  const reloadLiquidations = useCallback(async () => {
    setLiquidationsLoading(true);
    try {
      // Pasamos activeCompanyId() para que super_admin con company picker
      // solo vea las liquidaciones de la empresa seleccionada (anti
      // cross-tenant leak). corp_admin/gestor/lector son filtrados server-
      // side independientemente del parametro.
      const r = await fetchNdfLiquidations(activeCompanyId());
      if (r.error) {
        // No comer el error en silencio: una RPC rota deja el state vacio
        // y la tabla aparece "sin liquidaciones" sin pistas.
        console.error('[liquidations] fetch error:', r.error);
        toast.error(`Error cargando liquidaciones: ${r.error}`, { autoClose: 5000 });
      } else {
        setLiquidations(r.data);
      }
    } finally {
      setLiquidationsLoading(false);
    }
  // activeCompanyId() lee del store al momento de llamarse. Lo que dispara
  // recargas es el cambio de selectedCompanyId / userProfileCompanyId.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCompanyId, userProfileCompanyId]);

  // Carga inicial + cuando cambia la empresa activa (super_admin picker
  // o login de otro usuario).
  useEffect(() => {
    // Eager reset: limpiamos liquidations del state ANTES de fetch para que
    // datos de la empresa anterior no se muestren mientras carga la nueva.
    setLiquidations([]);
    reloadLiquidations();
  }, [reloadLiquidations]);

  const handleOpenLiquidate = useCallback((row: PortfolioRow) => {
    setLiquidateRow(row);
    setShowLiquidate(true);
  }, []);

  // #317 — Position lists now come from TanStack Query. Their cache key
  // includes companyId so switching companies invalidates correctly. The
  // store fields `xccyPositions/ndfPositions/ibrSwapPositions` are still
  // there for risk-resumen (uses `loadPositions` imperatively); they will
  // be removed in #318 cleanup.
  const companyId = activeCompanyId();
  const xccyPositionsQuery = useXccyPositions(companyId);
  const ndfPositionsQuery = useNdfPositions(companyId);
  const ibrSwapPositionsQuery = useIbrSwapPositions(companyId);
  const xccyPositions = xccyPositionsQuery.data ?? [];
  const ndfPositions = ndfPositionsQuery.data ?? [];
  const ibrSwapPositions = ibrSwapPositionsQuery.data ?? [];

  // XCCY settlements: cashflows trimestrales liquidados (carry + FX).
  // Persistido en trading.xccy_settlement. El hook dispara el calculo
  // idempotente y lee la tabla. `allLoaded` se usa para gatear las
  // sumas de P&G Realizado (anti-flicker).
  const xccySettle = useXccySettlements(xccyPositions, companyId);

  // XCCY settlements "as-of" markFecha: solo los cashflows cuyo payment
  // ya ocurrio. Usado por el tab Liquidado del blotter (consistente con
  // liquidationsAsOf). El sumar al SummaryBar usa el filtro por rango
  // [start, markFecha] aparte — sin doble suma.
  const xccySettlementsAsOf = useMemo(
    () => xccySettle.rows.filter((r) => r.payment_date <= markFecha),
    [xccySettle.rows, markFecha],
  );

  // P&G Realizado en COP separado por horizonte:
  //   - MTD: del 1er dia del mes de markFecha hasta markFecha (inclusive).
  //   - YTD: del 1ro de enero del ano de markFecha hasta markFecha.
  // Cada uno suma: liquidaciones manuales + settlements de vencidos NDF
  // (cuyo maturity_date cae en el rango) + cashflows XCCY liquidados
  // (cuyo payment_date cae en el rango). Skip si vencido tiene
  // liquidacion manual (no doble conteo).
  // null mientras estan cargando datos (anti-flicker).
  const realizedPnlMtdCop = useMemo<number | null>(() => {
    if (liquidationsLoading) return null;
    if (!xccySettle.allLoaded) return null;
    const monthStart = `${markFecha.slice(0, 7)}-01`;
    const liqCop = sumLiquidationsBetween(liquidationsAsOf, monthStart, markFecha).cop;
    const settlementsCop = sumSettlementsBetween(
      ndfPositions,
      settlementMap,
      liquidationsAsOf,
      monthStart,
      markFecha,
    ).cop;
    const xccyCop = sumXccySettlementsBetween(
      xccySettle.rows,
      monthStart,
      markFecha,
    ).cop;
    return liqCop + settlementsCop + xccyCop;
  }, [
    liquidationsAsOf,
    liquidationsLoading,
    markFecha,
    ndfPositions,
    settlementMap,
    xccySettle.allLoaded,
    xccySettle.rows,
  ]);

  const realizedPnlYtdCop = useMemo<number | null>(() => {
    if (liquidationsLoading) return null;
    if (!xccySettle.allLoaded) return null;
    const yearStart = `${markFecha.slice(0, 4)}-01-01`;
    const liqCop = sumLiquidationsBetween(liquidationsAsOf, yearStart, markFecha).cop;
    const settlementsCop = sumSettlementsBetween(
      ndfPositions,
      settlementMap,
      liquidationsAsOf,
      yearStart,
      markFecha,
    ).cop;
    const xccyCop = sumXccySettlementsBetween(
      xccySettle.rows,
      yearStart,
      markFecha,
    ).cop;
    return liqCop + settlementsCop + xccyCop;
  }, [
    liquidationsAsOf,
    liquidationsLoading,
    markFecha,
    ndfPositions,
    settlementMap,
    xccySettle.allLoaded,
    xccySettle.rows,
  ]);

  // #317 — Mutations replace the store CRUD actions. `onSuccess` invalidates
  // the corresponding list query → list refetches → `useRepricePortfolio`
  // sees a different ID set → reprice fires automatically.
  const addXccyMutation = useAddXccyPosition();
  const addNdfMutation = useAddNdfPosition();
  const addIbrSwapMutation = useAddIbrSwapPosition();
  const removeXccyMutation = useRemoveXccyPositions();
  const removeNdfMutation = useRemoveNdfPositions();
  const removeIbrSwapMutation = useRemoveIbrSwapPositions();

  // Track when the user explicitly requested a reprice via the toolbar button
  // — used to surface a toast when the next query lands. Without it, every
  // automatic refetch (e.g. when a position is added) would also pop a toast.
  const reprintRequestedRef = useRef(false);
  const queryClient = useQueryClient();

  const handleBuild = useCallback(async (silent = false) => {
    setLoading(true);
    try {
      const result = await buildCurves();
      setCurveStatus(result.full_status);
      if (!silent) toast.success('Curvas actualizadas');
    } catch (e) {
      if (!silent) toast.error(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // #313 — `useRepricePortfolio` replaces the old `repriceAllWithMark` action.
  // The query key includes `markFecha` and the sorted position IDs, so any
  // change (date pick, add/remove position) triggers a fresh query and aborts
  // the previous in-flight one automatically.
  const reprice = useRepricePortfolio({
    xccy: xccyPositions,
    ndf: ndfPositions,
    ibr: ibrSwapPositions,
    valuationDate: markFecha,
    // Pasamos liquidations para que el hook reconstruya notional_usd
    // historicamente cuando markFecha < liquidation_date.
    liquidations,
    enabled: !!(curveStatus?.ibr.built && curveStatus?.sofr.built),
  });
  const pricedXccy = reprice.data?.xccy_results ?? [];
  const pricedNdf = reprice.data?.ndf_results ?? [];
  const pricedIbrSwap = reprice.data?.ibr_swap_results ?? [];
  const summary = reprice.data?.summary ?? null;
  const tradingLoading = reprice.isFetching;
  const pricedAt = reprice.dataUpdatedAt
    ? new Date(reprice.dataUpdatedAt).toLocaleTimeString('es-CO', {
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      })
    : undefined;

  // #314 — Reference prices (daily/MTD/YTD snapshots) for P&L derivation.
  // The hook auto-fans into 3 sub-queries with own cache keys; aborts stale
  // ones when fechaMarca or position list changes.
  const { refPrices } = useReferencePrices({
    xccy: xccyPositions,
    ndf: ndfPositions,
    ibr: ibrSwapPositions,
    fechaMarca: markFecha,
    // Mismo motivo: cada periodo (daily/MTD/YTD) reconstruye contra su
    // fecha especifica para que los P&L derivados sean consistentes as-of.
    liquidations,
    enabled: !!(curveStatus?.ibr.built && curveStatus?.sofr.built),
  });

  // Toast only when the user explicitly hit "Repricear" — automatic refetches
  // (date change, position added) should be silent. The dual-toast bug from
  // the legacy code path was caused by aborted reprices firing toast.success.
  // With useQuery, `dataUpdatedAt` only advances when the *current* query
  // resolved successfully — aborted queries never touch this clock.
  useEffect(() => {
    if (!reprintRequestedRef.current) return;
    if (reprice.isFetching) return;
    if (reprice.isSuccess) {
      toast.success(`Portafolio valorado con marca ${markFecha}`);
      reprintRequestedRef.current = false;
    } else if (reprice.isError) {
      const msg = reprice.error instanceof Error ? reprice.error.message : String(reprice.error);
      toast.error(`Error al valorar: ${msg}`);
      reprintRequestedRef.current = false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reprice.isFetching, reprice.isSuccess, reprice.isError, reprice.dataUpdatedAt]);

  // (#314 removed the explicit loadReferencePrices background effect —
  //  useReferencePrices reacts natively to fechaMarca + position changes.)

  const handleReprice = useCallback(() => {
    reprintRequestedRef.current = true;
    setMarkRepricing(true);
    queryClient
      .invalidateQueries({ queryKey: ['pricing', 'reprice'] })
      .finally(() => setMarkRepricing(false));
  }, [queryClient]);

  // Auto-load on mount: init curves + load positions + role + market data config
  useEffect(() => {
    const initCurves = async () => {
      try {
        const status = await getCurveStatus();
        if (status.ibr.built && status.sofr.built) {
          setCurveStatus(status);
        } else {
          await handleBuild(true); // auto-build silently
        }
      } catch {
        await handleBuild(true);
      }
    };
    initCurves();
    // Positions are now fetched by useXccy/Ndf/IbrSwapPositions hooks
    // (#317). They auto-fetch on mount; no manual loadPositions needed here.
    loadUserRole();
    loadMarketDataConfig();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleBuild, loadUserRole, loadMarketDataConfig, selectedCompanyId]);


  // NOTE: anteriormente habia un useEffect que sincronizaba markFecha al
  // valuation_date que retornaba el backend (curveStatus). Esto creaba un
  // tug-of-war con el selector global: el usuario cambiaba la fecha, el
  // backend snapeaba a un dia habil, y este useEffect clobbereaba el valor
  // local. Removido. Ahora `markFecha` solo cambia via:
  //   1. globalEvaluationDate (selector global del CoreLayout)
  //   2. Override manual en la MarkDateBar (input/◀/▶)
  // Si el backend snapea, se muestra `curveStatus.valuation_date` por
  // separado pero NO se reescribe `markFecha`.

  // Auto-reprice when positions loaded and curves are ready
  const curvesReady =
    curveStatus?.ibr.built && curveStatus?.sofr.built;

  // (#313 removed the manual reprice trigger useEffect — useRepricePortfolio
  //  reacts automatically to curveStatus, markFecha and position changes via
  //  its query key. The repriceTrigger counter from #295 is also obsolete.)

  const handleDelete = useCallback(
    (id: string, type: string) => {
      if (type === 'XCCY') removeXccyMutation.mutate([id]);
      else if (type === 'NDF') removeNdfMutation.mutate([id]);
      else if (type === 'IBR') removeIbrSwapMutation.mutate([id]);
      toast.info('Posicion eliminada');
    },
    [removeXccyMutation, removeNdfMutation, removeIbrSwapMutation]
  );

  const onSelectXccy = useCallback((pos: PricedXccy) => {
    setSelectedXccy(pos);
  }, []);

  const onSelectNdf = useCallback((pos: PricedNdf) => {
    setSelectedNdf(pos);
  }, []);

  const onSelectIbr = useCallback((pos: PricedIbrSwap) => {
    setSelectedIbrSwap(pos);
  }, []);

  const isLoading = tradingLoading || loading;

  // Fetch settlement P&L for expired NDFs
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    const expiredNdfs = ndfPositions.filter((p) => p.maturity_date < today);
    if (expiredNdfs.length === 0) return;

    expiredNdfs.forEach((p) => {
      if (settlementMap[p.id] !== undefined) return; // already fetched
      getNdfSettlement({
        notional_usd: p.notional_usd,
        strike: p.strike,
        maturity_date: p.maturity_date,
        direction: p.direction as 'buy' | 'sell',
      })
        .then((result) => {
          setSettlementMap((prev) => ({ ...prev, [p.id]: result }));
        })
        .catch((err) => {
          // eslint-disable-next-line no-console
          console.warn(`[settlement] NDF ${p.id} (${p.maturity_date}):`, err?.message ?? err);
          setSettlementMap((prev) => ({ ...prev, [p.id]: 'error' }));
        });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ndfPositions]);

  // Build unified portfolio rows
  const xccyRows: PricedXccy[] = pricedXccy.length > 0
    ? pricedXccy
    : xccyPositions.map((p) => ({ ...p, npv_cop: 0, npv_usd: 0, pnl_rate_cop: 0, pnl_rate_usd: 0, pnl_fx_cop: 0, pnl_fx_usd: 0, usd_leg_pv: 0, cop_leg_pv: 0, usd_principal_pv: 0, cop_principal_pv: 0, carry_cop: 0, carry_usd: 0, carry_rate_cop_pct: 0, carry_rate_usd_pct: 0, carry_differential_bps: 0, dv01_ibr: 0, dv01_sofr: 0, dv01_total: 0, fx_delta: 0, fx_exposure_usd: 0, par_basis_bps: null, notional_cop: p.notional_usd * p.fx_initial, fx_spot: 0, n_periods: 0, cashflows: [], error: 'Pendiente de valoración' } as PricedXccy));
  const ndfRows: PricedNdf[] = pricedNdf.length > 0
    ? pricedNdf
    : ndfPositions.map((p) => ({ ...p, npv_usd: 0, npv_cop: 0, forward: 0, forward_points: 0, carry_cop_daily: 0, carry_usd_daily: 0, days_to_maturity: 0, df_usd: 0, df_cop: 0, delta_cop: 0, dv01_cop: 0, dv01_usd: 0, dv01_total: 0, fx_delta: 0, fx_exposure_usd: 0, spot: 0, error: 'Pendiente de valoración' } as PricedNdf));
  const ibrRows: PricedIbrSwap[] = pricedIbrSwap.length > 0
    ? pricedIbrSwap
    : ibrSwapPositions.map((p) => ({ ...p, npv: 0, fair_rate: 0, dv01: 0, fixed_leg_npv: 0, floating_leg_npv: 0, ibr_overnight_pct: 0, carry_daily_cop: 0, carry_daily_diff_bps: 0, ibr_fwd_period_pct: 0, carry_period_cop: 0, carry_period_diff_bps: 0, error: 'Pendiente de valoración' } as PricedIbrSwap));

  const portfolioRows = buildPortfolioRows(xccyRows, ndfRows, ibrRows, settlementMap, refPrices, markFecha);

  // Totales de P&L para la SummaryBar
  const pnlTotals = (() => {
    const valid = portfolioRows.filter((r) => !r.error);
    const sumCol = (key: keyof typeof portfolioRows[0]): number | null => {
      const vals = valid
        .map((r) => r[key] as number | null)
        .filter((v): v is number => v !== null);
      return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) : null;
    };
    return {
      daily: sumCol('pnl_1d_cop'),
      mtd:   sumCol('pnl_mtd_cop'),
      ytd:   sumCol('pnl_ytd_cop'),
    };
  })();

  return (
    <CoreLayout>
      <Container fluid className="px-4">
        {/* Header */}
        <Row>
          <div className="d-flex align-items-center justify-content-between py-1">
            <PageTitle>
              <Icon icon={faBriefcase} size="1x" />
              <h4>{PAGE_TITLE}</h4>
              {userRole.company_name && (
                <span style={{ fontSize: 12, color: '#6c757d', marginLeft: 8 }}>
                  {userRole.company_name}
                  <span style={{
                    marginLeft: 6, padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600,
                    background: userRole.role === 'admin' ? '#198754' : userRole.role === 'manager' ? '#0d6efd' : '#6c757d',
                    color: '#fff',
                  }}>
                    {userRole.role}
                  </span>
                </span>
              )}
            </PageTitle>
            <div className="d-flex align-items-center gap-2">
              <Button
                variant="outline-primary"
                onClick={handleReprice}
                disabled={isLoading || !curvesReady}
              >
                <Icon icon={faSyncAlt} className="me-1" />
                Repricear
              </Button>
              {canEdit && (
                <div className="d-flex align-items-center gap-1">
                  {ADD_TYPE_OPTIONS.map((opt) => (
                    <Button
                      key={opt.value}
                      variant="outline-success"
                      size="sm"
                      onClick={() => setAddType(opt.value)}
                    >
                      <Icon icon={faPlus} className="me-1" />
                      {opt.label}
                    </Button>
                  ))}
                </div>
              )}
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={() => setShowConfigModal(true)}
                title="Configurar fuentes de market data"
              >
                <Icon icon={faCog} className="me-1" />
                Fuentes
              </Button>
            </div>
          </div>
        </Row>

        {/* Curve status — removed, MarkDateBar already shows IBR/SOFR/NDF chips + spot */}
        <MarkDateBar
          repricing={markRepricing}
          fecha={markFecha}
        />

        {/* Active market data sources */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
          {(
            [
              ['FX', SOURCE_LABELS[marketDataConfig.spot_fx]],
              ['NDF', SOURCE_LABELS[marketDataConfig.ndf_curve]],
              ['IBR', SOURCE_LABELS[marketDataConfig.ibr]],
              ['SOFR', SOURCE_LABELS[marketDataConfig.sofr]],
            ] as [string, string][]
          ).map(([variable, source]) => (
            <span
              key={variable}
              style={{
                fontSize: 11,
                padding: '2px 7px',
                borderRadius: 4,
                background: '#e9ecef',
                color: '#495057',
                fontFamily: 'monospace',
              }}
            >
              {variable}: <strong>{source}</strong>
            </span>
          ))}
        </div>

        {/* Error */}
        {tradingError && (
          <div
            style={{
              padding: '8px 12px',
              background: '#f8d7da',
              color: '#721c24',
              borderRadius: 6,
              fontSize: 12,
              marginBottom: 12,
            }}
          >
            {tradingError}
          </div>
        )}

        {/* Banderita "vista historica" — solo cuando markFecha < hoy. Avisa al
            usuario que el blotter, NPV, FX Delta y P&G estan reconstruidos
            "as-of" esa fecha (no es el estado actual del portafolio). */}
        {isHistoricalView && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 14px',
              background: '#fff3cd',
              border: '1px solid #ffeeba',
              borderRadius: 6,
              fontSize: 12,
              color: '#856404',
              marginBottom: 12,
            }}
          >
            <span style={{ fontSize: 14 }}>📅</span>
            <span>
              Viendo el portafolio como era al{' '}
              <strong style={{ fontFamily: 'monospace' }}>{markFecha}</strong>{' '}
              (vista historica reconstruida). NPV, FX Delta, P&G y estado de
              cada posicion reflejan ese dia, no el estado actual.
            </span>
          </div>
        )}

        {/* Summary — incluye P&G Realizado total (COP) de NDFs liquidadas */}
        <SummaryBar
          summary={summary}
          pricedAt={pricedAt}
          pnlTotals={pnlTotals}
          realizedPnlMtdCop={realizedPnlMtdCop}
          realizedPnlYtdCop={realizedPnlYtdCop}
        />

        {/* Portafolio (anteriormente habia un toggle Portafolio/Marcas;
            Marcas ahora vive como entrada propia en el sidebar -> /marks) */}
        <div
          style={{
            background: '#fff',
            border: '1px solid #dee2e6',
            borderRadius: 8,
            padding: 20,
          }}
        >
          <BlotterTable
            rows={portfolioRows}
            onDelete={handleDelete}
            onLiquidate={handleOpenLiquidate}
            onSelectXccy={onSelectXccy}
            onSelectNdf={onSelectNdf}
            onSelectIbr={onSelectIbr}
            canEdit={canEdit}
            canLiquidate={canLiquidate}
            prefs={blotterPrefs}
            onPrefsChange={setBlotterPrefs}
            liquidations={liquidationsAsOf}
            xccySettlements={xccySettlementsAsOf}
          />
        </div>

        {/* Add Modals — adding a position changes xccyPositions/ndfPositions/
            ibrSwapPositions; useRepricePortfolio sees the new position list in
            its query key and refetches automatically. No manual reprice trigger
            needed (#313). */}
        <AddXccyModal
          show={addType === 'xccy'}
          onHide={() => setAddType(null)}
          onSave={async (v) => {
            await addXccyMutation.mutateAsync(v);
            toast.success('Posicion XCCY creada');
          }}
        />
        <AddNdfModal
          show={addType === 'ndf'}
          onHide={() => setAddType(null)}
          onSave={async (v) => {
            await addNdfMutation.mutateAsync(v);
            toast.success('Posicion NDF creada');
          }}
        />
        <AddIbrSwapModal
          show={addType === 'ibr'}
          onHide={() => setAddType(null)}
          onSave={async (v) => {
            await addIbrSwapMutation.mutateAsync(v);
            toast.success('Posicion IBR Swap creada');
          }}
        />
        {/* Detail Modals */}
        <XccyDetailModal row={selectedXccy} show={!!selectedXccy} onHide={() => setSelectedXccy(null)} />
        <NdfDetailModal row={selectedNdf} show={!!selectedNdf} onHide={() => setSelectedNdf(null)} />
        <IbrSwapDetailModal row={selectedIbrSwap} show={!!selectedIbrSwap} onHide={() => setSelectedIbrSwap(null)} />

        {/* Market Data Config Modal */}
        <MarketDataConfigModal
          show={showConfigModal}
          onHide={() => setShowConfigModal(false)}
          config={marketDataConfig}
          onSave={updateMarketDataConfig}
        />

        {/* Liquidate NDF Modal — abierto desde el boton verde de cada fila
            NDF Activa. Al confirmar invalida queries y refetcha
            liquidaciones para que el card P&G Realizado se actualice. */}
        <LiquidateNdfModal
          show={showLiquidate}
          row={liquidateRow}
          onHide={() => setShowLiquidate(false)}
          onSuccess={() => {
            // Invalidar la query de NDF positions para que el blotter
            // refresque y muestre estado='Liquidado'. Tambien refetchar
            // liquidaciones para el card P&G Realizado.
            queryClient.invalidateQueries({ queryKey: ['positions', 'ndf'] });
            queryClient.invalidateQueries({ queryKey: ['pricing', 'reprice'] });
            reloadLiquidations();
          }}
        />
      </Container>
    </CoreLayout>
  );
}

export default PortfolioPage;
