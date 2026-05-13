'use client';

import React, { useEffect, useMemo } from 'react';
import styled from 'styled-components';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  YAxis,
  ReferenceArea,
  ReferenceLine,
  Tooltip,
} from 'recharts';
import useAppStore from 'src/store';
import { CPISnapshot } from 'src/types/inflation';
import {
  Tone,
  DirTone,
  toneFromYoy,
  dirToneFromDelta,
  toneText,
  pillBg,
  pillText,
} from './toneColors';

const TOTAL_ID = 1;
const TARGET = 3;
const BAND = 1;

// ── styled ─────────────────────────────────────────────────────
const Wrap = styled.section`
  background: linear-gradient(180deg, #ffffff 0%, #faf9fc 100%);
  border: 1px solid #ECECEE;
  border-radius: 14px;
  padding: 24px 28px;
  display: grid;
  grid-template-columns: minmax(220px, 1.1fr) minmax(280px, 1.4fr) minmax(280px, 1.6fr);
  gap: 28px;
  margin-bottom: 18px;
  font-feature-settings: 'tnum' on, 'cv11' on;
  @media (max-width: 1100px) { grid-template-columns: 1fr; }
`;

const HeadlineCol = styled.div`
  display: flex; flex-direction: column; gap: 4px;
`;
const Label = styled.div`
  font-size: 11px; letter-spacing: 0.6px; text-transform: uppercase; color: #6E6B7B;
  font-weight: 600;
`;
const HeadlineNumber = styled.div<{ $tone: Tone }>`
  font-size: 64px; font-weight: 700; line-height: 1; letter-spacing: -1.5px;
  color: ${({ $tone }) => toneText($tone)};
`;
const Sub = styled.div`
  font-size: 12px; color: #6E6B7B;
`;
const PillRow = styled.div`
  display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px;
`;
const Pill = styled.span<{ $tone?: DirTone }>`
  font-size: 11px; padding: 3px 8px; border-radius: 999px;
  background: ${({ $tone }) => pillBg($tone ?? 'neutral')};
  color: ${({ $tone }) => pillText($tone ?? 'neutral')};
  font-weight: 500;
`;
const SparkBox = styled.div`
  height: 90px; width: 100%;
`;
const GaugeTrack = styled.div`
  position: relative;
  width: 100%;
  height: 14px;
  border-radius: 999px;
  overflow: hidden;
  background: linear-gradient(
    to right,
    rgba(163, 207, 187, 0.6)  0%,
    rgba(163, 207, 187, 0.6) 22%,
    rgba(255, 218, 106, 0.6) 22%,
    rgba(255, 218, 106, 0.6) 33%,
    rgba(227, 93, 106, 0.55) 33%,
    rgba(227, 93, 106, 0.55) 50%,
    rgba(176, 42, 55, 0.55)  50%,
    rgba(176, 42, 55, 0.55) 100%
  );
  margin-top: 16px;
`;
const GaugeTick = styled.div<{ $position: number }>`
  position: absolute;
  top: -4px;
  bottom: -4px;
  left: ${({ $position }) => $position}%;
  width: 3px;
  background: #212529;
  border-radius: 2px;
`;
const GaugeScale = styled.div`
  display: flex; justify-content: space-between;
  font-size: 9px; color: #A6A6A6; margin-top: 4px;
`;
const KpiGrid = styled.div`
  display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px 24px;
`;
const KpiRow = styled.div`
  display: flex; flex-direction: column; gap: 0;
`;
const KpiSm = styled.div<{ $tone?: DirTone }>`
  font-size: 22px; font-weight: 600; line-height: 1.05;
  color: ${({ $tone }) => pillText($tone ?? 'neutral')};
`;
const DeltaText = styled.strong<{ $tone: DirTone }>`
  color: ${({ $tone }) => pillText($tone)};
`;

// ── helpers ───────────────────────────────────────────────────
const fmtPct = (v: number | null | undefined, d = 2) => {
  if (v == null || Number.isNaN(v)) return '—';
  const sign = v >= 0 ? '+' : '';
  return `${sign}${v.toFixed(d)}%`;
};

const fmtMonthYear = (iso: string | null | undefined) => {
  if (!iso) return '—';
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
};

const deltaArrow = (v: number) => {
  if (v > 0) return '▲';
  if (v < 0) return '▼';
  return '·';
};

