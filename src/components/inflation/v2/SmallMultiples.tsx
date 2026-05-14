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
import {
  Tone,
  toneFromYoy,
  toneText,
  toneBorder,
  toneAccent,
} from './toneColors';

const TOTAL_ID = 1;

interface Props {
  selectedDivisionId?: number | null;
  onSelectDivision?: (id: number) => void;
}

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

const Card = styled.button<{ $tone: Tone; $active?: boolean }>`
  border: 1px solid ${({ $active }) => ($active ? '#786CF7' : '#ECECEE')};
  border-left: 3px solid ${({ $tone }) => toneBorder($tone)};
  border-radius: 8px;
  padding: 10px 12px;
  display: flex; flex-direction: column; gap: 4px;
  min-height: 110px;
  background: ${({ $active }) => ($active ? '#F4F2FE' : '#fff')};
  text-align: left;
  cursor: pointer;
  transition: background 120ms ease, border-color 120ms ease, transform 120ms ease;
  &:hover {
    background: ${({ $active }) => ($active ? '#F4F2FE' : '#FAFAFB')};
    border-color: ${({ $active }) => ($active ? '#786CF7' : '#D6D5DC')};
    transform: translateY(-1px);
  }
  &:focus-visible {
    outline: 2px solid #786CF7;
    outline-offset: 2px;
  }
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
const Big = styled.div<{ $tone: Tone }>`
  font-size: 22px; font-weight: 700; line-height: 1;
  color: ${({ $tone }) => toneText($tone)};
`;
const Small = styled.div`
  font-size: 11px; color: #6E6B7B;
`;
const Spark = styled.div`
  height: 36px; width: 100%; margin-top: auto;
`;

const fmtPct = (v: number | null | undefined) => {
  if (v == null || Number.isNaN(v)) return '—';
  const sign = v >= 0 ? '+' : '';
  return `${sign}${v.toFixed(2)}%`;
};

export default function SmallMultiples({ selectedDivisionId, onSelectDivision }: Props) {
  const canastas = useAppStore((s) => s.canastas);
  const seriesByCanasta = useAppStore((s) => s.seriesByCanasta);
  const setSelected = useAppStore((s) => s.setSelectedCanastaIds);

  // Cargar series para todas las divisiones (nivel 1, no Total, no subgrupos)
  useEffect(() => {
    if (canastas.length === 0) return;
    const divisionIds = canastas
      .filter((c) => c.id !== TOTAL_ID && c.nivel === 1)
      .map((c) => c.id);
    if (divisionIds.length > 0) setSelected([TOTAL_ID, ...divisionIds]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canastas.length]);

  const cards = useMemo(() => canastas
    .filter((c) => c.id !== TOTAL_ID && c.nivel === 1)
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
    .sort((a, b) => (b.yoy ?? -Infinity) - (a.yoy ?? -Infinity)), [canastas, seriesByCanasta]);

  return (
    <Wrap>
      <Title>Las 12 divisiones · YoY actual y tendencia 24m{onSelectDivision ? ' · click para ver subgrupos' : ''}</Title>
      <Grid>
        {cards.map((c) => {
          const t = toneFromYoy(c.yoy);
          const accent = toneAccent(t);
          const active = selectedDivisionId === c.id;
          return (
            <Card
              key={c.id}
              $tone={t}
              $active={active}
              type="button"
              onClick={() => onSelectDivision?.(c.id)}
            >
              <NameRow>
                <NameTxt title={c.nombre}>{c.nombre}</NameTxt>
                <PesoTxt>{c.peso != null ? `${(c.peso * 100).toFixed(1)}%` : '—'}</PesoTxt>
              </NameRow>
              <Big $tone={t}>{fmtPct(c.yoy)}</Big>
              <Small>MoM {fmtPct(c.mom)}</Small>
              <Spark>
                <ResponsiveContainer>
                  <AreaChart data={c.spark} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                    <YAxis hide domain={['dataMin - 1', 'dataMax + 1']} />
                    <defs>
                      <linearGradient id={`grad-${c.id}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={accent} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={accent} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area
                      type="monotone"
                      dataKey="v"
                      stroke={accent}
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
