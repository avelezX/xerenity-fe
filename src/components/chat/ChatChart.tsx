import React from 'react';
import {
  LineChart, BarChart, AreaChart,
  Line, Bar, Area,
  XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import type { ChartSpec } from 'src/types/chat';

const DEFAULT_COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

interface ChatChartProps {
  spec: ChartSpec;
}

function renderChart(
  chartType: string,
  chartData: Record<string, unknown>[],
  margin: { top: number; right: number; left: number; bottom: number },
  children: React.ReactNode,
) {
  if (chartType === 'bar') {
    return <BarChart data={chartData} margin={margin}>{children}</BarChart>;
  }
  if (chartType === 'area') {
    return <AreaChart data={chartData} margin={margin}>{children}</AreaChart>;
  }
  return <LineChart data={chartData} margin={margin}>{children}</LineChart>;
}

export default function ChatChart({ spec }: ChatChartProps) {
  const { chart_type: chartType, title, x_axis_key: xAxisKey, series, data } = spec;

  const renderSeries = () =>
    series.map((s, i) => {
      const color = s.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length];
      const key = `${s.data_key}-${i}`;

      switch (chartType) {
        case 'bar':
          return <Bar key={key} dataKey={s.data_key} name={s.name} fill={color} />;
        case 'area':
          return <Area key={key} dataKey={s.data_key} name={s.name} stroke={color} fill={color} fillOpacity={0.3} />;
        case 'line':
        default:
          return <Line key={key} dataKey={s.data_key} name={s.name} stroke={color} dot={false} />;
      }
    });

  const margin = { top: 5, right: 5, left: 0, bottom: 5 };

  const chartContent = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
      <XAxis dataKey={xAxisKey} tick={{ fontSize: 10 }} />
      <YAxis tick={{ fontSize: 10 }} />
      <Tooltip contentStyle={{ fontSize: 12 }} />
      <Legend wrapperStyle={{ fontSize: 11 }} />
      {renderSeries()}
    </>
  );

  return (
    <div style={{ marginTop: 8, marginBottom: 8 }}>
      {title && (
        <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
          {title}
        </div>
      )}
      <div style={{ width: '100%', height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          {renderChart(chartType, data, margin, chartContent)}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