// ── component ─────────────────────────────────────────────────
export default function HeroBlock() {
  const snapshot = useAppStore((s) => s.snapshotByCanasta[TOTAL_ID]) as CPISnapshot | undefined;
  const series = useAppStore((s) => s.seriesByCanasta[TOTAL_ID]);
  const loadSnapshot = useAppStore((s) => s.loadCanastaSnapshot);
  const loadSeries = useAppStore((s) => s.loadCanastaSeries);

  useEffect(() => {
    loadSnapshot(TOTAL_ID);
    loadSeries(TOTAL_ID);
  }, [loadSnapshot, loadSeries]);

  const sparkData = useMemo(() => {
    if (!series) return [];
    return series.slice(-36).map((p) => ({ time: p.time, yoy: p.yoy }));
  }, [series]);

  const yoy = snapshot?.last_yoy ?? null;
  const mom = snapshot?.last_mom ?? null;
  const ytd = snapshot?.last_ytd ?? null;
  const dYoY =
    snapshot && snapshot.last_yoy != null && snapshot.prev_yoy != null
      ? snapshot.last_yoy - snapshot.prev_yoy
      : null;

  const gaugeMax = 18;
  const headlineTone = toneFromYoy(yoy);
  const momTone = dirToneFromDelta(mom);
  const ytdTone = dirToneFromDelta(ytd);
  const dYoYTone = dYoY != null ? dirToneFromDelta(dYoY) : 'neutral';

  return (
    <Wrap>
      {/* Col 1 — headline */}
      <HeadlineCol>
        <Label>Inflación anual {fmtMonthYear(snapshot?.last_date ?? null)}</Label>
        <HeadlineNumber $tone={headlineTone}>{fmtPct(yoy)}</HeadlineNumber>
        <Sub>
          {dYoY != null && (
            <>
              <DeltaText $tone={dYoYTone}>
                {deltaArrow(dYoY)} {fmtPct(dYoY, 2)}
              </DeltaText>{' '}
              vs mes anterior
            </>
          )}
        </Sub>
        <PillRow>
          <Pill $tone={momTone}>MoM {fmtPct(mom)}</Pill>
          <Pill $tone={ytdTone}>YTD {fmtPct(ytd)}</Pill>
          <Pill>Meta Banrep {TARGET}% ±{BAND}</Pill>
        </PillRow>
      </HeadlineCol>

      {/* Col 2 — sparkline 36m con banda meta */}
      <div>
        <Label>Tendencia 36 meses (YoY)</Label>
        <SparkBox>
          <ResponsiveContainer>
            <LineChart data={sparkData} margin={{ top: 8, right: 6, left: 0, bottom: 6 }}>
              <YAxis hide domain={[0, 'dataMax + 1']} />
              <ReferenceArea y1={TARGET - BAND} y2={TARGET + BAND} fill="#A3CFBB" fillOpacity={0.18} />
              <ReferenceLine y={TARGET} stroke="#469F76" strokeDasharray="3 3" />
              <Tooltip
                contentStyle={{ fontSize: 11, padding: 4 }}
                formatter={(v: number) => `${v?.toFixed?.(2) ?? '—'}%`}
                labelFormatter={fmtMonthYear}
              />
              <Line type="monotone" dataKey="yoy" stroke="#786CF7" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </SparkBox>
        <Sub>banda 2-4% = rango meta</Sub>
      </div>

      {/* Col 3 — gauge + secondary KPIs */}
      <div>
        <Label>Posición vs rango Banrep</Label>
        <GaugeTrack>
          <GaugeTick
            $position={Math.min(100, Math.max(0, ((yoy ?? 0) / gaugeMax) * 100))}
          />
        </GaugeTrack>
        <GaugeScale>
          <span>0%</span>
          <span>4%</span>
          <span>9%</span>
          <span>{gaugeMax}%</span>
        </GaugeScale>
        <KpiGrid>
          <KpiRow>
            <Label>Mensual</Label>
            <KpiSm $tone={momTone}>{fmtPct(mom)}</KpiSm>
          </KpiRow>
          <KpiRow>
            <Label>Año corrido</Label>
            <KpiSm $tone={ytdTone}>{fmtPct(ytd)}</KpiSm>
          </KpiRow>
        </KpiGrid>
      </div>
    </Wrap>
  );
}
