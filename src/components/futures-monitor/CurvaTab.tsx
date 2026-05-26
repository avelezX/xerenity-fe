/* eslint-disable @typescript-eslint/no-use-before-define */
/**
 * Tab Curva — tabla de contratos a la izquierda + line chart de la curva
 * a la derecha. Trading desk precision look.
 */
import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import type { CurveRow } from 'src/lib/futures-monitor/types';
import { T, MONO, fmtPrice, fmtSigned, spreadColor } from './theme';

export default function CurvaTab({ curve }: { curve: CurveRow[] }) {
  // Ordena por dias_to_exp para que el chart muestre la curva en orden cronologico
  const sortedCurve = useMemo(
    () => [...curve].sort((a, b) => a.days_to_exp - b.days_to_exp),
    [curve],
  );

  const maxAbsSpread = useMemo(
    () => sortedCurve.reduce((m, r) => Math.max(m, Math.abs(r.spread_vs_front)), 0),
    [sortedCurve],
  );

  const chartData = sortedCurve.map((r) => ({
    label: r.label,
    price: r.price,
    days_to_exp: r.days_to_exp,
  }));

  if (sortedCurve.length === 0) {
    return (
      <div style={{
        padding: '40px', textAlign: 'center', color: T.muted,
        border: `1px solid ${T.hairlineSoft}`, background: T.surfaceAlt,
        fontFamily: MONO, fontSize: 12,
      }}>
        Sin datos de curva.
      </div>
    );
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '420px 1fr',
      gap: 16,
      alignItems: 'start',
    }}>
      {/* ─── Tabla ────────────────────────────────────────────────── */}
      <div style={{
        border: `1px solid ${T.hairline}`,
        background: T.surface,
        fontFamily: MONO,
        fontSize: 11,
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{
              borderBottom: `1px solid ${T.hairline}`,
              background: T.surfaceAlt,
            }}>
              <Th>Contrato</Th>
              <Th align="right">Precio</Th>
              <Th align="right">DTE</Th>
              <Th align="right">Spread<br /><span style={{ fontSize: 9, color: T.mutedDim }}>vs front</span></Th>
              <Th align="right">Obs</Th>
            </tr>
          </thead>
          <tbody>
            {sortedCurve.map((r) => (
              <tr key={r.label} style={{ borderBottom: `1px solid ${T.hairlineSoft}` }}>
                <td style={{ padding: '7px 10px' }}>
                  <span style={{ fontWeight: 700, color: T.ink }}>{r.label}</span>
                  <div style={{ fontSize: 9, color: T.mutedDim, marginTop: 2 }}>
                    {r.ticker}
                  </div>
                </td>
                <Td align="right" mono bold>{fmtPrice(r.price)}</Td>
                <Td align="right" muted>{r.days_to_exp}</Td>
                <td style={{
                  padding: '7px 10px',
                  textAlign: 'right',
                  fontFamily: MONO,
                  fontVariantNumeric: 'tabular-nums',
                  background: spreadColor(r.spread_vs_front, maxAbsSpread),
                  color: T.inkSoft,
                  fontWeight: 600,
                }}>
                  {fmtSigned(r.spread_vs_front)}
                </td>
                <Td align="right" muted>{r.obs}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ─── Chart ────────────────────────────────────────────────── */}
      <div style={{
        border: `1px solid ${T.hairline}`,
        background: T.surface,
        padding: '12px 14px',
      }}>
        <div style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.14em',
          color: T.muted, textTransform: 'uppercase', marginBottom: 8,
          fontFamily: MONO,
        }}>
          Curva de precio (c/lb)
        </div>
        <ResponsiveContainer width="100%" height={360}>
          <LineChart data={chartData} margin={{ top: 8, right: 12, left: 4, bottom: 24 }}>
            <CartesianGrid stroke={T.hairlineSoft} strokeDasharray="0" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: T.muted, fontFamily: MONO }}
              tickLine={{ stroke: T.hairline }}
              axisLine={{ stroke: T.hairline }}
              angle={-30}
              textAnchor="end"
              height={48}
            />
            <YAxis
              tick={{ fontSize: 10, fill: T.muted, fontFamily: MONO }}
              tickLine={{ stroke: T.hairline }}
              axisLine={{ stroke: T.hairline }}
              tickFormatter={(v: number) => v.toFixed(2)}
              domain={['auto', 'auto']}
              width={48}
            />
            <RechartsTooltip
              contentStyle={{
                background: T.surface,
                border: `1px solid ${T.hairline}`,
                fontFamily: MONO,
                fontSize: 11,
                padding: '6px 10px',
              }}
              formatter={(v: number) => [v.toFixed(2), 'Precio (c/lb)']}
              labelStyle={{ color: T.ink, fontWeight: 700 }}
            />
            {/* Linea horizontal en precio del front para visualizar contango/back */}
            {sortedCurve.length > 0 && (
              <ReferenceLine
                y={sortedCurve[0].price}
                stroke={T.mutedDim}
                strokeDasharray="3 3"
                strokeWidth={1}
                label={{
                  value: `Front ${fmtPrice(sortedCurve[0].price)}`,
                  fontSize: 9,
                  fill: T.muted,
                  fontFamily: MONO,
                  position: 'right',
                }}
              />
            )}
            <Line
              type="monotone"
              dataKey="price"
              stroke={T.accent}
              strokeWidth={1.5}
              dot={{ fill: T.accent, r: 3, strokeWidth: 0 }}
              activeDot={{ r: 5, fill: T.accent, strokeWidth: 0 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
        <div style={{
          marginTop: 6, fontSize: 9, color: T.mutedDim,
          fontFamily: MONO, letterSpacing: '0.06em', textAlign: 'center',
        }}>
          Linea horizontal punteada = precio del front contract
        </div>
      </div>
    </div>
  );
}

// ── Sub-components de tabla ────────────────────────────────────────

function Th({
  children,
  align = 'left',
}: {
  children: React.ReactNode;
  align?: 'left' | 'right';
}) {
  return (
    <th style={{
      padding: '7px 10px',
      textAlign: align,
      fontSize: 9,
      fontWeight: 700,
      letterSpacing: '0.12em',
      color: T.muted,
      textTransform: 'uppercase',
    }}>
      {children}
    </th>
  );
}

function Td({
  children,
  align = 'left',
  mono = false,
  bold = false,
  muted = false,
}: {
  children: React.ReactNode;
  align?: 'left' | 'right';
  mono?: boolean;
  bold?: boolean;
  muted?: boolean;
}) {
  return (
    <td style={{
      padding: '7px 10px',
      textAlign: align,
      fontFamily: mono ? MONO : 'inherit',
      fontVariantNumeric: mono ? 'tabular-nums' : 'normal',
      fontWeight: bold ? 700 : 500,
      color: muted ? T.muted : T.ink,
    }}>
      {children}
    </td>
  );
}
