import React, { useMemo } from 'react';
import useAppStore from 'src/store';
import Panel from '@components/Panel';
import { SectionTitle } from './styled';

const fmtMonth = (s: string) => {
  const d = new Date(`${s}T00:00:00`);
  return d.toLocaleDateString('es-CO', { month: '2-digit', year: '2-digit' });
};

const colorFor = (v: number, max: number): string => {
  if (Number.isNaN(v) || v === null || v === undefined) return '#fff';
  const pos = Math.max(0, Math.min(1, v / max));
  const neg = Math.max(0, Math.min(1, -v / max));
  if (v >= 0) {
    const a = (0.05 + pos * 0.85).toFixed(2);
    return `rgba(176, 42, 55, ${a})`;
  }
  const a = (0.05 + neg * 0.85).toFixed(2);
  return `rgba(24, 135, 84, ${a})`;
};

const cellFontColor = (v: number, max: number) => {
  const intensity = Math.min(1, Math.abs(v) / max);
  return intensity > 0.55 ? '#fff' : '#212529';
};

export default function InflationHeatmap() {
  const contributions = useAppStore((s) => s.contributions);
  const canastas = useAppStore((s) => s.canastas);

  const { months, byKey, divisions, max } = useMemo(() => {
    const monthSet = new Set<string>();
    const divSet = new Map<number, string>();
    const map = new Map<string, number>();
    let m = 0;
    contributions.forEach((c) => {
      monthSet.add(c.time);
      divSet.set(c.id_canasta, c.nombre);
      map.set(`${c.id_canasta}|${c.time}`, c.valormensual);
      m = Math.max(m, Math.abs(c.valormensual));
    });
    return {
      months: Array.from(monthSet).sort(),
      byKey: map,
      divisions: Array.from(divSet.entries()).map(([id, nombre]) => ({
        id,
        nombre,
      })),
      max: m || 1,
    };
  }, [contributions]);

  const labelFor = (id: number) =>
    canastas.find((c) => c.id === id)?.nombre ||
    divisions.find((d) => d.id === id)?.nombre ||
    `#${id}`;

  if (months.length === 0 || divisions.length === 0) {
    return (
      <Panel>
        <SectionTitle>Heatmap mensual por división</SectionTitle>
        <div style={{ color: '#777', fontSize: 12 }}>Sin datos.</div>
      </Panel>
    );
  }

  return (
    <Panel>
      <SectionTitle>Heatmap MoM por división (últimos 24 meses)</SectionTitle>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'separate', borderSpacing: 2, fontSize: 11 }}>
          <thead>
            <tr>
              <th
                style={{
                  textAlign: 'left',
                  padding: '4px 8px',
                  position: 'sticky',
                  left: 0,
                  background: '#fff',
                  zIndex: 1,
                }}
              >
                División
              </th>
              {months.map((m) => (
                <th
                  key={m}
                  style={{
                    padding: '4px 6px',
                    fontWeight: 500,
                    color: '#777',
                    textAlign: 'center',
                  }}
                >
                  {fmtMonth(m)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {divisions.map((d) => (
              <tr key={d.id}>
                <td
                  style={{
                    padding: '4px 8px',
                    position: 'sticky',
                    left: 0,
                    background: '#fff',
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                    maxWidth: 220,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                  title={labelFor(d.id)}
                >
                  {labelFor(d.id)}
                </td>
                {months.map((m) => {
                  const v = byKey.get(`${d.id}|${m}`);
                  const num = typeof v === 'number' ? v : NaN;
                  const display = Number.isNaN(num) ? '' : num.toFixed(2);
                  return (
                    <td
                      key={`${d.id}-${m}`}
                      style={{
                        padding: '4px 6px',
                        background: colorFor(num, max),
                        color: cellFontColor(num, max),
                        textAlign: 'center',
                        minWidth: 38,
                        borderRadius: 3,
                      }}
                      title={`${labelFor(d.id)} · ${fmtMonth(m)}: ${display}%`}
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
    </Panel>
  );
}
