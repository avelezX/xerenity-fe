/* eslint-disable @typescript-eslint/no-use-before-define */
/**
 * Tab Front Month — series 5y de precio + MA20/MA50/MA200, y vol cone
 * con Vol 20D y Vol 60D anualizadas. Calculadas client-side desde el
 * `front_history` que envia el backend.
 */
import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { TimePoint, KPIs } from 'src/lib/futures-monitor/types';
import {
  cleanSeries,
  buildPriceChartData,
  buildVolChartData,
} from 'src/lib/futures-monitor/seriesHelpers';
import { T, MONO, fmtPrice, fmtPct, pctColor } from './theme';

export default function FrontMonthTab({
  series,
  kpis,
}: {
  series: TimePoint[];
  kpis: KPIs;
}) {
  const cleaned = useMemo(() => cleanSeries(series), [series]);
  const priceData = useMemo(() => buildPriceChartData(cleaned), [cleaned]);
  const volData = useMemo(() => buildVolChartData(cleaned), [cleaned]);

  if (cleaned.length === 0) {
    return (
      <div style={{
        padding: '40px', textAlign: 'center', color: T.muted,
        border: `1px solid ${T.hairlineSoft}`, background: T.surfaceAlt,
        fontFamily: MONO, fontSize: 12,
      }}>
        Sin historia de front month.
      </div>
    );
  }

  const last = cleaned[cleaned.length - 1];
  const latestPriceData = priceData[priceData.length - 1] ?? null;

  // Stats card
  const ytdStart = (() => {
    const year = last.date.slice(0, 4);
    const first = cleaned.find((p) => p.date >= `${year}-01-01`);
    return first?.value ?? null;
  })();
  const ytdPct =
    ytdStart != null && ytdStart !== 0 ? (last.value / ytdStart - 1) * 100 : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ─── Stat cards ───────────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 0,
        border: `1px solid ${T.hairline}`,
        background: T.surface,
      }}>
        <StatCard label="Ultimo" sub={last.date}>
          <span style={{ fontSize: 16, fontWeight: 700, color: T.ink }}>
            {fmtPrice(last.value)}
          </span>
          <span style={{ fontSize: 10, color: T.muted, marginLeft: 6 }}>c/lb</span>
        </StatCard>
        <StatCard label="YTD" sub={`vs ${last.date.slice(0, 4)}-01-01`}>
          <span style={{ fontSize: 16, fontWeight: 700, color: pctColor(ytdPct) }}>
            {fmtPct(ytdPct)}
          </span>
        </StatCard>
        <StatCard label="Vol 20D" sub="anualizada">
          <span style={{ fontSize: 16, fontWeight: 700, color: T.ink }}>
            {fmtPct(kpis.vol_20d_pct, 1)}
          </span>
        </StatCard>
        <StatCard label="MA 20 / 50 / 200" sub="moving averages">
          <span style={{ fontSize: 11, fontWeight: 600, color: T.ink, fontFamily: MONO }}>
            {latestPriceData != null && (
              <>
                {fmtPrice(latestPriceData.ma20)} /{' '}
                {fmtPrice(latestPriceData.ma50)} /{' '}
                {fmtPrice(latestPriceData.ma200)}
              </>
            )}
          </span>
        </StatCard>
      </div>

      {/* ─── Price + MAs ─────────────────────────────────────────── */}
      <div style={{
        border: `1px solid ${T.hairline}`,
        background: T.surface,
        padding: '12px 14px',
      }}>
        <div style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.14em',
          color: T.muted, textTransform: 'uppercase', marginBottom: 8,
          fontFamily: MONO,
        }}>
          Precio front month (SB=F) + medias moviles
        </div>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={priceData} margin={{ top: 8, right: 12, left: 4, bottom: 8 }}>
            <CartesianGrid stroke={T.hairlineSoft} strokeDasharray="0" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: T.muted, fontFamily: MONO }}
              tickLine={{ stroke: T.hairline }}
              axisLine={{ stroke: T.hairline }}
              tickFormatter={(v: string) => v.slice(0, 7)}
              minTickGap={50}
            />
            <YAxis
              tick={{ fontSize: 10, fill: T.muted, fontFamily: MONO }}
              tickLine={{ stroke: T.hairline }}
              axisLine={{ stroke: T.hairline }}
              tickFormatter={(v: number) => v.toFixed(1)}
              domain={['auto', 'auto']}
              width={48}
            />
            <RechartsTooltip
              contentStyle={{
                background: T.surface,
                border: `1px solid ${T.hairline}`,
                fontFamily: MONO,
                fontSize: 11,
                padding: '6px 10px',
              }}
              formatter={(v: number, name: string) => [
                v != null ? v.toFixed(2) : '—',
                name,
              ]}
              labelStyle={{ color: T.ink, fontWeight: 700 }}
            />
            <Legend
              wrapperStyle={{
                fontSize: 10,
                fontFamily: MONO,
                letterSpacing: '0.06em',
                paddingTop: 4,
              }}
              iconType="plainline"
            />
            <Line
              name="SB=F"
              type="monotone"
              dataKey="close"
              stroke={T.accent}
              strokeWidth={1.3}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              name="MA 20"
              type="monotone"
              dataKey="ma20"
              stroke={T.blue}
              strokeWidth={1}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              name="MA 50"
              type="monotone"
              dataKey="ma50"
              stroke={T.green}
              strokeWidth={1}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              name="MA 200"
              type="monotone"
              dataKey="ma200"
              stroke={T.purple}
              strokeWidth={1}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ─── Vol cone ──────────────────────────────────────────────── */}
      <div style={{
        border: `1px solid ${T.hairline}`,
        background: T.surface,
        padding: '12px 14px',
      }}>
        <div style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.14em',
          color: T.muted, textTransform: 'uppercase', marginBottom: 8,
          fontFamily: MONO,
        }}>
          Volatilidad realizada anualizada
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={volData} margin={{ top: 8, right: 12, left: 4, bottom: 8 }}>
            <CartesianGrid stroke={T.hairlineSoft} strokeDasharray="0" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: T.muted, fontFamily: MONO }}
              tickLine={{ stroke: T.hairline }}
              axisLine={{ stroke: T.hairline }}
              tickFormatter={(v: string) => v.slice(0, 7)}
              minTickGap={50}
            />
            <YAxis
              tick={{ fontSize: 10, fill: T.muted, fontFamily: MONO }}
              tickLine={{ stroke: T.hairline }}
              axisLine={{ stroke: T.hairline }}
              tickFormatter={(v: number) => `${v.toFixed(0)}%`}
              domain={['auto', 'auto']}
              width={48}
            />
            <RechartsTooltip
              contentStyle={{
                background: T.surface,
                border: `1px solid ${T.hairline}`,
                fontFamily: MONO,
                fontSize: 11,
                padding: '6px 10px',
              }}
              formatter={(v: number, name: string) => [
                v != null ? `${v.toFixed(1)}%` : '—',
                name,
              ]}
              labelStyle={{ color: T.ink, fontWeight: 700 }}
            />
            <Legend
              wrapperStyle={{
                fontSize: 10,
                fontFamily: MONO,
                letterSpacing: '0.06em',
                paddingTop: 4,
              }}
              iconType="plainline"
            />
            <Line
              name="Vol 20D"
              type="monotone"
              dataKey="vol20"
              stroke={T.accent}
              strokeWidth={1.3}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              name="Vol 60D"
              type="monotone"
              dataKey="vol60"
              stroke={T.blue}
              strokeWidth={1}
              strokeDasharray="3 3"
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function StatCard({
  label,
  sub,
  children,
}: {
  label: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{
      padding: '10px 14px',
      borderRight: `1px solid ${T.hairlineSoft}`,
      fontFamily: MONO,
    }}>
      <div style={{
        fontSize: 9, fontWeight: 700, letterSpacing: '0.14em',
        color: T.muted, textTransform: 'uppercase',
        marginBottom: 4,
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: MONO,
        fontVariantNumeric: 'tabular-nums',
        lineHeight: 1.1,
      }}>
        {children}
      </div>
      {sub && (
        <div style={{
          fontSize: 9, color: T.mutedDim,
          marginTop: 3, letterSpacing: '0.06em',
          textTransform: 'lowercase',
        }}>
          {sub}
        </div>
      )}
    </div>
  );
}
