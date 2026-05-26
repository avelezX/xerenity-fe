/**
 * Chart de detalle para spreads / butterflies / slopes — serie historica
 * con MA 20D y bandas Bollinger +-2 sigma.
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
import type { TimePoint } from 'src/lib/futures-monitor/types';
import { cleanSeries, buildSpreadChartData } from 'src/lib/futures-monitor/seriesHelpers';
import { T, MONO } from './theme';

export default function SpreadDetailChart({
  title,
  subtitle,
  series,
  decimals = 3,
}: {
  title: string;
  subtitle?: string;
  series: TimePoint[];
  decimals?: number;
}) {
  const cleaned = useMemo(() => cleanSeries(series), [series]);
  const chartData = useMemo(() => buildSpreadChartData(cleaned), [cleaned]);

  if (cleaned.length === 0) {
    return (
      <div style={{
        padding: 32, textAlign: 'center', color: T.muted,
        border: `1px solid ${T.hairlineSoft}`, background: T.surfaceAlt,
        fontFamily: MONO, fontSize: 12,
      }}>
        Sin historia para {title}.
      </div>
    );
  }

  return (
    <div style={{
      border: `1px solid ${T.hairline}`,
      background: T.surface,
      padding: '12px 14px',
    }}>
      <div style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        marginBottom: 8,
      }}>
        <div style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.14em',
          color: T.muted, textTransform: 'uppercase', fontFamily: MONO,
        }}>
          {title}
        </div>
        {subtitle && (
          <div style={{
            fontSize: 10, color: T.mutedDim, fontFamily: MONO,
            letterSpacing: '0.06em',
          }}>
            {subtitle}
          </div>
        )}
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={chartData} margin={{ top: 8, right: 12, left: 4, bottom: 8 }}>
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
            tickFormatter={(v: number) => v.toFixed(decimals === 3 ? 2 : 1)}
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
              v != null ? v.toFixed(decimals) : '—',
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
            name="Spread"
            type="monotone"
            dataKey="value"
            stroke={T.accent}
            strokeWidth={1.3}
            dot={false}
            isAnimationActive={false}
          />
          <Line
            name="MA 20D"
            type="monotone"
            dataKey="ma20"
            stroke={T.ink}
            strokeWidth={1}
            strokeDasharray="0"
            dot={false}
            isAnimationActive={false}
          />
          <Line
            name="+2σ"
            type="monotone"
            dataKey="upper2"
            stroke={T.muted}
            strokeWidth={0.8}
            strokeDasharray="3 3"
            dot={false}
            isAnimationActive={false}
          />
          <Line
            name="-2σ"
            type="monotone"
            dataKey="lower2"
            stroke={T.muted}
            strokeWidth={0.8}
            strokeDasharray="3 3"
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
