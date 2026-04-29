'use client';

import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
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
import { CORE_INFLATION_SERIES, fetchCoreInflationSeries } from 'src/models/inflation';

const Wrap = styled.section`
  background: #fff;
  border: 1px solid #ECECEE;
  border-radius: 14px;
  padding: 18px 22px;
  margin-bottom: 18px;
  font-feature-settings: 'tnum' on;
`;
const Header = styled.div`
  display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; flex-wrap: wrap;
`;
const Title = styled.h3`
  font-size: 14px; font-weight: 600; color: #212529; margin: 0;
  text-transform: uppercase; letter-spacing: 0.2px;
`;
const Sub = styled.div`
  font-size: 11px; color: #6E6B7B;
`;

const COLORS = ['#786CF7', '#188754', '#B02A37', '#FFC106', '#0D6EFD', '#6F42C1', '#E35D6A'];

const fmtMonth = (s: string) => {
  const d = new Date(`${s}T00:00:00`);
  return d.toLocaleDateString('es-CO', { month: '2-digit', year: '2-digit' });
};

const fmtMonthLong = (s: string) => {
  const d = new Date(`${s}T00:00:00`);
  return d.toLocaleDateString('es-CO', { month: 'short', year: 'numeric' });
};

interface Row {
  time: string;
  [k: string]: number | string | null;
}

export default function CoreInflationPanel() {
  const [data, setData] = useState<Row[]>([]);
  const [latest, setLatest] = useState<Record<number, number | null>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ids = CORE_INFLATION_SERIES.map((s) => s.id);
      const res = await fetchCoreInflationSeries(ids);
      if (cancelled || !res.data) return;
      // Merge by date
      const map = new Map<string, Row>();
      const last: Record<number, number | null> = {};
      res.data.forEach(({ id, values }) => {
        if (values.length) last[id] = values[values.length - 1].value;
        values.forEach((v) => {
          if (!map.has(v.time)) map.set(v.time, { time: v.time });
          (map.get(v.time) as Row)[`s${id}`] = v.value;
        });
      });
      const rows = Array.from(map.values()).sort((a, b) =>
        a.time.localeCompare(b.time as string)
      );
      // last 120 months
      setData(rows.slice(-120));
      setLatest(last);
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <Wrap>
      <Header>
        <Title>Inflación núcleo · medidas BanRep</Title>
        <Sub>Histórico 10 años · medidas que excluyen alimentos / regulados / núcleo 15-20</Sub>
      </Header>

      <div style={{ width: '100%', height: 320 }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#F1F1F2" strokeDasharray="3 3" />
            <XAxis dataKey="time" tickFormatter={fmtMonth} minTickGap={32}
              stroke="#A6A6A6" tick={{ fill: '#6E6B7B', fontSize: 11 }} />
            <YAxis tickFormatter={(v) => `${v.toFixed(0)}%`} width={42}
              stroke="#A6A6A6" tick={{ fill: '#6E6B7B', fontSize: 11 }} />
            <ReferenceArea y1={2} y2={4} fill="#A3CFBB" fillOpacity={0.18} />
            <ReferenceLine y={3} stroke="#469F76" strokeDasharray="4 4" />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 6, borderColor: '#ECECEE' }}
              formatter={(v: number) => `${v?.toFixed?.(2) ?? '—'}%`}
              labelFormatter={fmtMonthLong}
            />
            <Legend
              verticalAlign="bottom"
              iconType="line"
              wrapperStyle={{ fontSize: 11 }}
              formatter={(value) => {
                const id = Number(String(value).replace('s', ''));
                const meta = CORE_INFLATION_SERIES.find((m) => m.id === id);
                return meta ? meta.nombre.replace('Inflación ', '') : String(value);
              }}
            />
            {CORE_INFLATION_SERIES.map((s, i) => (
              <Line
                key={s.id}
                type="monotone"
                dataKey={`s${s.id}`}
                stroke={COLORS[i % COLORS.length]}
                strokeWidth={1.6}
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Wrap>
  );
}
