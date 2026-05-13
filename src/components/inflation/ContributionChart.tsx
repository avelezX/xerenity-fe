import React, { useEffect, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import useAppStore from 'src/store';
import Panel from '@components/Panel';
import { getHexColor } from 'src/utils/getHexColors';
import { SectionTitle } from './styled';

const fmtMonth = (s: string) => {
  const d = new Date(`${s}T00:00:00`);
  return d.toLocaleDateString('es-CO', { month: '2-digit', year: '2-digit' });
};

interface Row {
  time: string;
  total: number;
  [k: string]: number | string;
}

export default function ContributionChart() {
  const contributions = useAppStore((s) => s.contributions);
  const canastas = useAppStore((s) => s.canastas);
  const loadContributions = useAppStore((s) => s.loadContributions);

  useEffect(() => {
    if (contributions.length === 0) {
      loadContributions(24);
    }
  }, [contributions.length, loadContributions]);

  const { rows, divisions, colorById } = useMemo(() => {
    const byTime = new Map<string, Row>();
    const divSet = new Map<number, string>();
    contributions.forEach((c) => {
      if (!byTime.has(c.time)) byTime.set(c.time, { time: c.time, total: 0 });
      const r = byTime.get(c.time) as Row;
      r[`d_${c.id_canasta}`] = c.valorcontribucion;
      r.total += c.valorcontribucion;
      divSet.set(c.id_canasta, c.nombre);
    });
    const divs = Array.from(divSet.entries()).map(([id, nombre]) => ({ id, nombre }));
    const colors: Record<number, string> = {};
    divs.forEach((d, i) => {
      colors[d.id] = getHexColor(i + 1);
    });
    return {
      rows: Array.from(byTime.values()).sort((a, b) => a.time.localeCompare(b.time)),
      divisions: divs,
      colorById: colors,
    };
  }, [contributions]);

  const labelFor = (id: number) =>
    canastas.find((c) => c.id === id)?.nombre ||
    divisions.find((d) => d.id === id)?.nombre ||
    `#${id}`;

  return (
    <Panel>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <SectionTitle style={{ margin: 0 }}>Contribuciones al IPC mensual (últimos 24 meses)</SectionTitle>
      </div>
      <div style={{ width: '100%', height: 320 }}>
        <ResponsiveContainer>
          <BarChart data={rows} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#eee" strokeDasharray="3 3" />
            <XAxis dataKey="time" tickFormatter={fmtMonth} minTickGap={20} />
            <YAxis
              tickFormatter={(v) => `${v.toFixed(2)}`}
              width={50}
            />
            <ReferenceLine y={0} stroke="#a6a6a6" />
            <Tooltip
              formatter={(v: number) => `${v?.toFixed?.(3) ?? '—'} pp`}
              labelFormatter={(label: string) => fmtMonth(label)}
            />
            <Legend
              verticalAlign="bottom"
              iconType="square"
              wrapperStyle={{ fontSize: 11 }}
              formatter={(value) => {
                const id = Number(String(value).replace('d_', ''));
                return labelFor(id);
              }}
            />
            {divisions.map((d) => (
              <Bar
                key={d.id}
                dataKey={`d_${d.id}`}
                stackId="contrib"
                fill={colorById[d.id]}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}
