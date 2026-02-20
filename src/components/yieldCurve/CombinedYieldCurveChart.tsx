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
import { GridEntry } from 'src/types/tes';

type CurveKey = 'cop' | 'uvr' | 'ibr';

type CurvePoint = { months: number; yield: number; name: string };

type ChartPoint = {
  months: number;
  cop?: number;
  uvr?: number;
  ibr?: number;
  spread?: number;
  copName?: string;
  uvrName?: string;
  ibrName?: string;
};

type CombinedYieldCurveChartProps = {
  copData: GridEntry[];
  uvrData: GridEntry[];
  ibrData: GridEntry[];
};

const CURVE_CONFIG: Record<CurveKey, { color: string; label: string }> = {
  cop: { color: '#1f77b4', label: 'COLTES COP' },
  uvr: { color: '#2ca02c', label: 'COLTES UVR' },
  ibr: { color: '#6366F1', label: 'Swaps IBR' },
};
const SPREAD_COLOR = '#e377c2';

const STANDARD_TICKS = [1, 3, 6, 12, 18, 24, 36, 60, 84, 120, 180, 240, 360];
const TICK_LABELS: Record<number, string> = {
  1: '1M', 3: '3M', 6: '6M', 12: '1Y', 18: '18M', 24: '2Y',
  36: '3Y', 60: '5Y', 84: '7Y', 120: '10Y', 180: '15Y', 240: '20Y', 360: '30Y',
};

function parseMaturityFromDisplayName(displayname: string): Date | null {
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

function monthsBetween(from: Date, to: Date): number {
  return (
    (to.getFullYear() - from.getFullYear()) * 12 +
    (to.getMonth() - from.getMonth()) +
    (to.getDate() - from.getDate()) / 30
  );
}

function getBusinessDaysAgo(days: number): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  let count = 0;
  while (count < days) {
    date.setDate(date.getDate() - 1);
    const dow = date.getDay();
    if (dow !== 0 && dow !== 6) count++;
  }
  return date;
}

function buildCurvePoints(data: GridEntry[], type: CurveKey): CurvePoint[] {
  const now = new Date();

  if (type === 'ibr') {
    const cutoff = getBusinessDaysAgo(5);
    return data
      .filter((e) => {
        if (e.tes_months <= 0 || e.close <= 0) return false;
        return new Date(e.operation_time) >= cutoff;
      })
      .map((e) => ({ months: e.tes_months, yield: e.close, name: e.displayname }))
      .sort((a, b) => a.months - b.months);
  }

  const points: CurvePoint[] = [];
  for (const entry of data) {
    const maturity = parseMaturityFromDisplayName(entry.displayname);
    if (!maturity || maturity <= now || entry.close <= 0) continue;
    points.push({
      months: Math.round(monthsBetween(now, maturity)),
      yield: entry.close,
      name: entry.displayname,
    });
  }
  return points.sort((a, b) => a.months - b.months);
}

function interpolateAt(points: CurvePoint[], targetMonths: number): number | null {
  if (points.length < 2) return null;
  if (targetMonths < points[0].months || targetMonths > points[points.length - 1].months)
    return null;

  const exact = points.find((p) => p.months === targetMonths);
  if (exact) return exact.yield;

  for (let i = 0; i < points.length - 1; i++) {
    if (targetMonths > points[i].months && targetMonths < points[i + 1].months) {
      const t = (targetMonths - points[i].months) / (points[i + 1].months - points[i].months);
      return points[i].yield + t * (points[i + 1].yield - points[i].yield);
    }
  }
  return null;
}

