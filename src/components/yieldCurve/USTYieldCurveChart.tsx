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
} from 'recharts';
import { USTYieldPoint } from 'src/types/usrates';

type CurveKey = 'nominal' | 'tips';

type ChartPoint = {
  months: number;
  nominal?: number;
  tips?: number;
  breakeven?: number;
};

type USTYieldCurveChartProps = {
  data: USTYieldPoint[];
};

const CURVE_CONFIG: Record<CurveKey, { color: string; label: string }> = {
  nominal: { color: '#1f77b4', label: 'UST Nominal' },
  tips: { color: '#2ca02c', label: 'TIPS Real' },
};
const BREAKEVEN_COLOR = '#e377c2';

const TENOR_LABELS: Record<number, string> = {
  1: '1M', 2: '2M', 3: '3M', 4: '4M', 6: '6M',
  12: '1Y', 24: '2Y', 36: '3Y', 60: '5Y', 84: '7Y',
  120: '10Y', 240: '20Y', 360: '30Y',
};

function buildChartData(
  data: USTYieldPoint[],
  visible: Record<CurveKey, boolean>
): ChartPoint[] {
  const nominalMap = new Map<number, number>();
  const tipsMap = new Map<number, number>();

  data.forEach((pt) => {
    if (pt.curve_type === 'NOMINAL') nominalMap.set(pt.tenor_months, pt.yield_value);
    else if (pt.curve_type === 'TIPS') tipsMap.set(pt.tenor_months, pt.yield_value);
  });

  const allMonths = new Set<number>();
  if (visible.nominal) nominalMap.forEach((_, m) => allMonths.add(m));
  if (visible.tips) tipsMap.forEach((_, m) => allMonths.add(m));

  const sorted = Array.from(allMonths).sort((a, b) => a - b);

  return sorted.map((m) => {
    const nom = visible.nominal ? nominalMap.get(m) : undefined;
    const tip = visible.tips ? tipsMap.get(m) : undefined;
    const breakeven =
      visible.nominal && visible.tips && nom != null && tip != null
        ? Math.round((nom - tip) * 100) / 100
        : undefined;
    return { months: m, nominal: nom, tips: tip, breakeven };
  });
}

const CustomTooltip = ({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: ChartPoint }[];
}) => {
  if (!active || !payload || payload.length === 0) return null;
  const pt = payload[0].payload;
  const label = TENOR_LABELS[pt.months] ?? `${pt.months}M`;

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
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{label}</div>
      {pt.nominal != null && (
        <div>
          <span style={{ color: CURVE_CONFIG.nominal.color, fontWeight: 600 }}>Nominal</span>
          {' '}{pt.nominal.toFixed(2)}%
        </div>
      )}
      {pt.tips != null && (
        <div>
          <span style={{ color: CURVE_CONFIG.tips.color, fontWeight: 600 }}>TIPS</span>
          {' '}{pt.tips.toFixed(2)}%
        </div>
      )}
      {pt.breakeven != null && (
        <div style={{ marginTop: 4, borderTop: '1px solid #eee', paddingTop: 4 }}>
          <span style={{ color: BREAKEVEN_COLOR, fontWeight: 600 }}>Breakeven</span>
          {' '}{pt.breakeven.toFixed(2)}%
        </div>
      )}
    </div>
  );
};

