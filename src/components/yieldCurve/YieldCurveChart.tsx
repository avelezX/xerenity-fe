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
import { GridEntry } from 'src/types/tes';

type YieldPoint = {
  label: string;
  yield: number;
  sortKey: number;
  displayname: string;
  volume: number;
  lastTradeDay: string;
};

type YieldCurveChartProps = {
  data: GridEntry[];
  curveType: string;
};

function parseMaturityFromDisplayName(displayname: string): Date | null {
  // Format: "COLTES 6.25 11/26/25" → extract "11/26/25"
  const parts = displayname.split(' ');
  const datePart = parts[parts.length - 1];
  const match = datePart.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!match) return null;
  const month = parseInt(match[1], 10);
  const day = parseInt(match[2], 10);
  let year = parseInt(match[3], 10);
  if (year < 100) year += 2000;
  return new Date(year, month - 1, day);
}

function formatTenorLabel(months: number): string {
  if (months < 12) return `${months}M`;
  if (months === 18) return '18M';
  return `${Math.round(months / 12)}Y`;
}

function formatMaturityLabel(date: Date): string {
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear().toString().slice(-2);
  return `${month}/${year}`;
}

function getBusinessDaysAgo(days: number): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  let count = 0;
  while (count < days) {
    date.setDate(date.getDate() - 1);
    const dow = date.getDay();
    if (dow !== 0 && dow !== 6) count += 1;
  }
  return date;
}

function formatTradeDay(isoString: string): string {
  if (!isoString) return '';
  const d = new Date(isoString);
  const mm = (d.getMonth() + 1).toString().padStart(2, '0');
  const dd = d.getDate().toString().padStart(2, '0');
  const yy = d.getFullYear().toString().slice(-2);
  return `${mm}/${dd}/${yy}`;
}

function buildYieldCurveData(
  data: GridEntry[],
  curveType: string
): YieldPoint[] {
  if (curveType === 'COLTES-IBR') {
    // IBR: only show tenors traded in last 5 business days
    const cutoff = getBusinessDaysAgo(5);
    return data
      .filter((entry) => {
        if (entry.tes_months <= 0 || entry.close <= 0) return false;
        const tradeDate = new Date(entry.operation_time);
        return tradeDate >= cutoff;
      })
      .map((entry) => ({
        label: formatTenorLabel(entry.tes_months),
        yield: entry.close,
        sortKey: entry.tes_months,
        displayname: entry.displayname,
        volume: entry.volume,
        lastTradeDay: formatTradeDay(entry.operation_time),
      }))
      .sort((a, b) => a.sortKey - b.sortKey);
  }

  // COLTES COP/UVR: parse maturity from displayname, exclude expired bonds
  const now = new Date();
  return data
    .filter((entry) => {
      const maturity = parseMaturityFromDisplayName(entry.displayname);
      return maturity && maturity > now && entry.close > 0;
    })
    .map((entry) => {
      const maturity = parseMaturityFromDisplayName(entry.displayname)!;
      return {
        label: formatMaturityLabel(maturity),
        yield: entry.close,
        sortKey: maturity.getTime(),
        displayname: entry.displayname,
        volume: entry.volume,
        lastTradeDay: formatTradeDay(entry.operation_time),
      };
    })
    .sort((a, b) => a.sortKey - b.sortKey);
}

const CustomTooltip = ({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: YieldPoint }[];
}) => {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;
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
      <p style={{ margin: 0, fontWeight: 600 }}>{point.displayname}</p>
      <p style={{ margin: 0 }}>Yield: {point.yield.toFixed(3)}%</p>
      <p style={{ margin: 0, color: '#888' }}>
        Vol: {point.volume.toLocaleString()}
      </p>
      {point.lastTradeDay && (
        <p style={{ margin: 0, color: '#888' }}>
          Last Trade: {point.lastTradeDay}
        </p>
      )}
    </div>
  );
};

export default function YieldCurveChart({
  data,
  curveType,
}: YieldCurveChartProps) {
  const curveData = useMemo(
    () => buildYieldCurveData(data, curveType),
    [data, curveType]
  );

  if (curveData.length === 0) {
    return (
      <div
        style={{
          height: 600,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#999',
        }}
      >
        No hay datos para la curva
      </div>
    );
  }

  const yields = curveData.map((d) => d.yield);
  const BPS_STEP = 0.5; // 50bps
  const minY = Math.floor(Math.min(...yields) / BPS_STEP) * BPS_STEP - BPS_STEP;
  const maxY = Math.ceil(Math.max(...yields) / BPS_STEP) * BPS_STEP + BPS_STEP;

  // Generate ticks every 50bps
  const yTicks: number[] = [];
  for (let t = minY; t <= maxY; t = Math.round((t + BPS_STEP) * 100) / 100) {
    yTicks.push(t);
  }

  // Build a lookup from sortKey → label for the x-axis tick formatter
  const xTickValues = curveData.map((d) => d.sortKey);
  const labelMap = new Map(curveData.map((d) => [d.sortKey, d.label]));

  return (
    <ResponsiveContainer width="100%" height={600}>
      <LineChart
        data={curveData}
        margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
      >
        <CartesianGrid
          strokeDasharray="6 4"
          stroke="#D3D3D3"
          vertical={false}
        />
        <XAxis
          dataKey="sortKey"
          type="number"
          domain={['dataMin', 'dataMax']}
          ticks={xTickValues}
          tickFormatter={(v: number) => labelMap.get(v) ?? ''}
          tick={{ fontSize: 12 }}
          angle={-45}
          textAnchor="end"
          height={60}
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
          dataKey="yield"
          stroke="#6366F1"
          strokeWidth={2}
          dot={{ r: 4, fill: '#6366F1' }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
