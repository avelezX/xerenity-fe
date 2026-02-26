'use client';

import React, { useMemo } from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { CopNdf, CopFwdPoint } from 'src/types/condf';

const NDF_COLOR = '#2ca02c';
const FXE_COLOR = '#1f77b4';

const TENOR_BUCKETS: { label: string; min: number; max: number; mid: number }[] = [
  { label: '1M', min: 0, max: 45, mid: 30 },
  { label: '2M', min: 46, max: 75, mid: 60 },
  { label: '3M', min: 76, max: 135, mid: 90 },
  { label: '6M', min: 136, max: 270, mid: 180 },
  { label: '9M', min: 271, max: 315, mid: 270 },
  { label: '1Y', min: 316, max: 550, mid: 360 },
];

// tenor_months → approximate days for FXEmpire data
const MONTHS_TO_DAYS: Record<number, number> = {
  0: 1, 1: 30, 2: 60, 3: 90, 6: 180, 9: 270, 12: 360,
};

function assignTenorBucket(days: number): string | null {
  const bucket = TENOR_BUCKETS.find((b) => days >= b.min && days <= b.max);
  return bucket ? bucket.label : null;
}

function bucketOrder(label: string): number {
  const idx = TENOR_BUCKETS.findIndex((b) => b.label === label);
  return idx >= 0 ? idx : 999;
}

function bucketMidDays(label: string): number {
  return TENOR_BUCKETS.find((b) => b.label === label)?.mid || 30;
}

type NDFCurveChartProps = {
  rawData: CopNdf[];
  fxeData: CopFwdPoint[];
};

/* eslint-disable @typescript-eslint/no-explicit-any */
const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: any[] }) => {
  if (!active || !payload || payload.length === 0) return null;
  const pt = payload[0].payload;

  // FXEmpire point
  if (pt.source === 'fxe') {
    return (
      <div
        style={{
          backgroundColor: 'white',
          border: '1px solid #ccc',
          borderRadius: 4,
          padding: '8px 12px',
          fontSize: 13,
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 4, color: FXE_COLOR }}>
          FXEmpire — {pt.tenor}
        </div>
        <div>
          <span style={{ color: '#666' }}>Mid:</span> {pt.rate.toFixed(2)}
        </div>
        {pt.bid != null && (
          <div>
            <span style={{ color: '#666' }}>Bid/Ask:</span> {pt.bid.toFixed(2)} / {pt.ask.toFixed(2)}
          </div>
        )}
        {pt.fwdPoints != null && (
          <div>
            <span style={{ color: '#666' }}>Fwd Points:</span> {pt.fwdPoints.toFixed(2)}
          </div>
        )}
      </div>
    );
  }

  // DTCC point
  return (
    <div
      style={{
        backgroundColor: 'white',
        border: '1px solid #ccc',
        borderRadius: 4,
        padding: '8px 12px',
        fontSize: 13,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 4 }}>
        {pt.days}d {pt.bucket ? `(${pt.bucket})` : ''} — DTCC
      </div>
      <div>
        <span style={{ color: NDF_COLOR, fontWeight: 600 }}>NDF Rate:</span>{' '}
        {pt.rate.toFixed(2)}
      </div>
      <div style={{ marginTop: 4, fontSize: 12, color: '#999' }}>
        {pt.trades} trades | Vol: ${(pt.vol / 1e6).toFixed(1)}M
      </div>
    </div>
  );
};
/* eslint-enable @typescript-eslint/no-explicit-any */

export { TENOR_BUCKETS, assignTenorBucket, bucketOrder, bucketMidDays };

