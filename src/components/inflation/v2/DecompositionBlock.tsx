'use client';

import React, { useEffect, useMemo } from 'react';
import styled from 'styled-components';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import useAppStore from 'src/store';

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

const Layout = styled.div`
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  gap: 16px;
  @media (max-width: 1100px) { grid-template-columns: 1fr; }
`;

// 12 colores diferenciados — para las divisiones
const DIV_COLORS: Record<number, string> = {
  317: '#B02A37', 390: '#FFC106', 402: '#0D6EFD', 419: '#188754',
  443: '#6F42C1', 475: '#E35D6A', 496: '#0DCAF0', 528: '#7E57C2',
  535: '#FF9800', 575: '#9C27B0', 592: '#3F51B5', 605: '#795548',
};

const fmtMonth = (s: string) => {
  const d = new Date(`${s}T00:00:00`);
  return d.toLocaleDateString('es-CO', { month: '2-digit', year: '2-digit' });
};

const fmtMonthLong = (s: string) => {
  const d = new Date(`${s}T00:00:00`);
  return d.toLocaleDateString('es-CO', { month: 'short', year: 'numeric' });
};

export default function DecompositionBlock() {
  const contributions = useAppStore((s) => s.contributions);
  const canastas = useAppStore((s) => s.canastas);
  const loadContributions = useAppStore((s) => s.loadContributions);

  useEffect(() => {
    if (contributions.length === 0) loadContributions(36);
  }, [contributions.length, loadContributions]);

  const { stackedData, divisions, heatmapMonths, heatmapMax, heatmapBy } = useMemo(() => {
    const byTime = new Map<string, { time: string; [k: string]: number | string }>();
    const divSet = new Map<number, string>();
    const monthSet = new Set<string>();
    const heatBy = new Map<string, number>();
    let max = 0;

    contributions.forEach((c) => {
      monthSet.add(c.time);
      divSet.set(c.id_canasta, c.nombre);
      if (!byTime.has(c.time)) byTime.set(c.time, { time: c.time });
      const r = byTime.get(c.time) as { [k: string]: number | string };
      r[`d${c.id_canasta}`] = c.valorcontribucion;
      heatBy.set(`${c.id_canasta}|${c.time}`, c.valormensual);
      max = Math.max(max, Math.abs(c.valormensual));
    });

    const divs = Array.from(divSet.entries()).map(([id, nombre]) => ({ id, nombre }));
    const months = Array.from(monthSet).sort();

    return {
      stackedData: Array.from(byTime.values()).sort((a, b) =>
        (a.time as string).localeCompare(b.time as string)
      ),
      divisions: divs,
      heatmapMonths: months,
      heatmapMax: max || 1,
      heatmapBy: heatBy,
    };
  }, [contributions]);

  const labelFor = (id: number) =>
    canastas.find((c) => c.id === id)?.nombre ||
    divisions.find((d) => d.id === id)?.nombre ||
    `#${id}`;

  const heatColor = (v: number, max: number) => {
    if (Number.isNaN(v) || v == null) return '#fff';
    const intensity = Math.max(0.05, Math.min(1, Math.abs(v) / max));
    const a = (0.05 + intensity * 0.85).toFixed(2);
    return v >= 0 ? `rgba(176,42,55,${a})` : `rgba(24,135,84,${a})`;
  };

  const heatTextColor = (v: number, max: number) => {
    const intensity = Math.min(1, Math.abs(v) / max);
    return intensity > 0.55 ? '#fff' : '#212529';
  };

  return (
    <Wrap>
      <Header>
        <Title>Descomposición · ¿de dónde viene la inflación?</Title>
        <Sub>{stackedData.length} meses · contribuciones en pp del IPC mensual</Sub>
      </Header>

      <Layout>
        {/* Stacked bar */}
        <div>
          <div style={{ fontSize: 11, color: '#6E6B7B', marginBottom: 6 }}>
            Contribución mensual por división (pp)
          </div>
          <div style={{ height: 320 }}>
            <ResponsiveContainer>
              <BarChart data={stackedData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#F1F1F2" strokeDasharray="3 3" />
                <XAxis dataKey="time" tickFormatter={fmtMonth} minTickGap={20}
                  stroke="#A6A6A6" tick={{ fill: '#6E6B7B', fontSize: 11 }} />
                <YAxis tickFormatter={(v) => v.toFixed(2)} width={48}
                  stroke="#A6A6A6" tick={{ fill: '#6E6B7B', fontSize: 11 }} />
                <ReferenceLine y={0} stroke="#A6A6A6" />
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 6, borderColor: '#ECECEE' }}
                  labelFormatter={fmtMonthLong}
                  formatter={(value: number, name: string) => {
                    const id = Number(String(name).replace('d', ''));
                    return [
                      `${value?.toFixed?.(3) ?? '—'} pp`,
                      labelFor(id),
                    ];
                  }}
                />
                {divisions.map((d) => (
                  <Bar
                    key={d.id}
                    dataKey={`d${d.id}`}
                    stackId="contrib"
                    fill={DIV_COLORS[d.id] || '#888'}
                    isAnimationActive={false}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Heatmap */}
        <div>
          <div style={{ fontSize: 11, color: '#6E6B7B', marginBottom: 6 }}>
            Heatmap MoM divisiones × meses (intensidad por magnitud)
          </div>
          <div style={{ overflowX: 'auto', maxHeight: 320 }}>
            <table style={{ borderCollapse: 'separate', borderSpacing: 1, fontSize: 10 }}>
              <thead>
                <tr>
                  <th
                    style={{
                      textAlign: 'left', padding: '4px 8px',
                      position: 'sticky', left: 0, top: 0, background: '#fff', zIndex: 2,
                      fontWeight: 600, color: '#6E6B7B', textTransform: 'uppercase',
                      letterSpacing: 0.3, fontSize: 10,
                    }}
                  >
                    División
                  </th>
                  {heatmapMonths.slice(-12).map((m) => (
                    <th key={m} style={{
                      padding: '4px 4px',
                      fontWeight: 500, color: '#A6A6A6',
                      textAlign: 'center', minWidth: 40,
                    }}>{fmtMonth(m)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {divisions.map((d) => (
                  <tr key={d.id}>
                    <td
                      style={{
                        padding: '4px 8px',
                        position: 'sticky', left: 0, background: '#fff',
                        whiteSpace: 'nowrap',
                        maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis',
                        fontWeight: 500, color: '#212529', fontSize: 11,
                      }}
                      title={labelFor(d.id)}
                    >
                      {labelFor(d.id)}
                    </td>
                    {heatmapMonths.slice(-12).map((m) => {
                      const v = heatmapBy.get(`${d.id}|${m}`);
                      const num = typeof v === 'number' ? v : NaN;
                      const display = Number.isNaN(num) ? '' : num.toFixed(1);
                      return (
                        <td
                          key={`${d.id}-${m}`}
                          style={{
                            padding: '4px 4px',
                            background: heatColor(num, heatmapMax),
                            color: heatTextColor(num, heatmapMax),
                            textAlign: 'center', borderRadius: 3,
                            fontFeatureSettings: '"tnum" on',
                          }}
                          title={`${labelFor(d.id)} · ${fmtMonthLong(m)}: ${display}%`}
                        >
                          {display}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Layout>
    </Wrap>
  );
}
