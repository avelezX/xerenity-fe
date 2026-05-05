'use client';

/**
 * Debt-rate chart for the Créditos page.
 *
 * Plots each loan as a bubble at (Macaulay duration in years, rate %).
 * - Filter "Tasa Fija":     Y-axis is total nominal rate.
 * - Filter "Tasa Variable": Y-axis is the IBR spread (loan.interest_rate),
 *                           since IBR moves daily and the spread is what
 *                           the bank actually charges as their margin.
 *
 * Bubble size scales with the loan's outstanding amount so concentration
 * jumps out visually. Each bank gets a deterministic color from the
 * Xerenity palette, consistent with the cheapest-bank chart.
 *
 * UVR loans are intentionally excluded.
 */
import React, { useMemo, useState } from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { CashFlowItem, Loan, LoanCashFlowIbr } from 'src/types/loans';
import { IbrCurvePoint } from 'src/queries/sovereignCurve';
import { getLoanDebtPoint, LoanDebtPoint } from 'src/lib/risk/loanDebtPoint';
import { getBankColor } from 'src/utils/bankColors';
import currencyFormat from 'src/utils/currencyFormat';

type RateFilter = 'fija' | 'variable';

interface Props {
  loans: Loan[];
  cashFlows: CashFlowItem[];
  ibrCurve: IbrCurvePoint[];
  isLoading?: boolean;
}

interface ScatterDatum extends LoanDebtPoint {
  /** Macaulay duration (years) — X-axis value. */
  x: number;
  /** Y-axis: total rate when fija, spread when variable. */
  y: number;
  /** Z-axis: amount (drives bubble size). */
  z: number;
  color: string;
}

interface BankBucket {
  bank: string;
  color: string;
  points: ScatterDatum[];
  totalAmount: number;
}

const FILTER_OPTIONS: { key: RateFilter; label: string }[] = [
  { key: 'fija', label: 'Tasa Fija' },
  { key: 'variable', label: 'Tasa Variable (IBR)' },
];

const CHART_HEIGHT = 420;

const PERIOD_YEARS: Record<string, number> = {
  Mensual: 1 / 12,
  Trimestral: 0.25,
  Semestral: 0.5,
  Anual: 1,
};

const FILTER_BTN_BASE: React.CSSProperties = {
  padding: '2px 10px',
  borderRadius: 12,
  fontSize: 11,
  fontWeight: 600,
  cursor: 'pointer',
};

const tooltipStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #ccc',
  borderRadius: 4,
  padding: '8px 10px',
  fontSize: 12,
  lineHeight: 1.4,
  boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
};

const emptyStyle: React.CSSProperties = {
  height: CHART_HEIGHT,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#adb5bd',
  fontSize: 12,
  border: '2px dashed #dee2e6',
  borderRadius: 8,
};

function formatYearTick(v: number): string {
  if (v < 1) return `${(v * 12).toFixed(0)}M`;
  if (v < 10) return `${v.toFixed(1)}Y`;
  return `${Math.round(v)}Y`;
}

/**
 * Macaulay-style duration in years from a loan's remaining cashflows
 * (no discounting — same simple weighting used elsewhere in the app for
 * portfolio summaries; consistent with `buildPortfolioSummary`).
 */
function durationFromFlows(
  flows: LoanCashFlowIbr[],
  periodicity: string,
): number | null {
  const today = new Date().toISOString().slice(0, 10);
  const future = flows.filter((f) => (f.date ?? '').split(' ')[0] > today);
  if (future.length === 0) return null;
  const pY = PERIOD_YEARS[periodicity] ?? 0.25;
  let weighted = 0;
  let total = 0;
  future.forEach((f, i) => {
    const t = (i + 1) * pY;
    const pmt = f.payment ?? 0;
    weighted += t * pmt;
    total += pmt;
  });
  if (total <= 0) return null;
  return weighted / total;
}

interface PointTooltipProps {
  active?: boolean;
  payload?: { payload?: ScatterDatum }[];
  filter: RateFilter;
}

