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
import { USTYieldPoint, SOFRSwapPoint } from 'src/types/usrates';

type CurveKey = 'sofr' | 'nominal' | 'tips';

type ChartPoint = {
  months: number;
  sofr?: number;
  nominal?: number;
  tips?: number;
  spread?: number;
};

type CombinedUSDYieldCurveChartProps = {
  sofrData: SOFRSwapPoint[];
  ustData: USTYieldPoint[];
};

const CURVE_CONFIG: Record<CurveKey, { color: string; label: string }> = {
  sofr: { color: '#ff7f0e', label: 'SOFR Swaps' },
  nominal: { color: '#1f77b4', label: 'UST Nominal' },
  tips: { color: '#2ca02c', label: 'UST TIPS' },
};
const SPREAD_COLOR = '#e377c2';

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

const STANDARD_TICKS = [
  1, 3, 6, 12, 24, 36, 60, 84, 120, 180, 240, 360, 600,
];

type SimplePoint = { months: number; value: number };

function interpolateAt(
  points: SimplePoint[],
  targetMonths: number
): number | null {
  if (points.length < 2) return null;
  if (
    targetMonths < points[0].months ||
    targetMonths > points[points.length - 1].months
  )
    return null;

  const exact = points.find((p) => p.months === targetMonths);
  if (exact) return exact.value;

  const idx = points.findIndex(
    (p, i) =>
      i < points.length - 1 &&
      targetMonths > p.months &&
      targetMonths < points[i + 1].months
  );
  if (idx === -1) return null;
  const t =
    (targetMonths - points[idx].months) /
    (points[idx + 1].months - points[idx].months);
  return points[idx].value + t * (points[idx + 1].value - points[idx].value);
}

