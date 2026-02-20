'use client';

import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { SOFRSwapPoint } from 'src/types/usrates';

type ChartPoint = {
  months: number;
  rate: number;
};

type SOFRSwapCurveChartProps = {
  data: SOFRSwapPoint[];
};

const SOFR_COLOR = '#ff7f0e';

const TENOR_LABELS: Record<number, string> = {
  1: '1M',
  3: '3M',
  6: '6M',
  9: '9M',
  12: '1Y',
  18: '18M',
  24: '2Y',
  36: '3Y',
  48: '4Y',
  60: '5Y',
  72: '6Y',
  84: '7Y',
  96: '8Y',
  108: '9Y',
  120: '10Y',
  144: '12Y',
  180: '15Y',
  240: '20Y',
  300: '25Y',
  360: '30Y',
  480: '40Y',
  600: '50Y',
};

function buildChartData(data: SOFRSwapPoint[]): ChartPoint[] {
  const rateMap = new Map<number, number>();
  data.forEach((pt) => {
    rateMap.set(pt.tenor_months, pt.swap_rate);
  });

  return Array.from(rateMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([months, rate]) => ({ months, rate }));
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
      <div>
        <span style={{ color: SOFR_COLOR, fontWeight: 600 }}>SOFR Swap</span>
        {' '}
        {pt.rate.toFixed(4)}%
      </div>
    </div>
  );
};

export default function SOFRSwapCurveChart({ data }: SOFRSwapCurveChartProps) {
  const latestDate = useMemo(() => {
    if (data.length === 0) return '';
    return data.reduce(
      (max, d) => (d.fecha > max ? d.fecha : max),
      data[0].fecha
    );
  }, [data]);

  const latestData = useMemo(
    () => data.filter((d) => d.fecha === latestDate),
    [data, latestDate]
  );

  const chartData = useMemo(() => buildChartData(latestData), [latestData]);

  if (chartData.length === 0) {
    return (
      <div
        style={{
          height: 500,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#999',
        }}
      >
        No SOFR swap data available
      </div>
    );
  }

  const allRates = chartData.map((d) => d.rate);
  const BPS_STEP = 0.25;
  const minY =
    Math.floor(Math.min(...allRates) / BPS_STEP) * BPS_STEP - BPS_STEP;
  const maxY =
    Math.ceil(Math.max(...allRates) / BPS_STEP) * BPS_STEP + BPS_STEP;
  const yTicks: number[] = [];
  let tick = minY;
  while (tick <= maxY) {
    yTicks.push(Math.round(tick * 100) / 100);
    tick = Math.round((tick + BPS_STEP) * 100) / 100;
  }

  const xTicks = chartData.map((d) => d.months);

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: 12,
          paddingLeft: 20,
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          <span
            style={{
              width: 14,
              height: 14,
              borderRadius: 3,
              backgroundColor: SOFR_COLOR,
              display: 'inline-block',
            }}
          />
          SOFR OIS Par Swap Rate
        </span>
        <span
          style={{
            marginLeft: 'auto',
            fontSize: 13,
            color: '#888',
            paddingRight: 20,
          }}
        >
          {latestDate}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={500}>
        <LineChart
          data={chartData}
          margin={{ top: 10, right: 30, left: 20, bottom: 20 }}
        >
          <CartesianGrid
            strokeDasharray="6 4"
            stroke="#D3D3D3"
            vertical={false}
          />
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
            domain={[minY, maxY]}
            ticks={yTicks}
            tick={{ fontSize: 12 }}
            tickFormatter={(v: number) => `${v.toFixed(2)}%`}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="rate"
            stroke={SOFR_COLOR}
            strokeWidth={2.5}
            dot={{ r: 4, fill: SOFR_COLOR }}
            activeDot={{ r: 6 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
