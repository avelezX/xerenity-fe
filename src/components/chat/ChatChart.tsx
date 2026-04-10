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

export default function ChatChart({ spec }: ChatChartProps) {
  const { chart_type, title, x_axis_key, series, data } = spec;

  const renderSeries = () =>
    series.map((s, i) => {
      const color = s.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length];
      const key = `${s.data_key}-${i}`;

      switch (chart_type) {
        case 'bar':
          return <Bar key={key} dataKey={s.data_key} name={s.name} fill={color} />;
        case 'area':
          return <Area key={key} dataKey={s.data_key} name={s.name} stroke={color} fill={color} fillOpacity={0.3} />;
        case 'line':
        default:
          return <Line key={key} dataKey={s.data_key} name={s.name} stroke={color} dot={false} />;
      }
    });

  const commonProps = { data, margin: { top: 5, right: 5, left: 0, bottom: 5 } };

  const chartContent = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
      <XAxis dataKey={x_axis_key} tick={{ fontSize: 10 }} />
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
          {chart_type === 'bar' ? (
            <BarChart {...commonProps}>{chartContent}</BarChart>
          ) : chart_type === 'area' ? (
            <AreaChart {...commonProps}>{chartContent}</AreaChart>
          ) : (
            <LineChart {...commonProps}>{chartContent}</LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
