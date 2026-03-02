'use client';

import React, { useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import type { NdfImpliedCurvePoint } from 'src/types/pricing';

/**
 * Aggregated tenor-node data produced by the parent page from raw DTCC trades.
 */
export type NDFNodePoint = {
  tenorLabel: string;
  days: number;
  rate: number;
  trades: number;
  volumeUSD: number;
};

/**
 * FXEmpire mid-rate point (already mapped from CopFwdPoint).
 */
export type FXEPoint = {
  tenor: string;
  days: number;
  rate: number;
};

type CurveKey = 'dtcc' | 'fxe' | 'implied';

const CURVE_CONFIG: Record<CurveKey, { color: string; label: string }> = {
  dtcc: { color: '#2ca02c', label: 'DTCC (Vol-Weighted)' },
  fxe: { color: '#1f77b4', label: 'FXEmpire (Mid)' },
  implied: { color: '#ff7f0e', label: 'Implied (IBR/SOFR)' },
};

type ChartPoint = {
  days: number;
  dtcc?: number;
  fxe?: number;
  implied?: number;
  dtccLabel?: string;
  fxeLabel?: string;
  impliedLabel?: string;
  dtccTrades?: number;
  dtccVol?: number;
};

type NDFForwardCurveChartProps = {
  dtccNodes: NDFNodePoint[];
  fxePoints: FXEPoint[];
  impliedPoints?: NdfImpliedCurvePoint[];
};

const MONTHS_TO_DAYS: Record<number, number> = {
  1: 30, 2: 60, 3: 90, 6: 180, 9: 270, 12: 360,
};

/* eslint-disable @typescript-eslint/no-explicit-any */
const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: any[] }) => {
  if (!active || !payload || payload.length === 0) return null;
  const pt = payload[0].payload as ChartPoint;

  return (
    <div
      style={{
        backgroundColor: 'white',
        border: '1px solid #ccc',
        borderRadius: 4,
        padding: '8px 12px',
        fontSize: 13,
        minWidth: 180,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{pt.days}d</div>
      {pt.dtcc != null && (
        <div>
          <span style={{ color: CURVE_CONFIG.dtcc.color, fontWeight: 600 }}>DTCC:</span>{' '}
          {pt.dtcc.toFixed(2)}
          {pt.dtccTrades != null && (
            <span style={{ color: '#999', fontSize: 12 }}>
              {' '}({pt.dtccTrades} trades, ${((pt.dtccVol || 0) / 1e6).toFixed(1)}M)
            </span>
          )}
        </div>
      )}
      {pt.fxe != null && (
        <div>
          <span style={{ color: CURVE_CONFIG.fxe.color, fontWeight: 600 }}>FXE:</span>{' '}
          {pt.fxe.toFixed(2)}
          {pt.fxeLabel && (
            <span style={{ color: '#999', fontSize: 12 }}> ({pt.fxeLabel})</span>
          )}
        </div>
      )}
      {pt.implied != null && (
        <div>
          <span style={{ color: CURVE_CONFIG.implied.color, fontWeight: 600 }}>Implied:</span>{' '}
          {pt.implied.toFixed(2)}
          {pt.impliedLabel && (
            <span style={{ color: '#999', fontSize: 12 }}> ({pt.impliedLabel})</span>
          )}
        </div>
      )}
      {/* Basis when both fxe and implied exist */}
      {pt.fxe != null && pt.implied != null && (
        <div style={{ marginTop: 4, borderTop: '1px solid #eee', paddingTop: 4 }}>
          <span style={{ fontWeight: 600, color: '#666' }}>Basis:</span>{' '}
          <span
            style={{
              color: pt.fxe - pt.implied > 0 ? '#28a745' : '#dc3545',
              fontWeight: 600,
            }}
          >
            {(pt.fxe - pt.implied).toFixed(2)}
          </span>
        </div>
      )}
    </div>
  );
};
/* eslint-enable @typescript-eslint/no-explicit-any */

function CurveToggle({
  curveKey,
  visible,
  onToggle,
  hasData,
}: {
  curveKey: CurveKey;
  visible: boolean;
  onToggle: () => void;
  hasData: boolean;
}) {
  const config = CURVE_CONFIG[curveKey];
  if (!hasData) return null;
  return (
    <label
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        cursor: 'pointer',
        marginRight: 16,
        fontSize: 14,
        opacity: visible ? 1 : 0.4,
      }}
    >
      <input
        type="checkbox"
        checked={visible}
        onChange={onToggle}
        style={{ display: 'none' }}
      />
      <span
        style={{
          width: 14,
          height: 14,
          borderRadius: 3,
          backgroundColor: visible ? config.color : '#ccc',
          display: 'inline-block',
          border: `2px solid ${config.color}`,
        }}
      />
      <span style={{ fontWeight: visible ? 600 : 400 }}>{config.label}</span>
    </label>
  );
}

