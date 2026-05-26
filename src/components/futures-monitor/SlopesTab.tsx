/* eslint-disable @typescript-eslint/no-use-before-define */
/**
 * Tab Slopes (Steepeners / Flatteners) — pendientes de la curva.
 * Estructura distinta a Calendars/Butterflies: en vez de actual/MA/Z
 * muestra "Pendiente actual / D 5D / D 20D / Z / Tendencia".
 */
import React, { useMemo, useState } from 'react';
import type { SlopeMeta, SpreadSeries } from 'src/lib/futures-monitor/types';
import SpreadDetailChart from './SpreadDetailChart';
import {
  T,
  MONO,
  fmtSigned,
  zScoreColor,
  zScoreTextColor,
  tendenciaColor,
} from './theme';

export default function SlopesTab({
  slopes,
  serieses,
}: {
  slopes: SlopeMeta[];
  serieses: SpreadSeries[];
}) {
  const [selected, setSelected] = useState<string | null>(
    () => slopes[0]?.tramo ?? null,
  );

  const seriesByName = useMemo(
    () => Object.fromEntries(serieses.map((s) => [s.name, s])),
    [serieses],
  );

  if (slopes.length === 0) {
    return (
      <div style={{
        padding: 40, textAlign: 'center', color: T.muted,
        border: `1px solid ${T.hairlineSoft}`, background: T.surfaceAlt,
        fontFamily: MONO, fontSize: 12,
      }}>
        Sin datos de pendientes.
      </div>
    );
  }

  const selectedSeries = selected ? seriesByName[selected] : null;
  const selectedSlope = slopes.find((s) => s.tramo === selected) ?? null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ─── Tabla ──────────────────────────────────────────────── */}
      <div style={{
        border: `1px solid ${T.hairline}`,
        background: T.surface,
        fontFamily: MONO,
        fontSize: 11,
        overflowX: 'auto',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{
              borderBottom: `1px solid ${T.hairline}`,
              background: T.surfaceAlt,
            }}>
              <Th>Tramo</Th>
              <Th align="right">Pendiente</Th>
              <Th align="right">Δ 5D</Th>
              <Th align="right">Δ 20D</Th>
              <Th align="right">Media hist</Th>
              <Th align="right">Z-Score</Th>
              <Th>Tendencia</Th>
            </tr>
          </thead>
          <tbody>
            {slopes.map((s) => {
              const isActive = s.tramo === selected;
              return (
                <tr
                  key={s.tramo}
                  onClick={() => setSelected(s.tramo)}
                  style={{
                    borderBottom: `1px solid ${T.hairlineSoft}`,
                    background: isActive ? 'rgba(154, 52, 18, 0.05)' : 'transparent',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) (e.currentTarget.style.background = T.surfaceAlt);
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) (e.currentTarget.style.background = 'transparent');
                  }}
                >
                  <td style={{
                    padding: '7px 10px',
                    fontWeight: 700,
                    color: isActive ? T.accent : T.ink,
                    borderLeft: isActive ? `2px solid ${T.accent}` : '2px solid transparent',
                  }}>
                    {s.tramo}
                  </td>
                  <Td align="right" bold>{fmtSigned(s.actual)}</Td>
                  <Td align="right" muted>{fmtSigned(s.d_5d)}</Td>
                  <Td align="right" muted>{fmtSigned(s.d_20d)}</Td>
                  <Td align="right" muted>{fmtSigned(s.mean_hist)}</Td>
                  <td style={{
                    padding: '7px 10px',
                    textAlign: 'right',
                    fontVariantNumeric: 'tabular-nums',
                    background: zScoreColor(s.z_score),
                    color: zScoreTextColor(s.z_score),
                    fontWeight: 700,
                  }}>
                    {fmtSigned(s.z_score, 2)}
                  </td>
                  <td style={{
                    padding: '7px 10px',
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    color: tendenciaColor(s.tendencia),
                  }}>
                    {s.tendencia}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ─── Detail Chart ──────────────────────────────────────── */}
      {selectedSeries && selectedSlope ? (
        <SpreadDetailChart
          title={selectedSlope.tramo}
          subtitle={
            `Actual ${fmtSigned(selectedSlope.actual)} · ` +
            `Δ 20D ${fmtSigned(selectedSlope.d_20d)} · ` +
            `${selectedSlope.tendencia}`
          }
          series={selectedSeries.history}
        />
      ) : (
        <div style={{
          padding: 32, textAlign: 'center', color: T.mutedDim,
          border: `1px solid ${T.hairlineSoft}`, background: T.surfaceAlt,
          fontFamily: MONO, fontSize: 11,
        }}>
          Haz click en una fila para ver el detalle historico.
        </div>
      )}
    </div>
  );
}

function Th({
  children,
  align = 'left',
}: {
  children: React.ReactNode;
  align?: 'left' | 'right';
}) {
  return (
    <th style={{
      padding: '7px 10px',
      textAlign: align,
      fontSize: 9,
      fontWeight: 700,
      letterSpacing: '0.12em',
      color: T.muted,
      textTransform: 'uppercase',
    }}>
      {children}
    </th>
  );
}

function Td({
  children,
  align = 'left',
  bold = false,
  muted = false,
}: {
  children: React.ReactNode;
  align?: 'left' | 'right';
  bold?: boolean;
  muted?: boolean;
}) {
  return (
    <td style={{
      padding: '7px 10px',
      textAlign: align,
      fontVariantNumeric: 'tabular-nums',
      fontWeight: bold ? 700 : 500,
      color: muted ? T.muted : T.ink,
    }}>
      {children}
    </td>
  );
}