function CurveToggle({
  curveKey,
  visible,
  onToggle,
}: {
  curveKey: CurveKey;
  visible: boolean;
  onToggle: () => void;
}) {
  const config = CURVE_CONFIG[curveKey];
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

export default function USTYieldCurveChart({ data }: USTYieldCurveChartProps) {
  const [visible, setVisible] = useState<Record<CurveKey, boolean>>({
    nominal: true,
    tips: true,
  });

  const latestDate = useMemo(() => {
    if (data.length === 0) return '';
    return data.reduce((max, d) => (d.fecha > max ? d.fecha : max), data[0].fecha);
  }, [data]);

  const latestData = useMemo(
    () => data.filter((d) => d.fecha === latestDate),
    [data, latestDate]
  );

  const chartData = useMemo(
    () => buildChartData(latestData, visible),
    [latestData, visible]
  );

  const hasBreakeven = chartData.some((d) => d.breakeven != null);

  if (chartData.length === 0) {
    return (
      <div style={{ height: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
        No yield curve data available
      </div>
    );
  }

  const allYields = chartData.flatMap((d) =>
    [d.nominal, d.tips].filter((v): v is number => v != null)
  );
  const BPS_STEP = 0.5;
  const minY = Math.floor(Math.min(...allYields) / BPS_STEP) * BPS_STEP - BPS_STEP;
  const maxY = Math.ceil(Math.max(...allYields) / BPS_STEP) * BPS_STEP + BPS_STEP;
  const yTicks: number[] = [];
  for (let t = minY; t <= maxY; t = Math.round((t + BPS_STEP) * 100) / 100) {
    yTicks.push(t);
  }

  const xTicks = chartData.map((d) => d.months);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12, paddingLeft: 20 }}>
        {(['nominal', 'tips'] as CurveKey[]).map((key) => (
          <CurveToggle
            key={key}
            curveKey={key}
            visible={visible[key]}
            onToggle={() => setVisible((prev) => ({ ...prev, [key]: !prev[key] }))}
          />
        ))}
        {hasBreakeven && (
          <span style={{ fontSize: 13, color: BREAKEVEN_COLOR, fontWeight: 600, marginLeft: 8 }}>
            ● Breakeven Inflation
          </span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 13, color: '#888', paddingRight: 20 }}>
          {latestDate}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={500}>
        <LineChart data={chartData} margin={{ top: 10, right: 30, left: 20, bottom: 20 }}>
          <CartesianGrid strokeDasharray="6 4" stroke="#D3D3D3" vertical={false} />
          <XAxis
            dataKey="months"
            type="number"
            domain={[xTicks[0], xTicks[xTicks.length - 1]]}
            ticks={xTicks}
            tickFormatter={(v: number) => TENOR_LABELS[v] ?? `${v}M`}
            tick={{ fontSize: 12 }}
            tickLine={false}
          />
          <YAxis
            yAxisId="yield"
            domain={[minY, maxY]}
            ticks={yTicks}
            tick={{ fontSize: 12 }}
            tickFormatter={(v: number) => `${v.toFixed(2)}%`}
            tickLine={false}
            axisLine={false}
          />
          {hasBreakeven && (
            <YAxis
              yAxisId="breakeven"
              orientation="right"
              tick={{ fontSize: 11, fill: BREAKEVEN_COLOR }}
              tickFormatter={(v: number) => `${v.toFixed(2)}%`}
              tickLine={false}
              axisLine={false}
            />
          )}
          <Tooltip content={<CustomTooltip />} />
          {visible.nominal && (
            <Line
              yAxisId="yield"
              type="monotone"
              dataKey="nominal"
              stroke={CURVE_CONFIG.nominal.color}
              strokeWidth={2}
              dot={{ r: 4, fill: CURVE_CONFIG.nominal.color }}
              activeDot={{ r: 6 }}
              connectNulls
            />
          )}
          {visible.tips && (
            <Line
              yAxisId="yield"
              type="monotone"
              dataKey="tips"
              stroke={CURVE_CONFIG.tips.color}
              strokeWidth={2}
              dot={{ r: 4, fill: CURVE_CONFIG.tips.color }}
              activeDot={{ r: 6 }}
              connectNulls
            />
          )}
          {hasBreakeven && (
            <Line
              yAxisId="breakeven"
              type="monotone"
              dataKey="breakeven"
              stroke={BREAKEVEN_COLOR}
              strokeWidth={1.5}
              strokeDasharray="6 3"
              dot={false}
              connectNulls
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
