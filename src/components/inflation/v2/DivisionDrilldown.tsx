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

interface Props {
  divisionId: number | null;
  onClose: () => void;
}

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
  margin-bottom: 14px; flex-wrap: wrap; gap: 12px;
`;

const Title = styled.h3`
  font-size: 14px; font-weight: 600; color: #212529; margin: 0;
  letter-spacing: 0.2px; text-transform: uppercase;
`;

const Caption = styled.div`
  font-size: 11px; color: #6E6B7B; margin-top: 2px;
`;

const CloseBtn = styled.button`
  background: #fff; border: 1px solid #DEDEDE; border-radius: 6px;
  padding: 4px 10px; font-size: 11px; color: #6E6B7B;
  cursor: pointer;
  &:hover { background: #F5F5F7; color: #212529; }
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  @media (max-width: 1100px) { grid-template-columns: repeat(2, 1fr); }
  @media (max-width: 700px)  { grid-template-columns: 1fr; }
`;

const Card = styled.div<{ $tone: Tone }>`
  border: 1px solid #ECECEE;
  border-left: 3px solid ${({ $tone }) => toneBorder($tone)};
  border-radius: 8px;
  padding: 10px 12px;
  display: flex; flex-direction: column; gap: 4px;
  min-height: 100px;
`;

const NameRow = styled.div`
  display: flex; justify-content: space-between; gap: 6px; align-items: baseline;
`;
const NameTxt = styled.div`
  font-size: 11px; font-weight: 600; color: #6E6B7B;
  text-transform: uppercase; letter-spacing: 0.3px;
  flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
`;
const Big = styled.div<{ $tone: Tone }>`
  font-size: 22px; font-weight: 700; line-height: 1;
  color: ${({ $tone }) => toneText($tone)};
`;
const Small = styled.div`
  font-size: 11px; color: #6E6B7B;
`;
const Spark = styled.div`
  height: 32px; width: 100%; margin-top: auto;
`;
const Empty = styled.div`
  text-align: center; padding: 24px; color: #A6A6A6; font-size: 12px;
`;

const fmtPct = (v: number | null | undefined) => {
  if (v == null || Number.isNaN(v)) return '—';
  const sign = v >= 0 ? '+' : '';
  return `${sign}${v.toFixed(2)}%`;
};

export default function DivisionDrilldown({ divisionId, onClose }: Props) {
  const canastas = useAppStore((s) => s.canastas);
  const seriesByCanasta = useAppStore((s) => s.seriesByCanasta);
  const loadCanastaSeries = useAppStore((s) => s.loadCanastaSeries);

  const parent = useMemo(
    () => canastas.find((c) => c.id === divisionId),
    [canastas, divisionId],
  );

  const children = useMemo(
    () => canastas.filter((c) => c.id_padre === divisionId),
    [canastas, divisionId],
  );

  useEffect(() => {
    if (!divisionId) return;
    children.forEach((c) => {
      loadCanastaSeries(c.id);
    });
  }, [divisionId, children, loadCanastaSeries]);

  const cards = useMemo(() => children.map((c) => {
    const ser = seriesByCanasta[c.id] || [];
    const last = ser[ser.length - 1];
    return {
      id: c.id,
      nombre: c.nombre,
      yoy: last?.yoy ?? null,
      mom: last?.mom ?? null,
      spark: ser.slice(-24).map((p) => ({ time: p.time, v: p.yoy })),
    };
  }).sort((a, b) => (b.yoy ?? -Infinity) - (a.yoy ?? -Infinity)),
  [children, seriesByCanasta]);

  if (!divisionId || !parent) return null;

  return (
    <Wrap>
      <Header>
        <div>
          <Title>Subgrupos · {parent.nombre}</Title>
          <Caption>{children.length} subgrupos COICOP nivel 2 · YoY actual</Caption>
        </div>
        <CloseBtn onClick={onClose}>× Cerrar</CloseBtn>
      </Header>
      {cards.length === 0 ? (
        <Empty>Esta división no expone subgrupos en el SEN del DANE.</Empty>
      ) : (
        <Grid>
          {cards.map((c) => {
            const t = toneFromYoy(c.yoy);
            const accent = toneAccent(t);
            return (
              <Card key={c.id} $tone={t}>
                <NameRow>
                  <NameTxt title={c.nombre}>{c.nombre}</NameTxt>
                </NameRow>
                <Big $tone={t}>{fmtPct(c.yoy)}</Big>
                <Small>MoM {fmtPct(c.mom)}</Small>
                <Spark>
                  <ResponsiveContainer>
                    <AreaChart data={c.spark} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                      <YAxis hide domain={['dataMin - 1', 'dataMax + 1']} />
                      <defs>
                        <linearGradient id={`drillgrad-${c.id}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={accent} stopOpacity={0.35} />
                          <stop offset="100%" stopColor={accent} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Area
                        type="monotone"
                        dataKey="v"
                        stroke={accent}
                        strokeWidth={1.5}
                        fill={`url(#drillgrad-${c.id})`}
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </Spark>
              </Card>
            );
          })}
        </Grid>
      )}
    </Wrap>
  );
}