function PointTooltip({ active, payload, filter }: PointTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const pt = payload[0].payload;
  if (!pt) return null;
  return (
    <div style={tooltipStyle}>
      <div style={{ fontWeight: 700, marginBottom: 2 }}>{pt.identifier}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span
          style={{
            display: 'inline-block',
            width: 10,
            height: 10,
            borderRadius: 2,
            background: pt.color,
          }}
        />
        <span>Banco: {pt.bank}</span>
      </div>
      <div>
        Tipo: <span style={{ fontWeight: 600 }}>{pt.type === 'fija' ? 'Fija' : 'IBR'}</span>
      </div>
      <div>Monto: {currencyFormat(pt.amount, 0)}</div>
      <div>Tasa total: {pt.totalRate.toFixed(2)}%</div>
      {pt.type === 'ibr' && pt.baseRate != null && (
        <div style={{ color: '#666', fontSize: 11 }}>
          {pt.baseLabel ?? 'IBR'} ({pt.baseRate.toFixed(2)}%) + spread {pt.spread.toFixed(2)}%
        </div>
      )}
      <div>Duración: {pt.x.toFixed(2)} años</div>
      <div style={{ color: '#888', fontSize: 11 }}>Vence: {pt.maturityDate}</div>
      {filter === 'variable' && (
        <div style={{ color: '#888', fontSize: 11, marginTop: 2 }}>
          Eje Y muestra spread sobre IBR.
        </div>
      )}
    </div>
  );
}

// ─── Custom legend ──────────────────────────────────────────────────────────

function ChartLegend({ byBank }: { byBank: BankBucket[] }) {
  if (byBank.length === 0) return null;
  return (
    <div
      style={{
        marginTop: 10,
        paddingTop: 8,
        borderTop: '1px solid #f0f0f0',
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8,
        alignItems: 'center',
        fontSize: 11,
        color: '#495057',
      }}
    >
      <span style={{ color: '#6c757d', fontWeight: 600 }}>Bancos:</span>
      {byBank.map((b) => (
        <span
          key={b.bank}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 8px',
            borderRadius: 10,
            background: '#f8f9fa',
            border: '1px solid #e9ecef',
          }}
        >
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 999,
              background: b.color,
              display: 'inline-block',
            }}
          />
          <span style={{ fontWeight: 600 }}>{b.bank}</span>
          <span style={{ color: '#6c757d' }}>({b.points.length})</span>
        </span>
      ))}
    </div>
  );
}

// ─── Chart body (memoized, declared once) ──────────────────────────────────

interface ChartAreaProps {
  isLoading?: boolean;
  empty: boolean;
  filter: RateFilter;
  xMax: number;
  yDomain: [number, number];
  yLabel: string;
  zRange: [number, number];
  byBank: BankBucket[];
}

function ChartArea({
  isLoading,
  empty,
  filter,
  xMax,
  yDomain,
  yLabel,
  zRange,
  byBank,
}: ChartAreaProps) {
  if (isLoading) return <div style={emptyStyle}>Cargando…</div>;
  if (empty) {
    const msg =
      filter === 'fija'
        ? 'Sin créditos a tasa fija en la selección.'
        : 'Sin créditos a tasa variable (IBR) en la selección.';
    return <div style={emptyStyle}>{msg}</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <ScatterChart margin={{ top: 16, right: 24, left: 8, bottom: 24 }}>
        <CartesianGrid strokeDasharray="6 4" stroke="#D3D3D3" />
        <XAxis
          dataKey="x"
          type="number"
          domain={[0, xMax]}
          tick={{ fontSize: 11 }}
          tickFormatter={formatYearTick}
          label={{
            value: 'Duración (años)',
            position: 'insideBottom',
            offset: -8,
            fontSize: 11,
          }}
        />
        <YAxis
          dataKey="y"
          type="number"
          domain={yDomain}
          tick={{ fontSize: 11 }}
          tickFormatter={(v: number) => `${v.toFixed(2)}%`}
          label={{
            value: yLabel,
            angle: -90,
            position: 'insideLeft',
            fontSize: 11,
          }}
        />
        <ZAxis dataKey="z" range={[60, 600]} domain={zRange} name="Monto" />
        <Tooltip
          cursor={{ strokeDasharray: '3 3' }}
          content={<PointTooltip filter={filter} />}
        />
        {byBank.map((b) => (
          <Scatter
            key={b.bank}
            name={b.bank}
            data={b.points}
            fill={b.color}
            fillOpacity={0.75}
            stroke={b.color}
            isAnimationActive={false}
          />
        ))}
      </ScatterChart>
    </ResponsiveContainer>
  );
}

// ─── Main component ────────────────────────────────────────────────────────

