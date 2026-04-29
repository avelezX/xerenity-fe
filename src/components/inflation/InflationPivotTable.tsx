import React, { useEffect, useMemo } from 'react';
import useAppStore from 'src/store';
import Panel from '@components/Panel';
import { SectionTitle } from './styled';

const fmtPct = (v: number | null | undefined) =>
  v === null || v === undefined || Number.isNaN(v) ? '—' : `${v.toFixed(2)}%`;

const fmtMonth = (s: string) => {
  const d = new Date(`${s}T00:00:00`);
  return d.toLocaleDateString('es-CO', { month: 'short', year: '2-digit' });
};

const TOTAL_ID = 1;

interface Row {
  id: number;
  nombre: string;
  peso: number;
  yoy: number | null;
  ytd: number | null;
  monthly: Record<string, number | null>;
}

export default function InflationPivotTable() {
  const canastas = useAppStore((s) => s.canastas);
  const seriesByCanasta = useAppStore((s) => s.seriesByCanasta);
  const setSelected = useAppStore((s) => s.setSelectedCanastaIds);

  // Make sure all canastas have their full series loaded, so the pivot is complete.
  useEffect(() => {
    if (canastas.length > 0) {
      setSelected(canastas.map((c) => c.id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canastas.length]);

  const { rows, lastMonths } = useMemo(() => {
    if (canastas.length === 0) return { rows: [] as Row[], lastMonths: [] as string[] };

    // Determine the most recent 12 months from the Total series (most complete)
    const totalSeries = seriesByCanasta[TOTAL_ID] || [];
    const last12 = totalSeries.slice(-12).map((p) => p.time);

    const built: Row[] = canastas.map((c) => {
      const ser = seriesByCanasta[c.id] || [];
      const last = ser[ser.length - 1];
      const monthly: Record<string, number | null> = {};
      const idx = new Map(ser.map((p) => [p.time, p]));
      last12.forEach((m) => {
        const p = idx.get(m);
        monthly[m] = p?.mom ?? null;
      });
      return {
        id: c.id,
        nombre: c.nombre,
        peso: c.peso,
        yoy: last?.yoy ?? null,
        ytd: last?.ytd ?? null,
        monthly,
      };
    });
    return { rows: built, lastMonths: last12 };
  }, [canastas, seriesByCanasta]);

  if (rows.length === 0) {
    return (
      <Panel>
        <SectionTitle>Tabla por división</SectionTitle>
        <div style={{ color: '#777', fontSize: 12 }}>Cargando series…</div>
      </Panel>
    );
  }

  return (
    <Panel>
      <SectionTitle>Tabla por división — últimos 12 meses</SectionTitle>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 12, width: '100%' }}>
          <thead>
            <tr style={{ background: '#EEEEEE', textAlign: 'right' }}>
              <th style={{ padding: '8px 10px', textAlign: 'left' }}>División</th>
              <th style={{ padding: '8px 10px' }}>Peso</th>
              <th style={{ padding: '8px 10px' }}>YoY</th>
              <th style={{ padding: '8px 10px' }}>YTD</th>
              {lastMonths.map((m) => (
                <th key={m} style={{ padding: '8px 6px', fontWeight: 500 }}>
                  {fmtMonth(m)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                style={{
                  borderBottom: '1px solid #f1f1f1',
                  background: r.id === TOTAL_ID ? '#F1F0EC' : 'transparent',
                  fontWeight: r.id === TOTAL_ID ? 600 : 400,
                  textAlign: 'right',
                }}
              >
                <td
                  style={{
                    padding: '6px 10px',
                    textAlign: 'left',
                    maxWidth: 260,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={r.nombre}
                >
                  {r.nombre}
                </td>
                <td style={{ padding: '6px 10px' }}>
                  {(r.peso * 100).toFixed(2)}%
                </td>
                <td style={{ padding: '6px 10px' }}>{fmtPct(r.yoy)}</td>
                <td style={{ padding: '6px 10px' }}>{fmtPct(r.ytd)}</td>
                {lastMonths.map((m) => (
                  <td key={`${r.id}-${m}`} style={{ padding: '6px 6px' }}>
                    {fmtPct(r.monthly[m])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
