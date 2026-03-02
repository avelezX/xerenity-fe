'use client';

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts';
import type { NDFCurvePoint } from 'src/types/condf';

type NDFDevalCurveChartProps = {
  data: NDFCurvePoint[];
};

const POSITIVE_COLOR = '#2ca02c';
const NEGATIVE_COLOR = '#dc3545';

/* eslint-disable @typescript-eslint/no-explicit-any */
const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: any[] }) => {
  if (!active || !payload || payload.length === 0) return null;
  const pt = payload[0].payload as NDFCurvePoint;

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
      <div style={{ fontWeight: 700, marginBottom: 4 }}>
        {pt.segment}
      </div>
      <div>
        <span style={{ fontWeight: 600 }}>Deval. Implicita:</span>{' '}
        <span
          style={{
            color: pt.fwdFwdDeval >= 0 ? POSITIVE_COLOR : NEGATIVE_COLOR,
            fontWeight: 700,
          }}
        >
          {pt.fwdFwdDeval >= 0 ? '+' : ''}
          {pt.fwdFwdDeval.toFixed(2)}%
        </span>
      </div>
      <div style={{ marginTop: 4, fontSize: 12, color: '#666' }}>
        NDF Rate: {pt.medianRate.toFixed(2)}
      </div>
      <div style={{ fontSize: 12, color: '#999' }}>
        {pt.tradeCount} trades | Vol: ${(pt.volumeUSD / 1e6).toFixed(1)}M
      </div>
    </div>
  );
};
/* eslint-enable @typescript-eslint/no-explicit-any */

export default function NDFDevalCurveChart({ data }: NDFDevalCurveChartProps) {
  if (data.length === 0) {
    return (
      <div
        style={{
          height: 350,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#999',
        }}
      >
        Datos insuficientes para calcular devaluacion forward-forward
        (se necesitan al menos 2 nodos tenor)
      </div>
    );
  }

  const vals = data.map((d) => d.fwdFwdDeval);
  const absMax = Math.max(...vals.map(Math.abs));
  const domainLimit = Math.ceil(absMax / 2) * 2 + 2;

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: 12,
          paddingLeft: 20,
          gap: 16,
        }}
      >
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
              height: 14,
              borderRadius: 2,
              backgroundColor: POSITIVE_COLOR,
              display: 'inline-block',
            }}
          />
          Devaluacion
        </span>
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
              height: 14,
              borderRadius: 2,
              backgroundColor: NEGATIVE_COLOR,
              display: 'inline-block',
            }}
          />
          Revaluacion
        </span>
        <span style={{ fontSize: 12, color: '#999' }}>
          Devaluacion Forward-Forward Implicita (Anualizada)
        </span>
      </div>
      <ResponsiveContainer width="100%" height={350}>
        <BarChart
          data={data}
          margin={{ top: 10, right: 30, left: 20, bottom: 20 }}
        >
          <CartesianGrid strokeDasharray="6 4" stroke="#D3D3D3" vertical={false} />
          <XAxis
            dataKey="segment"
            tick={{ fontSize: 12, fontWeight: 600 }}
            tickLine={false}
          />
          <YAxis
            domain={[-domainLimit, domainLimit]}
            tick={{ fontSize: 12 }}
            tickFormatter={(v: number) => `${v.toFixed(0)}%`}
            tickLine={false}
            axisLine={false}
            label={{
              value: 'Deval. %',
              angle: -90,
              position: 'insideLeft',
              offset: -5,
              fontSize: 12,
            }}
          />
          <ReferenceLine y={0} stroke="#666" strokeWidth={1} />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="fwdFwdDeval" radius={[4, 4, 0, 0]} maxBarSize={60}>
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.fwdFwdDeval >= 0 ? POSITIVE_COLOR : NEGATIVE_COLOR}
                fillOpacity={0.8}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
