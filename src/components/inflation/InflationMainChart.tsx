import React, { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceArea,
  ReferenceLine,
  Legend,
} from 'recharts';
import useAppStore from 'src/store';
import Panel from '@components/Panel';
import { CPIPoint, InflationView } from 'src/types/inflation';
import { getHexColor } from 'src/utils/getHexColors';
import {
  ChipRow,
  Chip,
  SegmentedRow,
  SegmentedButton,
  SectionTitle,
} from './styled';

const TOTAL_ID = 1;
const VIEWS: { id: InflationView; label: string }[] = [
  { id: 'yoy', label: 'YoY' },
  { id: 'mom', label: 'MoM' },
  { id: 'ytd', label: 'YTD' },
  { id: 'indice', label: 'Índice' },
];

const RANGES: { label: string; months: number | null }[] = [
  { label: '1A', months: 12 },
  { label: '3A', months: 36 },
  { label: '5A', months: 60 },
  { label: '10A', months: 120 },
  { label: 'Max', months: null },
];

const fmtTick = (v: number) => `${v.toFixed(1)}%`;
const fmtTickIdx = (v: number) => v.toFixed(0);
const fmtMonth = (s: string) => {
  const d = new Date(`${s}T00:00:00`);
  return d.toLocaleDateString('es-CO', { month: '2-digit', year: '2-digit' });
};

interface Row {
  time: string;
  [k: string]: number | string | null;
}

export default function InflationMainChart() {
  const canastas = useAppStore((s) => s.canastas);
  const selected = useAppStore((s) => s.selectedCanastaIds);
  const seriesByCanasta = useAppStore((s) => s.seriesByCanasta);
  const toggleCanasta = useAppStore((s) => s.toggleCanasta);
  const setSelected = useAppStore((s) => s.setSelectedCanastaIds);

  const [view, setView] = useState<InflationView>('yoy');
  const [rangeMonths, setRangeMonths] = useState<number | null>(60);

  useEffect(() => {
    if (selected.length === 0) {
      setSelected([TOTAL_ID]);
    }
  }, [selected.length, setSelected]);

  const colorByCanasta = useMemo(() => {
    const m: Record<number, string> = {};
    canastas.forEach((c, i) => {
      m[c.id] = c.id === TOTAL_ID ? '#786CF7' : getHexColor(i + 1);
    });
    return m;
  }, [canastas]);

  const merged: Row[] = useMemo(() => {
    if (selected.length === 0) return [];
    const allTimes = new Set<string>();
    selected.forEach((id) => {
      (seriesByCanasta[id] || []).forEach((p) => allTimes.add(p.time));
    });
    const sortedTimes = Array.from(allTimes).sort();
    const cutoff = rangeMonths
      ? new Date(
          new Date(sortedTimes[sortedTimes.length - 1] || Date.now())
            .getTime() -
            rangeMonths * 30.5 * 86400 * 1000
        )
          .toISOString()
          .slice(0, 10)
      : null;
    const filteredTimes = cutoff
      ? sortedTimes.filter((t) => t >= cutoff)
      : sortedTimes;

    const indexBySeries: Record<number, Map<string, CPIPoint>> = {};
    selected.forEach((id) => {
      const map = new Map<string, CPIPoint>();
      (seriesByCanasta[id] || []).forEach((p) => map.set(p.time, p));
      indexBySeries[id] = map;
    });

    return filteredTimes.map((time) => {
      const row: Row = { time };
      selected.forEach((id) => {
        const p = indexBySeries[id].get(time);
        const v = p ? (p[view] as number | null) : null;
        row[`s_${id}`] = v;
      });
      return row;
    });
  }, [selected, seriesByCanasta, view, rangeMonths]);

  const isPercent = view !== 'indice';
  const showBanrepBand = view === 'yoy' && selected.includes(TOTAL_ID);

  const tooltipFmt = (v: unknown) => {
    if (typeof v !== 'number') return '—';
    return isPercent ? `${v.toFixed(2)}%` : v.toFixed(2);
  };

  const labelFor = (id: number) =>
    canastas.find((c) => c.id === id)?.nombre || `#${id}`;

  return (
    <Panel>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 12, flexWrap: 'wrap' }}>
        <SectionTitle style={{ margin: 0 }}>Series IPC</SectionTitle>
        <div style={{ display: 'flex', gap: 8 }}>
          <SegmentedRow>
            {VIEWS.map((v) => (
              <SegmentedButton
                key={v.id}
                active={view === v.id}
                onClick={() => setView(v.id)}
              >
                {v.label}
              </SegmentedButton>
            ))}
          </SegmentedRow>
          <SegmentedRow>
            {RANGES.map((r) => (
              <SegmentedButton
                key={r.label}
                active={rangeMonths === r.months}
                onClick={() => setRangeMonths(r.months)}
              >
                {r.label}
              </SegmentedButton>
            ))}
          </SegmentedRow>
        </div>
      </div>

      <ChipRow style={{ marginBottom: 12 }}>
        {canastas.map((c) => {
          const active = selected.includes(c.id);
          return (
            <Chip
              key={c.id}
              active={active}
              color={colorByCanasta[c.id]}
              onClick={() => toggleCanasta(c.id)}
              title={`${c.nombre} (peso ${(c.peso * 100).toFixed(2)}%)`}
            >
              {c.nombre}
            </Chip>
          );
        })}
      </ChipRow>

      <div style={{ width: '100%', height: 360 }}>
        <ResponsiveContainer>
          <LineChart data={merged} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#eee" strokeDasharray="3 3" />
            <XAxis dataKey="time" tickFormatter={fmtMonth} minTickGap={32} />
            <YAxis
              tickFormatter={isPercent ? fmtTick : fmtTickIdx}
              width={56}
            />
            {showBanrepBand && (
              <ReferenceArea
                y1={2}
                y2={4}
                fill="#75B798"
                fillOpacity={0.1}
                ifOverflow="extendDomain"
              />
            )}
            {showBanrepBand && (
              <ReferenceLine y={3} stroke="#469F76" strokeDasharray="4 4" />
            )}
            {isPercent && (
              <ReferenceLine y={0} stroke="#a6a6a6" strokeDasharray="2 2" />
            )}
            <Tooltip
              formatter={tooltipFmt}
              labelFormatter={(label: string) => fmtMonth(label)}
            />
            <Legend
              verticalAlign="bottom"
              iconType="line"
              wrapperStyle={{ fontSize: 12 }}
              formatter={(value) => {
                const id = Number(String(value).replace('s_', ''));
                return labelFor(id);
              }}
            />
            {selected.map((id) => (
              <Line
                key={id}
                type="monotone"
                dataKey={`s_${id}`}
                stroke={colorByCanasta[id]}
                strokeWidth={id === TOTAL_ID ? 2.4 : 1.6}
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}
