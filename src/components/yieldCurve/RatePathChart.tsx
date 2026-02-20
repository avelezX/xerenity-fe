'use client';

import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import {
  RatePathPoint,
  formatMeetingDate,
  formatBpsChange,
} from 'src/utils/ratePathBootstrap';

function bpsColor(bps: number): string {
  if (bps < 0) return '#2ca02c';
  if (bps > 0) return '#d62728';
  return '#666';
}

type RatePathChartProps = {
  data: RatePathPoint[];
  currentRate: number;
  curveDate: string;
  color?: string;
  title?: string;
};

type ChartDatum = {
  label: string;
  meeting_date: string;
  implied_rate: number;
  implied_change_bps: number;
  cumulative_change_bps: number;
};

const CustomTooltip = ({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: ChartDatum }[];
}) => {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;

  return (
    <div
      style={{
        backgroundColor: 'white',
        border: '1px solid #ccc',
        borderRadius: 4,
        padding: '8px 12px',
        fontSize: 13,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 4 }}>
        {point.meeting_date}
      </div>
      <div style={{ marginBottom: 2 }}>
        Implied Rate: <strong>{point.implied_rate.toFixed(2)}%</strong>
      </div>
      <div style={{ marginBottom: 2 }}>
        Change:{' '}
        <strong
          style={{
            color: bpsColor(point.implied_change_bps),
          }}
        >
          {formatBpsChange(point.implied_change_bps)} bps
        </strong>
      </div>
      <div>
        Cumulative:{' '}
        <strong>{formatBpsChange(point.cumulative_change_bps)} bps</strong>
      </div>
    </div>
  );
};


export default function RatePathChart({
  data,
  currentRate,
  curveDate,
  color = '#ff7f0e',
  title = 'Implied Rate Path',
}: RatePathChartProps) {
  if (data.length === 0) {
    return (
      <div
        style={{
          height: 500,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#999',
        }}
      >
        No rate path data available
      </div>
    );
  }

  // Build chart data: start with current rate, then each meeting
  const chartData: ChartDatum[] = [
    {
      label: 'Current',
      meeting_date: curveDate,
      implied_rate: currentRate,
      implied_change_bps: 0,
      cumulative_change_bps: 0,
    },
    ...data.map((pt) => ({
      label: formatMeetingDate(pt.meeting_date),
      meeting_date: pt.meeting_date,
      implied_rate: pt.implied_rate,
      implied_change_bps: pt.implied_change_bps,
      cumulative_change_bps: pt.cumulative_change_bps,
    })),
  ];

  const allRates = chartData.map((d) => d.implied_rate);
  const BPS_STEP = 0.25;
  const minY =
    Math.floor(Math.min(...allRates) / BPS_STEP) * BPS_STEP - BPS_STEP;
  const maxY =
    Math.ceil(Math.max(...allRates) / BPS_STEP) * BPS_STEP + BPS_STEP;
  const yTicks: number[] = [];
  let t = minY;
  while (t <= maxY) {
    yTicks.push(Math.round(t * 100) / 100);
    t = Math.round((t + BPS_STEP) * 100) / 100;
  }

  const totalChange = data.length > 0 ? data[data.length - 1].cumulative_change_bps : 0;
  const totalChangeColor = bpsColor(totalChange);

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
          paddingLeft: 20,
          paddingRight: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontWeight: 600, fontSize: 15 }}>{title}</span>
          <span style={{ fontSize: 13, color: '#888' }}>
            Current: {currentRate.toFixed(2)}%
          </span>
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: totalChangeColor,
            }}
          >
            Total: {formatBpsChange(totalChange)} bps
          </span>
        </div>
        <span style={{ fontSize: 13, color: '#888' }}>
          As of {curveDate}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={500}>
        <LineChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
        >
          <CartesianGrid
            strokeDasharray="6 4"
            stroke="#D3D3D3"
            vertical={false}
          />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11 }}
            tickLine={false}
            interval={Math.max(0, Math.floor(chartData.length / 12) - 1)}
            angle={-45}
            textAnchor="end"
            height={50}
          />
          <YAxis
            domain={[minY, maxY]}
            ticks={yTicks}
            tick={{ fontSize: 12 }}
            tickFormatter={(v: number) => `${v.toFixed(2)}%`}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine
            y={currentRate}
            stroke="#999"
            strokeDasharray="4 4"
            strokeWidth={1}
          />
          <Line
            type="stepAfter"
            dataKey="implied_rate"
            stroke={color}
            strokeWidth={2.5}
            dot={{ r: 3, fill: color, stroke: 'white', strokeWidth: 1.5 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Summary Table */}
      <div style={{ overflowX: 'auto', marginTop: 16 }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 14,
          }}
        >
          <thead>
            <tr style={{ borderBottom: '2px solid #dee2e6' }}>
              <th style={{ padding: '8px 12px', textAlign: 'left' }}>
                Meeting
              </th>
              <th style={{ padding: '8px 12px', textAlign: 'right' }}>
                Implied Rate
              </th>
              <th style={{ padding: '8px 12px', textAlign: 'right' }}>
                Change
              </th>
              <th style={{ padding: '8px 12px', textAlign: 'right' }}>
                Cumulative
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((pt) => {
              const changeColor = bpsColor(pt.implied_change_bps);
              return (
                <tr
                  key={pt.meeting_date}
                  style={{ borderBottom: '1px solid #eee' }}
                >
                  <td style={{ padding: '6px 12px', fontWeight: 600 }}>
                    {formatMeetingDate(pt.meeting_date)}
                    <span
                      style={{
                        fontSize: 12,
                        color: '#aaa',
                        marginLeft: 8,
                      }}
                    >
                      {pt.meeting_date}
                    </span>
                  </td>
                  <td style={{ padding: '6px 12px', textAlign: 'right' }}>
                    {pt.implied_rate.toFixed(2)}%
                  </td>
                  <td
                    style={{
                      padding: '6px 12px',
                      textAlign: 'right',
                      color: changeColor,
                      fontWeight: 600,
                    }}
                  >
                    {formatBpsChange(pt.implied_change_bps)} bps
                  </td>
                  <td
                    style={{
                      padding: '6px 12px',
                      textAlign: 'right',
                      fontWeight: 600,
                    }}
                  >
                    {formatBpsChange(pt.cumulative_change_bps)} bps
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
