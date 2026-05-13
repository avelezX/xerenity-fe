'use client';

import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { CitySnapshot } from 'src/types/inflation';
import { fetchCitySnapshot } from 'src/models/inflation';
import {
  toneFromYoy,
  toneText,
  toneBorder,
  toneRowBg,
  Tone,
} from './toneColors';

const Wrap = styled.section`
  background: #fff;
  border: 1px solid #ECECEE;
  border-radius: 14px;
  padding: 18px 22px;
  margin-bottom: 18px;
  font-feature-settings: 'tnum' on;
`;
const Header = styled.div`
  display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;
`;
const Title = styled.h3`
  font-size: 14px; font-weight: 600; color: #212529; margin: 0;
  text-transform: uppercase; letter-spacing: 0.2px;
`;
const Sub = styled.div`
  font-size: 11px; color: #6E6B7B;
`;
const Grid = styled.div`
  display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 6px;
`;
const Row = styled.div<{ $tone: Tone }>`
  display: grid; grid-template-columns: 1fr auto; gap: 8px; align-items: center;
  padding: 6px 10px; border-radius: 6px;
  background: ${({ $tone }) => toneRowBg($tone)};
  border-left: 3px solid ${({ $tone }) => toneBorder($tone)};
`;
const City = styled.div`
  font-size: 12px; color: #212529; font-weight: 500;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
`;
const Yoy = styled.div<{ $tone: Tone }>`
  font-size: 14px; font-weight: 700; font-feature-settings: 'tnum' on;
  color: ${({ $tone }) => toneText($tone)};
`;

const fmtPct = (v: number | null | undefined) =>
  v == null || Number.isNaN(v) ? '—' : `${v.toFixed(2)}%`;

export default function CityRanking() {
  const [snapshot, setSnapshot] = useState<CitySnapshot[]>([]);
  const [date, setDate] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetchCitySnapshot();
      if (cancelled || !res.data) return;
      setSnapshot(res.data);
      setDate(res.data[0]?.fecha ?? null);
    })();
    return () => { cancelled = true; };
  }, []);

  const sorted = [...snapshot].sort((a, b) => (b.yoy ?? -Infinity) - (a.yoy ?? -Infinity));
  const minYoy = Math.min(...sorted.map((c) => c.yoy ?? Infinity));
  const maxYoy = Math.max(...sorted.map((c) => c.yoy ?? -Infinity));

  let subText = 'Cargando…';
  if (sorted.length > 0) {
    subText = `${sorted.length} ciudades · cierre ${date ?? '—'} · rango ${minYoy.toFixed(2)}%–${maxYoy.toFixed(2)}%`;
  }

  return (
    <Wrap>
      <Header>
        <Title>IPC por ciudad · ranking YoY</Title>
        <Sub>{subText}</Sub>
      </Header>
      <Grid>
        {sorted.map((c) => {
          const t = toneFromYoy(c.yoy);
          return (
            <Row key={c.ciudad} $tone={t}>
              <City title={c.ciudad}>{c.ciudad}</City>
              <Yoy $tone={t}>{fmtPct(c.yoy)}</Yoy>
            </Row>
          );
        })}
      </Grid>
    </Wrap>
  );
}
