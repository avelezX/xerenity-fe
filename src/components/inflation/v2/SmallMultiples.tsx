'use client';

import React, { useEffect, useMemo } from 'react';
import styled from 'styled-components';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  YAxis,
} from 'recharts';
import useAppStore from 'src/store';

const TOTAL_ID = 1;
const TARGET = 3;
const BAND = 1;

const Wrap = styled.section`
  background: #fff;
  border: 1px solid #ECECEE;
  border-radius: 14px;
  padding: 18px 22px;
  margin-bottom: 18px;
  font-feature-settings: 'tnum' on;
`;

const Title = styled.h3`
  font-size: 14px; font-weight: 600; color: #212529; margin: 0 0 14px 0;
  letter-spacing: 0.2px; text-transform: uppercase;
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  @media (max-width: 1100px) { grid-template-columns: repeat(2, 1fr); }
`;

const Card = styled.div<{ tone: 'high' | 'mid' | 'low' | 'neutral' }>`
  border: 1px solid #ECECEE;
  border-left: 3px solid ${({ tone }) =>
    tone === 'high' ? '#B02A37' : tone === 'low' ? '#188754' : tone === 'mid' ? '#FFC106' : '#A6A6A6'};
  border-radius: 8px;
  padding: 10px 12px;
  display: flex; flex-direction: column; gap: 4px;
  min-height: 110px;
`;

const NameRow = styled.div`
  display: flex; justify-content: space-between; gap: 6px; align-items: baseline;
`;
const NameTxt = styled.div`
  font-size: 11px; font-weight: 600; color: #6E6B7B;
  text-transform: uppercase; letter-spacing: 0.3px;
  flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
`;
const PesoTxt = styled.div`
  font-size: 10px; color: #A6A6A6;
`;
const Big = styled.div<{ tone: 'high' | 'mid' | 'low' | 'neutral' }>`
  font-size: 22px; font-weight: 700; line-height: 1;
  color: ${({ tone }) =>
    tone === 'high' ? '#B02A37' : tone === 'low' ? '#188754' : '#212529'};
`;
const Small = styled.div`
  font-size: 11px; color: #6E6B7B;
`;
const Spark = styled.div`
  height: 36px; width: 100%; margin-top: auto;
`;

const fmtPct = (v: number | null | undefined) =>
  v == null || Number.isNaN(v) ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;

const tone = (yoy: number | null | undefined): 'high' | 'mid' | 'low' | 'neutral' => {
  if (yoy == null || Number.isNaN(yoy)) return 'neutral';
  if (yoy > TARGET + BAND) return 'high';
  if (yoy < TARGET - BAND) return 'low';
  return 'mid';
};

export default function SmallMultiples() {
  const canastas = useAppStore((s) => s.canastas);
  const seriesByCanasta = useAppStore((s) => s.seriesByCanasta);
  const setSelected = useAppStore((s) => s.setSelectedCanastaIds);

  // Cargar series para todas las divisiones (nivel 1, no Total, no subgrupos)
  useEffect(() => {
    if (canastas.length === 0) return;
    const divisionIds = canastas
      .filter((c) => c.id !== TOTAL_ID && (c.nivel === undefined || c.nivel === 1))
      .map((c) => c.id);
    if (divisionIds.length > 0) setSelected([TOTAL_ID, ...divisionIds]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canastas.length]);

  const cards = useMemo(() => {
    return canastas
      .filter((c) => c.id !== TOTAL_ID && (c.nivel === undefined || c.nivel === 1))
      .map((c) => {
        const ser = seriesByCanasta[c.id] || [];
        const last = ser[ser.length - 1];
        return {
          id: c.id,
          nombre: c.nombre,
          peso: c.peso,
          yoy: last?.yoy ?? null,
          mom: last?.mom ?? null,
          spark: ser.slice(-24).map((p) => ({ time: p.time, v: p.yoy })),
        };
      })
      .sort((a, b) => (b.yoy ?? -Infinity) - (a.yoy ?? -Infinity));
  }, [canastas, seriesByCanasta]);

  return (
    <Wrap>
      <Title>Las 12 divisiones · YoY actual y tendencia 24m</Title>
      <Grid>
        {cards.map((c) => {
          const t = tone(c.yoy);
          return (
            <Card key={c.id} tone={t}>
              <NameRow>
                <NameTxt title={c.nombre}>{c.nombre}</NameTxt>
                <PesoTxt>{(c.peso * 100).toFixed(1)}%</PesoTxt>
              </NameRow>
              <Big tone={t}>{fmtPct(c.yoy)}</Big>
              <Small>MoM {fmtPct(c.mom)}</Small>
              <Spark>
                <ResponsiveContainer>
                  <AreaChart data={c.spark} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                    <YAxis hide domain={['dataMin - 1', 'dataMax + 1']} />
                    <defs>
                      <linearGradient id={`grad-${c.id}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"
                          stopColor={t === 'high' ? '#B02A37' : t === 'low' ? '#188754' : '#FFC106'}
                          stopOpacity={0.35} />
                        <stop offset="100%"
                          stopColor={t === 'high' ? '#B02A37' : t === 'low' ? '#188754' : '#FFC106'}
                          stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area
                      type="monotone"
                      dataKey="v"
                      stroke={t === 'high' ? '#B02A37' : t === 'low' ? '#188754' : '#FFC106'}
                      strokeWidth={1.5}
                      fill={`url(#grad-${c.id})`}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </Spark>
            </Card>
          );
        })}
      </Grid>
    </Wrap>
  );
}