function buildChartData(
  curves: Record<CurveKey, CurvePoint[]>,
  visible: Record<CurveKey, boolean>
): { data: ChartPoint[]; spreadLabel: string } {
  const points: ChartPoint[] = [];

  // Add points for each visible curve
  const keys: CurveKey[] = ['cop', 'uvr', 'ibr'];
  for (const key of keys) {
    if (!visible[key]) continue;
    for (const pt of curves[key]) {
      points.push({
        months: pt.months,
        [key]: pt.yield,
        [`${key}Name`]: pt.name,
      });
    }
  }

  points.sort((a, b) => a.months - b.months);

  // Compute spread when exactly 2 curves are visible
  const activeKeys = keys.filter((k) => visible[k]);
  let spreadLabel = '';

  if (activeKeys.length === 2) {
    const [keyA, keyB] = activeKeys;
    const curveA = curves[keyA];
    const curveB = curves[keyB];
    spreadLabel = `${CURVE_CONFIG[keyA].label} - ${CURVE_CONFIG[keyB].label}`;

    // Collect all unique months from both curves within overlapping range
    const minOverlap = Math.max(
      curveA[0]?.months ?? Infinity,
      curveB[0]?.months ?? Infinity
    );
    const maxOverlap = Math.min(
      curveA[curveA.length - 1]?.months ?? -Infinity,
      curveB[curveB.length - 1]?.months ?? -Infinity
    );

    if (minOverlap <= maxOverlap) {
      const allMonths = new Set<number>();
      for (const pt of curveA) {
        if (pt.months >= minOverlap && pt.months <= maxOverlap) allMonths.add(pt.months);
      }
      for (const pt of curveB) {
        if (pt.months >= minOverlap && pt.months <= maxOverlap) allMonths.add(pt.months);
      }

      const sortedMonths = Array.from(allMonths).sort((a, b) => a - b);
      for (const m of sortedMonths) {
        const valA = interpolateAt(curveA, m);
        const valB = interpolateAt(curveB, m);
        if (valA != null && valB != null) {
          // Find the existing point at this month or add a new one
          let existing = points.find((p) => p.months === m);
          if (!existing) {
            existing = { months: m };
            points.push(existing);
          }
          existing.spread = Math.round((valA - valB) * 100); // in bps
        }
      }

      points.sort((a, b) => a.months - b.months);
    }
  }

  return { data: points, spreadLabel };
}