export default function NDFCurveChart({ rawData, fxeData }: NDFCurveChartProps) {
  // DTCC scatter data
  const scatterData = useMemo(
    () =>
      rawData
        .filter((r) => r.median_exchange_rate > 0)
        .map((r) => ({
          days: r.days_diff_effective_expiration,
          rate: r.median_exchange_rate,
          trades: r.trade_count,
          vol: r.total_sum_notional_leg_2 || 0,
          bucket: assignTenorBucket(r.days_diff_effective_expiration) || '',
          source: 'dtcc',
        }))
        .sort((a, b) => a.days - b.days),
    [rawData]
  );

  // FXEmpire line data
  const fxeLineData = useMemo(
    () =>
      fxeData
        .filter((d) => d.mid != null && d.mid > 0)
        .map((d) => ({
          days: MONTHS_TO_DAYS[d.tenor_months] ?? d.tenor_months * 30,
          rate: d.mid as number,
          tenor: d.tenor,
          bid: d.bid,
          ask: d.ask,
          fwdPoints: d.fwd_points,
          source: 'fxe',
        }))
        .sort((a, b) => a.days - b.days),
    [fxeData]
  );

  const hasFxe = fxeLineData.length > 0;
  const hasDtcc = scatterData.length > 0;

  if (!hasDtcc && !hasFxe) {
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
        No NDF data available
      </div>
    );
  }

  // Compute Y domain from all data sources
  const allRates = [
    ...scatterData.map((d) => d.rate),
    ...fxeLineData.map((d) => d.rate),
  ];
  const RATE_STEP = 5;
  const minY = Math.floor(Math.min(...allRates) / RATE_STEP) * RATE_STEP - RATE_STEP;
  const maxY = Math.ceil(Math.max(...allRates) / RATE_STEP) * RATE_STEP + RATE_STEP;

  const allDays = [
    ...scatterData.map((d) => d.days),
    ...fxeLineData.map((d) => d.days),
  ];
  const maxDays = Math.max(...allDays);

  // Tenor reference lines
  const tenorLines = TENOR_BUCKETS.filter((b) => b.mid <= maxDays + 30);

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: 12,
          paddingLeft: 20,
          gap: 20,
          flexWrap: 'wrap',
        }}
      >
        {hasDtcc && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                backgroundColor: NDF_COLOR,
                display: 'inline-block',
              }}
            />
            DTCC (trades)
          </span>
        )}
        {hasFxe && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            <span
              style={{
                width: 14,
                height: 3,
                backgroundColor: FXE_COLOR,
                display: 'inline-block',
              }}
            />
            FXEmpire (mid)
          </span>
        )}
        <span style={{ fontSize: 12, color: '#999' }}>
          COP/USD NDF — Estructura de Plazos
        </span>
      </div>
      <ResponsiveContainer width="100%" height={400}>
        <ScatterChart margin={{ top: 10, right: 30, left: 20, bottom: 20 }}>
          <CartesianGrid
            strokeDasharray="6 4"
            stroke="#D3D3D3"
            vertical={false}
          />
          <XAxis
            dataKey="days"
            type="number"
            domain={[0, 'auto']}
            tick={{ fontSize: 12 }}
            tickLine={false}
            label={{ value: 'Días al vencimiento', position: 'bottom', offset: 5, fontSize: 12 }}
          />
          <YAxis
            dataKey="rate"
            type="number"
            domain={[minY, maxY]}
            tick={{ fontSize: 12 }}
            tickFormatter={(v: number) => v.toFixed(0)}
            tickLine={false}
            axisLine={false}
            label={{ value: 'COP/USD', angle: -90, position: 'insideLeft', offset: -5, fontSize: 12 }}
          />
          {tenorLines.map((t) => (
            <ReferenceLine
              key={t.label}
              x={t.mid}
              stroke="#ddd"
              strokeDasharray="3 3"
              label={{ value: t.label, position: 'top', fontSize: 11, fill: '#999' }}
            />
          ))}
          <Tooltip content={<CustomTooltip />} />
          {/* DTCC scatter */}
          {hasDtcc && (
            <Scatter
              data={scatterData}
              fill={NDF_COLOR}
              fillOpacity={0.7}
              r={5}
              name="DTCC"
            />
          )}
          {/* FXEmpire connected line */}
          {hasFxe && (
            <Scatter
              data={fxeLineData}
              fill={FXE_COLOR}
              stroke={FXE_COLOR}
              strokeWidth={2}
              r={6}
              shape="diamond"
              line={{ stroke: FXE_COLOR, strokeWidth: 2 }}
              name="FXEmpire"
            />
          )}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
