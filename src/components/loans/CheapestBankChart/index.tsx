'use client';

/**
 * Bank-comparison chart for the Créditos page.
 *
 * Shows the weighted-average effective rate per bank — answer to
 * "¿qué banco me presta más barato?". Lower bars are cheaper. Each bar
 * uses the same deterministic per-bank color as the debt-curve chart so
 * the user can correlate visually.
 *
 * Weighting is by outstanding amount (original_balance fallback). Loan
 * type breakdown (count of fija vs ibr) is in the tooltip so the user
 * can interpret why a bank looks cheap or expensive.
 */
import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from 'recharts';
import { Loan } from 'src/types/loans';
import { IbrCurvePoint } from 'src/queries/sovereignCurve';
import { getLoanDebtPoint } from 'src/lib/risk/loanDebtPoint';
import { getBankColor } from 'src/utils/bankColors';
import currencyFormat from 'src/utils/currencyFormat';

interface Props {
  loans: Loan[];
  ibrCurve: IbrCurvePoint[];
  isLoading?: boolean;
}

interface BankRow {
  bank: string;
  loanCount: number;
  fijaCount: number;
  ibrCount: number;
  totalAmount: number;
  /** Weighted-avg loan rate (%), weighted by amount. */
  avgRate: number;
  color: string;
}

const ROW_HEIGHT = 36;
const MIN_HEIGHT = 220;

const cardStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #dee2e6',
  borderRadius: 8,
  padding: 16,
};

const emptyStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#adb5bd',
  fontSize: 12,
  border: '2px dashed #dee2e6',
  borderRadius: 8,
};

function buildBankRows(loans: Loan[], ibrCurve: IbrCurvePoint[]): BankRow[] {
  type Acc = {
    weight: number;
    weightedRate: number;
    count: number;
    fijaCount: number;
    ibrCount: number;
  };
  const byBank = new Map<string, Acc>();

  loans.forEach((loan) => {
    const point = getLoanDebtPoint(loan, ibrCurve);
    if (!point) return;
    const weight = point.amount;
    if (weight <= 0) return;
    const acc = byBank.get(point.bank) ?? {
      weight: 0,
      weightedRate: 0,
      count: 0,
      fijaCount: 0,
      ibrCount: 0,
    };
    acc.weight += weight;
    acc.weightedRate += point.totalRate * weight;
    acc.count += 1;
    if (point.type === 'fija') acc.fijaCount += 1;
    else acc.ibrCount += 1;
    byBank.set(point.bank, acc);
  });

  const rows: BankRow[] = [];
  byBank.forEach((acc, bank) => {
    if (acc.weight <= 0) return;
    rows.push({
      bank,
      loanCount: acc.count,
      fijaCount: acc.fijaCount,
      ibrCount: acc.ibrCount,
      totalAmount: acc.weight,
      avgRate: acc.weightedRate / acc.weight,
      color: getBankColor(bank),
    });
  });
  return rows.sort((a, b) => a.avgRate - b.avgRate);
}

function BankTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: BankRow }[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const r = payload[0].payload;
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #ccc',
        borderRadius: 4,
        padding: '8px 10px',
        fontSize: 12,
        lineHeight: 1.4,
        boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontWeight: 700,
          marginBottom: 2,
        }}
      >
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: 2,
            background: r.color,
            display: 'inline-block',
          }}
        />
        {r.bank}
      </div>
      <div>Créditos: {r.loanCount} ({r.fijaCount} fija · {r.ibrCount} IBR)</div>
      <div>Monto total: {currencyFormat(r.totalAmount, 0)}</div>
      <div>
        Tasa promedio: <span style={{ fontWeight: 700 }}>{r.avgRate.toFixed(2)}%</span>
      </div>
    </div>
  );
}

function Title() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: '#212529' }}>
        ¿Qué banco me presta más barato?
      </span>
    </div>
  );
}

function ChartBody({ rows, height }: { rows: BankRow[]; height: number }) {
  const maxRate = Math.max(...rows.map((r) => r.avgRate));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} layout="vertical" margin={{ top: 8, right: 60, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E9ECEF" />
        <XAxis
          type="number"
          domain={[0, Math.ceil(maxRate + 1)]}
          tick={{ fontSize: 11 }}
          tickFormatter={(v: number) => `${v.toFixed(0)}%`}
          label={{
            value: 'Tasa promedio',
            position: 'insideBottom',
            offset: -4,
            fontSize: 11,
          }}
        />
        <YAxis type="category" dataKey="bank" tick={{ fontSize: 11 }} width={140} />
        <Tooltip content={<BankTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
        <Bar dataKey="avgRate" isAnimationActive={false} radius={[0, 4, 4, 0]}>
          {rows.map((r) => (
            <Cell key={r.bank} fill={r.color} />
          ))}
          <LabelList
            dataKey="avgRate"
            position="right"
            formatter={(v: number) => `${v.toFixed(2)}%`}
            style={{ fontSize: 11, fontWeight: 600, fill: '#495057' }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export default function CheapestBankChart({
  loans,
  ibrCurve,
  isLoading,
}: Props) {
  const rows = useMemo(() => buildBankRows(loans, ibrCurve), [loans, ibrCurve]);
  const height = Math.max(MIN_HEIGHT, rows.length * ROW_HEIGHT + 60);

  if (isLoading) {
    return (
      <div style={cardStyle}>
        <Title />
        <div style={{ ...emptyStyle, height: MIN_HEIGHT }}>Cargando…</div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div style={cardStyle}>
        <Title />
        <div style={{ ...emptyStyle, height: MIN_HEIGHT }}>
          Selecciona créditos para comparar tasas por banco.
        </div>
      </div>
    );
  }

  return (
    <div style={cardStyle}>
      <Title />
      <ChartBody rows={rows} height={height} />
      <div style={{ fontSize: 10, color: '#6c757d', marginTop: 4 }}>
        Tasa promedio ponderada por monto. Banco más barato arriba.
      </div>
    </div>
  );
}
