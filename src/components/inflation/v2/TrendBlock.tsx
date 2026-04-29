'use client';

import React, { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
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

const TOTAL_ID = 1;

const Wrap = styled.section`
  background: #fff;
  border: 1px solid #ECECEE;
  border-radius: 14px;
  padding: 18px 22px;
  margin-bottom: 18px;
  font-feature-settings: 'tnum' on;
`;

const Header = styled.div`
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 12px; flex-wrap: wrap; gap: 12px;
`;

const Title = styled.h3`
  font-size: 14px; font-weight: 600; color: #212529; margin: 0;
  letter-spacing: 0.2px; text-transform: uppercase;
`;

const Toggle = styled.div`
  display: inline-flex; gap: 2px; padding: 2px;
  background: #F5F5F7; border-radius: 8px;
`;

const TogBtn = styled.button<{ active?: boolean }>`
  border: 0; background: ${({ active }) => (active ? '#fff' : 'transparent')};
  color: ${({ active }) => (active ? '#212529' : '#6E6B7B')};
  font-size: 11px; font-weight: ${({ active }) => (active ? 600 : 500)};
  padding: 6px 12px; border-radius: 6px; cursor: pointer;
  box-shadow: ${({ active }) => (active ? '0 1px 2px rgba(0,0,0,0.06)' : 'none')};
`;

const RANGES: { label: string; months: number | null }[] = [
  { label: '1A', months: 12 },
  { label: '3A', months: 36 },
  { label: '5A', months: 60 },
  { label: '10A', months: 120 },
  { label: '20A', months: 240 },
  { label: 'Max', months: null },
];

const VIEWS = [
  { id: 'yoy', label: 'YoY' },
  { id: 'mom', label: 'MoM' },
  { id: 'indice', label: 'Índice' },
] as const;

type ViewId = typeof VIEWS[number]['id'];

const fmtMonth = (s: string) => {
  const d = new Date(`${s}T00:00:00`);
  return d.toLocaleDateString('es-CO', { month: '2-digit', year: '2-digit' });
};

const fmtMonthLong = (s: string) => {
  const d = new Date(`${s}T00:00:00`);
  return d.toLocaleDateString('es-CO', { month: 'short', year: 'numeric' });
};

// Anotaciones macro inline
const ANNOTATIONS: { time: string; label: string }[] = [
  { time: '1991-12-01', label: 'Apertura económica' },
  { time: '1999-09-01', label: 'Crisis financiera local' },
  { time: '2008-09-01', label: 'Crisis subprime' },
  { time: '2015-12-01', label: 'Choque petrolero' },
  { time: '2020-04-01', label: 'COVID' },
  { time: '2022-12-01', label: 'Pico TRM/commodities' },
];

export default function TrendBlock() {
  const series = useAppStore((s) => s.seriesByCanasta[TOTAL_ID]);
  const loadSeries = useAppStore((s) => s.loadCanastaSeries);

  const [view, setView] = useState<ViewId>('yoy');
  const [rangeMonths, setRangeMonths] = useState<number | null>(120);

  useEffect(() => { loadSeries(TOTAL_ID); }, [loadSeries]);

  const data = useMemo(() => {
    if (!series) return [];
    const base = rangeMonths ? series.slice(-rangeMonths) : series;
    return base.map((p) => ({
      time: p.time,
      v: view === 'yoy' ? p.yoy : view === 'mom' ? p.mom : p.indice,
    }));
  }, [series, view, rangeMonths]);

  const visibleAnnotations = useMemo(() => {
    if (data.length === 0) return [];
    const start = data[0].time;
    const end = data[data.length - 1].time;
    return ANNOTATIONS.filter((a) => a.time >= start && a.time <= end);
  }, [data]);

  const isPercent = view !== 'indice';

  return (
    <Wrap>
      <Header>
        <Title>Tendencia · IPC Total Nacional</Title>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Toggle>
            {VIEWS.map((v) => (
              <TogBtn key={v.id} active={view === v.id} onClick={() => setView(v.id)}>{v.label}</TogBtn>
            ))}
          </Toggle>
          <Toggle>
            {RANGES.map((r) => (
              <TogBtn
                key={r.label}
                active={rangeMonths === r.months}
                onClick={() => setRangeMonths(r.months)}
              >{r.label}</TogBtn>
            ))}
          </Toggle>
        </div>
      </Header>

      <div style={{ width: '100%', height: 360 }}>
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="#786CF7" stopOpacity={0.32} />
                <stop offset="100%" stopColor="#786CF7" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#F1F1F2" strokeDasharray="3 3" />
            <XAxis
              dataKey="time"
              tickFormatter={fmtMonth}
              minTickGap={32}
              stroke="#A6A6A6"
              tick={{ fill: '#6E6B7B', fontSize: 11 }}
            />
            <YAxis
              tickFormatter={(v) => (isPercent ? `${v.toFixed(0)}%` : v.toFixed(0))}
              width={50}
              stroke="#A6A6A6"
              tick={{ fill: '#6E6B7B', fontSize: 11 }}
            />
            {view === 'yoy' && (
              <>
                <ReferenceArea y1={2} y2={4} fill="#A3CFBB" fillOpacity={0.18} />
                <ReferenceLine y={3} stroke="#469F76" strokeDasharray="4 4" />
              </>
            )}
            {isPercent && <ReferenceLine y={0} stroke="#A6A6A6" strokeDasharray="2 2" />}
            {visibleAnnotations.map((a) => (
              <ReferenceLine
                key={a.time}
                x={a.time}
                stroke="#B5B3BD"
                strokeDasharray="3 3"
                label={{
                  value: a.label,
                  position: 'top',
                  fill: '#6E6B7B',
                  fontSize: 10,
                  offset: 4,
                }}
              />
            ))}
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 6, borderColor: '#ECECEE' }}
              formatter={(v: number) => (isPercent ? `${v?.toFixed?.(2) ?? '—'}%` : v?.toFixed?.(2))}
              labelFormatter={fmtMonthLong}
            />
            <Area
              type="monotone"
              dataKey="v"
              stroke="#786CF7"
              strokeWidth={2}
              fill="url(#trendGrad)"
              isAnimationActive={false}
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Wrap>
  );
}