function buildChartData(
  sofrCurve: SimplePoint[],
  nominalCurve: SimplePoint[],
  tipsCurve: SimplePoint[],
  visible: Record<CurveKey, boolean>
): { data: ChartPoint[]; spreadLabel: string } {
  const pointMap = new Map<number, ChartPoint>();

  const addPoints = (curve: SimplePoint[], key: CurveKey) => {
    if (!visible[key]) return;
    curve.forEach((pt) => {
      if (!pointMap.has(pt.months)) {
        pointMap.set(pt.months, { months: pt.months });
      }
      const entry = pointMap.get(pt.months)!;
      (entry as Record<string, number | undefined>)[key] = pt.value;
    });
  };

  addPoints(sofrCurve, 'sofr');
  addPoints(nominalCurve, 'nominal');
  addPoints(tipsCurve, 'tips');

  // Compute spread when exactly 2 curves visible
  const activeKeys: CurveKey[] = (['sofr', 'nominal', 'tips'] as CurveKey[]).filter(
    (k) => visible[k]
  );
  let spreadLabel = '';

  if (activeKeys.length === 2) {
    const [keyA, keyB] = activeKeys;
    const curveMap: Record<CurveKey, SimplePoint[]> = {
      sofr: sofrCurve,
      nominal: nominalCurve,
      tips: tipsCurve,
    };
    const curveA = curveMap[keyA];
    const curveB = curveMap[keyB];
    spreadLabel = `${CURVE_CONFIG[keyA].label} - ${CURVE_CONFIG[keyB].label}`;

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
      curveA
        .filter((pt) => pt.months >= minOverlap && pt.months <= maxOverlap)
        .forEach((pt) => allMonths.add(pt.months));
      curveB
        .filter((pt) => pt.months >= minOverlap && pt.months <= maxOverlap)
        .forEach((pt) => allMonths.add(pt.months));

      Array.from(allMonths)
        .sort((a, b) => a - b)
        .forEach((m) => {
          const valA = interpolateAt(curveA, m);
          const valB = interpolateAt(curveB, m);
          if (valA != null && valB != null) {
            if (!pointMap.has(m)) {
              pointMap.set(m, { months: m });
            }
            const entry = pointMap.get(m)!;
            entry.spread = Math.round((valA - valB) * 100);
          }
        });
    }
  }

  const data = Array.from(pointMap.values()).sort(
    (a, b) => a.months - b.months
  );
  return { data, spreadLabel };
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
  const label = TENOR_LABELS[point.months] ?? `${point.months}M`;

  const entries: { curve: string; value: number; color: string }[] = [];
  if (point.sofr != null)
    entries.push({
      curve: 'SOFR Swap',
      value: point.sofr,
      color: CURVE_CONFIG.sofr.color,
    });
  if (point.nominal != null)
    entries.push({
      curve: 'UST Nominal',
      value: point.nominal,
      color: CURVE_CONFIG.nominal.color,
    });
  if (point.tips != null)
    entries.push({
      curve: 'UST TIPS',
      value: point.tips,
      color: CURVE_CONFIG.tips.color,
    });

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
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{label}</div>
      {entries.map((e) => (
        <div key={e.curve} style={{ marginBottom: 2 }}>
          <span style={{ color: e.color, fontWeight: 600 }}>{e.curve}</span>{' '}
          {e.value.toFixed(2)}%
        </div>
      ))}
      {point.spread != null && (
        <div
          style={{
            marginTop: 4,
            borderTop: '1px solid #eee',
            paddingTop: 4,
          }}
        >
          <span style={{ color: SPREAD_COLOR, fontWeight: 600 }}>Spread</span>{' '}
          {spreadLabel}: {point.spread > 0 ? '+' : ''}
          {point.spread} bps
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

export default function CombinedUSDYieldCurveChart({
  sofrData,
  ustData,
}: CombinedUSDYieldCurveChartProps) {
  const [visible, setVisible] = useState<Record<CurveKey, boolean>>({
    sofr: true,
    nominal: true,
    tips: true,
  });

  const { sofrCurve, nominalCurve, tipsCurve, latestDates } = useMemo(() => {
    // Get latest date for each dataset
    let sofrDate = '';
    sofrData.forEach((d) => {
      if (d.fecha > sofrDate) sofrDate = d.fecha;
    });

    let ustDate = '';
    ustData.forEach((d) => {
      if (d.fecha > ustDate) ustDate = d.fecha;
    });

    const sofr: SimplePoint[] = sofrData
      .filter((d) => d.fecha === sofrDate)
      .map((d) => ({ months: d.tenor_months, value: d.swap_rate }))
      .sort((a, b) => a.months - b.months);

    const nominal: SimplePoint[] = ustData
      .filter((d) => d.fecha === ustDate && d.curve_type === 'NOMINAL')
      .map((d) => ({ months: d.tenor_months, value: d.yield_value }))
      .sort((a, b) => a.months - b.months);

    const tips: SimplePoint[] = ustData
      .filter((d) => d.fecha === ustDate && d.curve_type === 'TIPS')
      .map((d) => ({ months: d.tenor_months, value: d.yield_value }))
      .sort((a, b) => a.months - b.months);

    return {
      sofrCurve: sofr,
      nominalCurve: nominal,
      tipsCurve: tips,
      latestDates: { sofr: sofrDate, ust: ustDate },
    };
  }, [sofrData, ustData]);

  const { data: chartData, spreadLabel } = useMemo(
    () => buildChartData(sofrCurve, nominalCurve, tipsCurve, visible),
    [sofrCurve, nominalCurve, tipsCurve, visible]
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
        No data available
      </div>
    );
  }

  const allYields = chartData.flatMap((d) =>
    [
      visible.sofr ? d.sofr : undefined,
      visible.nominal ? d.nominal : undefined,
      visible.tips ? d.tips : undefined,
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
        Select at least one curve
      </div>
    );
  }

  const BPS_STEP = 0.5;
  const minY =
    Math.floor(Math.min(...allYields) / BPS_STEP) * BPS_STEP - BPS_STEP;
  const maxY =
    Math.ceil(Math.max(...allYields) / BPS_STEP) * BPS_STEP + BPS_STEP;
  const yTicks: number[] = [];
  let t = minY;
  while (t <= maxY) {
    yTicks.push(Math.round(t * 100) / 100);
    t = Math.round((t + BPS_STEP) * 100) / 100;
  }

  const allMonths = chartData.map((d) => d.months);
  const minX = Math.min(...allMonths);
  const maxX = Math.max(...allMonths);
  const xTicks = STANDARD_TICKS.filter((v) => v >= minX && v <= maxX);

  const hasSpread = chartData.some((d) => d.spread != null);

  const dateDisplay = latestDates.sofr === latestDates.ust
    ? latestDates.sofr
    : `SOFR: ${latestDates.sofr} | UST: ${latestDates.ust}`;

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
        {(['sofr', 'nominal', 'tips'] as CurveKey[]).map((key) => (
          <CurveToggle
            key={key}
            curveKey={key}
            visible={visible[key]}
            onToggle={() => toggleCurve(key)}
          />
        ))}
        {hasSpread && (
          <span
            style={{
              fontSize: 13,
              color: SPREAD_COLOR,
              fontWeight: 600,
              marginLeft: 8,
            }}
          >
            ● Spread ({spreadLabel})
          </span>
        )}
        <span
          style={{
            marginLeft: 'auto',
            fontSize: 13,
            color: '#888',
            paddingRight: 20,
          }}
        >
          {dateDisplay}
        </span>
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
          <Tooltip
            content={<CustomTooltip spreadLabel={spreadLabel} />}
          />
          {visible.sofr && (
            <Line
              yAxisId="yield"
              name="SOFR Swaps"
              type="monotone"
              dataKey="sofr"
              stroke={CURVE_CONFIG.sofr.color}
              strokeWidth={2}
              dot={{ r: 4, fill: CURVE_CONFIG.sofr.color }}
              activeDot={{ r: 6 }}
              connectNulls
            />
          )}
          {visible.nominal && (
            <Line
              yAxisId="yield"
              name="UST Nominal"
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
              name="UST TIPS"
              type="monotone"
              dataKey="tips"
              stroke={CURVE_CONFIG.tips.color}
              strokeWidth={2}
              dot={{ r: 4, fill: CURVE_CONFIG.tips.color }}
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
