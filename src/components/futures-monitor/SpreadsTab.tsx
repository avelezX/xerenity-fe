/* eslint-disable @typescript-eslint/no-use-before-define */
/**
 * Tab generico para Calendar Spreads y Butterflies — tabla con metricas
 * arriba + SpreadDetailChart abajo para la fila seleccionada.
 *
 * Para Slopes, ver SlopesTab.tsx (estructura distinta).
 */
import React, { useMemo, useState } from 'react';
import type {
  SpreadMeta,
  FlyMeta,
  SpreadSeries,
} from 'src/lib/futures-monitor/types';
import SpreadDetailChart from './SpreadDetailChart';
import {
  T,
  MONO,
  fmtSigned,
  zScoreColor,
  zScoreTextColor,
} from './theme';

type AnyMeta = SpreadMeta | FlyMeta;

export default function SpreadsTab({
  label,
  metas,
  serieses,
  showSenal,
  decimals = 2,
}: {
  /** "Calendar Spread" | "Butterfly" — header de columna principal. */
  label: string;
  metas: AnyMeta[];
  serieses: SpreadSeries[];
  /** Si true muestra columna "Senal" (solo para butterflies). */
  showSenal: boolean;
  decimals?: number;
}) {
  const [selected, setSelected] = useState<string | null>(
    () => metas[0]?.name ?? null,
  );

  const seriesByName = useMemo(
    () => Object.fromEntries(serieses.map((s) => [s.name, s])),
    [serieses],
  );

  if (metas.length === 0) {
    return (
      <div style={{
        padding: 40, textAlign: 'center', color: T.muted,
        border: `1px solid ${T.hairlineSoft}`, background: T.surfaceAlt,
        fontFamily: MONO, fontSize: 12,
      }}>
        Sin datos de {label.toLowerCase()}.
      </div>
    );
  }

  const selectedSeries = selected ? seriesByName[selected] : null;
  const selectedMeta = metas.find((m) => m.name === selected) ?? null;

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
              <Th>{label}</Th>
              <Th align="right">Actual</Th>
              <Th align="right">MA 20D</Th>
              <Th align="right">Std 20D</Th>
              <Th align="right">Z-Score</Th>
              <Th align="right">Pctil</Th>
              <Th align="right">Min</Th>
              <Th align="right">Max</Th>
              {showSenal && <Th>Senal</Th>}
            </tr>
          </thead>
          <tbody>
            {metas.map((m) => {
              const isActive = m.name === selected;
              return (
                <tr
                  key={m.name}
                  onClick={() => setSelected(m.name)}
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
                    {m.name}
                  </td>
                  <Td align="right" bold>{fmtSigned(m.actual, decimals)}</Td>
                  <Td align="right" muted>{fmtSigned(m.ma_20d, decimals)}</Td>
                  <Td align="right" muted>
                    {m.std_20d != null ? m.std_20d.toFixed(decimals) : '—'}
                  </Td>
                  <td style={{
                    padding: '7px 10px',
                    textAlign: 'right',
                    fontVariantNumeric: 'tabular-nums',
                    background: zScoreColor(m.z_score),
                    color: zScoreTextColor(m.z_score),
                    fontWeight: 700,
                  }}>
                    {fmtSigned(m.z_score, 2)}
                  </td>
                  <Td align="right" muted>
                    {m.pctile != null ? `${m.pctile.toFixed(0)}%` : '—'}
                  </Td>
                  <Td align="right" muted>{fmtSigned(m.min_hist, decimals)}</Td>
                  <Td align="right" muted>{fmtSigned(m.max_hist, decimals)}</Td>
                  {showSenal && (
                    <td style={{
                      padding: '7px 10px',
                      fontSize: 10,
                      color: getSenalColor((m as FlyMeta).senal),
                      fontWeight: 600,
                      letterSpacing: '0.04em',
                    }}>
                      {(m as FlyMeta).senal}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ─── Detail Chart ──────────────────────────────────────── */}
      {selectedSeries && selectedMeta ? (
        <SpreadDetailChart
          title={selectedMeta.name}
          subtitle={
            `Actual ${fmtSigned(selectedMeta.actual, decimals)} · ` +
            `Z ${fmtSigned(selectedMeta.z_score, 2)} · ` +
            `Pctil ${selectedMeta.pctile != null ? `${selectedMeta.pctile.toFixed(0)}%` : '—'}`
          }
          series={selectedSeries.history}
          decimals={decimals}
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

// ── Helpers ────────────────────────────────────────────────────────

function getSenalColor(senal: string): string {
  if (senal.includes('VENDER')) return T.red;
  if (senal.includes('COMPRAR')) return T.green;
  return T.muted;
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