const CustomTooltip = ({
  active,
  payload,
  spreadLabel,
}: {
  active?: boolean;
  payload?: { payload: ChartPoint }[];
  spreadLabel: string;
}) => {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;

  const entries: { curve: string; name: string; yld: number; color: string }[] = [];
  if (point.cop != null)
    entries.push({ curve: 'COP', name: point.copName ?? '', yld: point.cop, color: CURVE_CONFIG.cop.color });
  if (point.uvr != null)
    entries.push({ curve: 'UVR', name: point.uvrName ?? '', yld: point.uvr, color: CURVE_CONFIG.uvr.color });
  if (point.ibr != null)
    entries.push({ curve: 'IBR', name: point.ibrName ?? '', yld: point.ibr, color: CURVE_CONFIG.ibr.color });

  if (entries.length === 0 && point.spread == null) return null;

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
      {entries.map((e) => (
        <div key={e.curve} style={{ marginBottom: 2 }}>
          <span style={{ color: e.color, fontWeight: 600 }}>{e.curve}</span>
          {' '}{e.name} — {e.yld.toFixed(3)}%
        </div>
      ))}
      {point.spread != null && (
        <div style={{ marginTop: 4, borderTop: '1px solid #eee', paddingTop: 4 }}>
          <span style={{ color: SPREAD_COLOR, fontWeight: 600 }}>Spread</span>
          {' '}{spreadLabel}: {point.spread > 0 ? '+' : ''}{point.spread} bps
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

export default function CombinedYieldCurveChart({
  copData,
  uvrData,
  ibrData,
}: CombinedYieldCurveChartProps) {
  const [visible, setVisible] = useState<Record<CurveKey, boolean>>({
    cop: true,
    uvr: true,
    ibr: true,
  });

  const curves = useMemo(
    () => ({
      cop: buildCurvePoints(copData, 'cop'),
      uvr: buildCurvePoints(uvrData, 'uvr'),
      ibr: buildCurvePoints(ibrData, 'ibr'),
    }),
    [copData, uvrData, ibrData]
  );

  const { data: chartData, spreadLabel } = useMemo(
    () => buildChartData(curves, visible),
    [curves, visible]
  );

  const toggleCurve = (key: CurveKey) => {
    setVisible((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (chartData.length === 0) {
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
        No hay datos para las curvas
      </div>
    );
  }

  // Y-axis: 50bps ticks based on visible yields
  const allYields = chartData.flatMap((d) =>
    [
      visible.cop ? d.cop : undefined,
      visible.uvr ? d.uvr : undefined,
      visible.ibr ? d.ibr : undefined,
    ].filter((v): v is number => v != null)
  );

  if (allYields.length === 0) {
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
        Seleccione al menos una curva
      </div>
    );
  }

  const BPS_STEP = 0.5;
  const minY = Math.floor(Math.min(...allYields) / BPS_STEP) * BPS_STEP - BPS_STEP;
  const maxY = Math.ceil(Math.max(...allYields) / BPS_STEP) * BPS_STEP + BPS_STEP;
  const yTicks: number[] = [];
  for (let t = minY; t <= maxY; t = Math.round((t + BPS_STEP) * 100) / 100) {
    yTicks.push(t);
  }

  // X-axis: standard tenor ticks within data range
  const allMonths = chartData.map((d) => d.months);
  const minX = Math.min(...allMonths);
  const maxX = Math.max(...allMonths);
  const xTicks = STANDARD_TICKS.filter((t) => t >= minX && t <= maxX);

  const hasSpread = chartData.some((d) => d.spread != null);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12, paddingLeft: 20 }}>
        {(['cop', 'uvr', 'ibr'] as CurveKey[]).map((key) => (
          <CurveToggle
            key={key}
            curveKey={key}
            visible={visible[key]}
            onToggle={() => toggleCurve(key)}
          />
        ))}
        {hasSpread && (
          <span style={{ fontSize: 13, color: SPREAD_COLOR, fontWeight: 600, marginLeft: 8 }}>
            ● Spread ({spreadLabel})
          </span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={600}>
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
            domain={[minX, maxX]}
            ticks={xTicks}
            tickFormatter={(v: number) => TICK_LABELS[v] ?? `${v}M`}
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
          {hasSpread && (
            <YAxis
              yAxisId="spread"
              orientation="right"
              tick={{ fontSize: 11, fill: SPREAD_COLOR }}
              tickFormatter={(v: number) => `${v}bps`}
              tickLine={false}
              axisLine={false}
            />
          )}
          <Tooltip content={<CustomTooltip spreadLabel={spreadLabel} />} />
          {visible.cop && (
            <Line
              yAxisId="yield"
              name="COLTES COP"
              type="monotone"
              dataKey="cop"
              stroke={CURVE_CONFIG.cop.color}
              strokeWidth={2}
              dot={{ r: 4, fill: CURVE_CONFIG.cop.color }}
              activeDot={{ r: 6 }}
              connectNulls
            />
          )}
          {visible.uvr && (
            <Line
              yAxisId="yield"
              name="COLTES UVR"
              type="monotone"
              dataKey="uvr"
              stroke={CURVE_CONFIG.uvr.color}
              strokeWidth={2}
              dot={{ r: 4, fill: CURVE_CONFIG.uvr.color }}
              activeDot={{ r: 6 }}
              connectNulls
            />
          )}
          {visible.ibr && (
            <Line
              yAxisId="yield"
              name="Swaps IBR"
              type="monotone"
              dataKey="ibr"
              stroke={CURVE_CONFIG.ibr.color}
              strokeWidth={2}
              dot={{ r: 4, fill: CURVE_CONFIG.ibr.color }}
              activeDot={{ r: 6 }}
              connectNulls
            />
          )}
          {hasSpread && (
            <Line
              yAxisId="spread"
              name="Spread"
              type="monotone"
              dataKey="spread"
              stroke={SPREAD_COLOR}
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