export default function DebtCurveChart({
  loans,
  cashFlows,
  ibrCurve,
  isLoading,
}: Props) {
  const [filter, setFilter] = useState<RateFilter>('fija');

  // Build per-loan datapoints: duration on X, rate-or-spread on Y, amount on Z.
  const points = useMemo<ScatterDatum[]>(() => {
    const flowMap = new Map<string, LoanCashFlowIbr[]>();
    cashFlows.forEach((cf) => flowMap.set(cf.loanId, cf.flows));

    return loans
      .map((loan): ScatterDatum | null => {
        if (filter === 'fija' && loan.type !== 'fija') return null;
        if (filter === 'variable' && loan.type !== 'ibr') return null;

        const point = getLoanDebtPoint(loan, ibrCurve);
        if (!point) return null;

        const flows = flowMap.get(loan.id);
        const duration = flows ? durationFromFlows(flows, loan.periodicity) : null;
        // Fall back to remaining tenor if flows aren't loaded yet — keeps the
        // bubble visible while the cashflow query is in flight.
        const x = duration ?? point.tenorYears;
        if (!Number.isFinite(x) || x <= 0) return null;

        const y = filter === 'variable' ? point.spread : point.totalRate;
        if (!Number.isFinite(y)) return null;

        return {
          ...point,
          x,
          y,
          z: Math.max(point.amount, 1),
          color: getBankColor(point.bank),
        };
      })
      .filter((p): p is ScatterDatum => p !== null);
  }, [loans, cashFlows, ibrCurve, filter]);

  const byBank = useMemo<BankBucket[]>(() => {
    const groups = new Map<string, BankBucket>();
    points.forEach((p) => {
      const entry = groups.get(p.bank) ?? {
        bank: p.bank,
        color: p.color,
        points: [],
        totalAmount: 0,
      };
      entry.points.push(p);
      entry.totalAmount += p.amount;
      groups.set(p.bank, entry);
    });
    return Array.from(groups.values()).sort((a, b) => a.bank.localeCompare(b.bank));
  }, [points]);

  const xMax = useMemo(() => {
    if (points.length === 0) return 10;
    return Math.max(...points.map((p) => p.x)) * 1.1;
  }, [points]);

  const yDomain = useMemo<[number, number]>(() => {
    if (points.length === 0) return [0, filter === 'variable' ? 8 : 20];
    const ys = points.map((p) => p.y);
    const min = Math.min(...ys);
    const max = Math.max(...ys);
    const pad = Math.max(0.5, (max - min) * 0.2);
    return [Math.max(0, min - pad), max + pad];
  }, [points, filter]);

  const zRange = useMemo<[number, number]>(() => {
    if (points.length === 0) return [60, 60];
    const amounts = points.map((p) => p.z);
    const min = Math.min(...amounts);
    const max = Math.max(...amounts);
    if (max === min) return [120, 120];
    return [Math.min(...amounts), Math.max(...amounts)];
  }, [points]);

  const empty = !isLoading && points.length === 0;

  const yLabel =
    filter === 'variable' ? 'Spread sobre IBR' : 'Tasa fija';

  return (
    <div style={{ background: '#fff', border: '1px solid #dee2e6', borderRadius: 8, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#212529' }}>
          {filter === 'variable'
            ? 'Spread IBR vs Duración'
            : 'Tasa Fija vs Duración'}
        </span>
        <div style={{ display: 'flex', gap: 4, marginLeft: 'auto', alignItems: 'center' }}>
          {FILTER_OPTIONS.map(({ key, label }) => {
            const active = filter === key;
            return (
              <button
                type="button"
                key={key}
                onClick={() => setFilter(key)}
                style={{
                  ...FILTER_BTN_BASE,
                  border: active ? '2px solid #495057' : '1px solid #dee2e6',
                  background: active ? '#495057' : '#f8f9fa',
                  color: active ? '#fff' : '#6c757d',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <ChartArea
        isLoading={isLoading}
        empty={empty}
        filter={filter}
        xMax={xMax}
        yDomain={yDomain}
        yLabel={yLabel}
        zRange={zRange}
        byBank={byBank}
      />

      <ChartLegend byBank={byBank} />

      <div style={{ fontSize: 10, color: '#6c757d', marginTop: 4 }}>
        Tamaño del círculo ∝ monto del crédito. Color = banco (determinístico).
      </div>
    </div>
  );
}