export default function NDFForwardCurveChart({
  dtccNodes,
  fxePoints,
  impliedPoints = [],
}: NDFForwardCurveChartProps) {
  const [visible, setVisible] = useState<Record<CurveKey, boolean>>({
    dtcc: true,
    fxe: true,
    implied: true,
  });

  const chartData = useMemo(() => {
    const pointMap = new Map<number, ChartPoint>();

    const getOrCreate = (days: number): ChartPoint => {
      if (!pointMap.has(days)) {
        pointMap.set(days, { days });
      }
      return pointMap.get(days)!;
    };

    // DTCC aggregated nodes
    dtccNodes.forEach((n) => {
      const pt = getOrCreate(n.days);
      pt.dtcc = n.rate;
      pt.dtccLabel = n.tenorLabel;
      pt.dtccTrades = n.trades;
      pt.dtccVol = n.volumeUSD;
    });

    // FXEmpire points
    fxePoints.forEach((f) => {
      const pt = getOrCreate(f.days);
      pt.fxe = f.rate;
      pt.fxeLabel = f.tenor;
    });

    // Implied (from pysdk curves)
    impliedPoints.forEach((ip) => {
      const days = MONTHS_TO_DAYS[ip.tenor_months] ?? ip.tenor_months * 30;
      const pt = getOrCreate(days);
      pt.implied = ip.forward_irt_parity;
      pt.impliedLabel = ip.tenor;
    });

    return Array.from(pointMap.values()).sort((a, b) => a.days - b.days);
  }, [dtccNodes, fxePoints, impliedPoints]);

  const hasDtcc = dtccNodes.length > 0;
  const hasFxe = fxePoints.length > 0;
  const hasImplied = impliedPoints.length > 0;

  if (!hasDtcc && !hasFxe && !hasImplied) {
    return (
      <div
        style={{
          height: 400,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#999',
        }}
      >
        No hay datos para las curvas NDF
      </div>
    );
  }

  // Compute Y domain from visible data
  const allRates = chartData.flatMap((d) =>
    [
      visible.dtcc ? d.dtcc : undefined,
      visible.fxe ? d.fxe : undefined,
      visible.implied ? d.implied : undefined,
    ].filter((v): v is number => v != null)
  );

  if (allRates.length === 0) {
    return (
      <div
        style={{
          height: 400,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#999',
        }}
      >
        Seleccione al menos una curva
      </div>
    );
  }

  const RATE_STEP = 5;
  const minY = Math.floor(Math.min(...allRates) / RATE_STEP) * RATE_STEP - RATE_STEP;
  const maxY = Math.ceil(Math.max(...allRates) / RATE_STEP) * RATE_STEP + RATE_STEP;

  const allDays = chartData.map((d) => d.days);
  const maxDays = Math.max(...allDays);

  // Tenor reference lines
  const TENOR_LINES = [
    { label: '1M', days: 30 },
    { label: '2M', days: 60 },
    { label: '3M', days: 90 },
    { label: '6M', days: 180 },
    { label: '9M', days: 270 },
    { label: '1Y', days: 360 },
  ].filter((t) => t.days <= maxDays + 30);

  const toggleCurve = (key: CurveKey) => {
    setVisible((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: 12,
          paddingLeft: 20,
          gap: 4,
          flexWrap: 'wrap',
        }}
      >
        {(['dtcc', 'fxe', 'implied'] as CurveKey[]).map((key) => (
          <CurveToggle
            key={key}
            curveKey={key}
            visible={visible[key]}
            onToggle={() => toggleCurve(key)}
            hasData={key === 'dtcc' ? hasDtcc : key === 'fxe' ? hasFxe : hasImplied}
          />
        ))}
        <span style={{ fontSize: 12, color: '#999', marginLeft: 8 }}>
          COP/USD NDF - Curvas Forward
        </span>
      </div>
      <ResponsiveContainer width="100%" height={420}>
        <LineChart
          data={chartData}
          margin={{ top: 10, right: 30, left: 20, bottom: 20 }}
        >
          <CartesianGrid strokeDasharray="6 4" stroke="#D3D3D3" vertical={false} />
          <XAxis
            dataKey="days"
            type="number"
            domain={[0, 'auto']}
            tick={{ fontSize: 12 }}
            tickLine={false}
            label={{
              value: 'Dias al vencimiento',
              position: 'bottom',
              offset: 5,
              fontSize: 12,
            }}
          />
          <YAxis
            domain={[minY, maxY]}
            tick={{ fontSize: 12 }}
            tickFormatter={(v: number) => v.toFixed(0)}
            tickLine={false}
            axisLine={false}
            label={{
              value: 'COP/USD',
              angle: -90,
              position: 'insideLeft',
              offset: -5,
              fontSize: 12,
            }}
          />
          {TENOR_LINES.map((t) => (
            <ReferenceLine
              key={t.label}
              x={t.days}
              stroke="#ddd"
              strokeDasharray="3 3"
              label={{
                value: t.label,
                position: 'top',
                fontSize: 11,
                fill: '#999',
              }}
            />
          ))}
          <Tooltip content={<CustomTooltip />} />
          {visible.dtcc && hasDtcc && (
            <Line
              type="monotone"
              dataKey="dtcc"
              stroke={CURVE_CONFIG.dtcc.color}
              strokeWidth={2}
              dot={{ r: 5, fill: CURVE_CONFIG.dtcc.color }}
              activeDot={{ r: 7 }}
              connectNulls
              name="DTCC"
            />
          )}
          {visible.fxe && hasFxe && (
            <Line
              type="monotone"
              dataKey="fxe"
              stroke={CURVE_CONFIG.fxe.color}
              strokeWidth={2}
              dot={{ r: 5, fill: CURVE_CONFIG.fxe.color, strokeWidth: 2 }}
              activeDot={{ r: 7 }}
              connectNulls
              name="FXEmpire"
            />
          )}
          {visible.implied && hasImplied && (
            <Line
              type="monotone"
              dataKey="implied"
              stroke={CURVE_CONFIG.implied.color}
              strokeWidth={2}
              strokeDasharray="6 3"
              dot={{ r: 5, fill: CURVE_CONFIG.implied.color }}
              activeDot={{ r: 7 }}
              connectNulls
              name="Implied"
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
