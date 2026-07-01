/**
 * QuarterlyExposureBenchmark — resumen visual (read-only) de la exposicion
 * trimestral USD/COP para Los Coches, renderizado en el tab Benchmark.
 *
 * Alineado visualmente con QuarterlyFwdSummary (aparece justo debajo).
 * Comparten paleta (verde para Q actual, slate para neutrales, borders
 * #e5e7eb, radios 10, gradient headers 180deg #f8fafc → #fff).
 */
import React, { useMemo } from 'react';
import type { ExposicionTrimestralRow } from 'src/models/risk/fetchExposicionTrimestral';

interface Props {
  rows: ExposicionTrimestralRow[];
  year: number;
  currentQuarter: number;
}

const QUARTER_LABEL: Record<number, string> = {
  1: 'Q1 · Ene–Mar',
  2: 'Q2 · Abr–Jun',
  3: 'Q3 · Jul–Sep',
  4: 'Q4 · Oct–Dic',
};

// ── Formatters ──────────────────────────────────────────────────

const fmtUsd = (v: number): string => {
  if (v === 0) return '0';
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(1)}K`;
  return `${sign}${Math.round(abs)}`;
};

const fmtCop = (v: number): string => {
  if (v === 0) return '0';
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (abs >= 1e12) return `${sign}${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(1)}M`;
  return `${sign}${Math.round(abs).toLocaleString('en-US')}`;
};

const fmtTrm = (v: number | null): string => {
  if (v == null || v === 0) return '—';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v);
};

// ── Palette (alineado con QuarterlyFwdSummary) ─────────────────

const signColor = (v: number): string => {
  if (v > 0) return '#16a34a';
  if (v < 0) return '#dc2626';
  return '#64748b';
};

// ── Styles ──────────────────────────────────────────────────────

const SECTION: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 10,
  overflow: 'hidden',
  marginBottom: 14,
};

const HEADER: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '12px 16px',
  background: 'linear-gradient(180deg, #f8fafc 0%, #fff 100%)',
  borderBottom: '1px solid #e5e7eb',
  flexWrap: 'wrap',
};

const TITLE: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: '#0f172a',
  display: 'flex',
  alignItems: 'baseline',
  gap: 8,
  flex: 1,
};

const TITLE_SUB: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 500,
  color: '#64748b',
};

const KPI: React.CSSProperties = {
  display: 'flex',
  gap: 20,
  fontSize: 11,
  fontFamily: 'ui-monospace, monospace',
  flexWrap: 'wrap',
};

const KPI_LABEL: React.CSSProperties = {
  color: '#64748b',
  marginRight: 4,
};

const TABLE_STYLE: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontVariantNumeric: 'tabular-nums',
};

const TH: React.CSSProperties = {
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: '#6c757d',
  fontWeight: 600,
  padding: '8px 12px',
  textAlign: 'left',
  borderBottom: '1px solid #e5e7eb',
  background: '#f8fafc',
};

const TH_NUM: React.CSSProperties = { ...TH, textAlign: 'right' };

const TD: React.CSSProperties = {
  fontSize: 12,
  padding: '8px 12px',
  borderBottom: '1px solid #f1f3f5',
};

const TD_NUM: React.CSSProperties = {
  ...TD,
  textAlign: 'right',
  fontFamily: 'ui-monospace, monospace',
};

const ACTUAL_BADGE: React.CSSProperties = {
  fontSize: 9,
  padding: '2px 7px',
  borderRadius: 4,
  background: '#22c55e',
  color: '#fff',
  fontWeight: 700,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
};

// ── Component ──────────────────────────────────────────────────

interface QuarterAgg {
  count: number;
  usd: number;
  cop: number;
  trmAvg: number | null;
  hasIncompleteTrm: boolean;
}

const emptyAgg = (): QuarterAgg => ({
  count: 0,
  usd: 0,
  cop: 0,
  trmAvg: null,
  hasIncompleteTrm: false,
});

export default function QuarterlyExposureBenchmark({
  rows,
  year,
  currentQuarter,
}: Props) {
  const byQuarter = useMemo<Record<number, QuarterAgg>>(() => {
    const acc: Record<number, QuarterAgg> = {
      1: emptyAgg(), 2: emptyAgg(), 3: emptyAgg(), 4: emptyAgg(),
    };
    rows.filter((r) => r.year === year).forEach((r) => {
      const q = r.quarter;
      if (q < 1 || q > 4) return;
      const a = acc[q];
      a.count += 1;
      a.usd += r.exposicion_usd || 0;
      if (r.trm != null && r.trm > 0) {
        a.cop += (r.exposicion_usd || 0) * r.trm;
      } else if ((r.exposicion_usd || 0) !== 0) {
        a.hasIncompleteTrm = true;
      }
    });
    [1, 2, 3, 4].forEach((q) => {
      const a = acc[q];
      const relevantRows = rows.filter(
        (r) => r.year === year && r.quarter === q && r.trm != null && r.trm > 0,
      );
      const num = relevantRows.reduce((s, r) => s + Math.abs(r.exposicion_usd || 0) * (r.trm || 0), 0);
      const den = relevantRows.reduce((s, r) => s + Math.abs(r.exposicion_usd || 0), 0);
      a.trmAvg = den > 0 ? num / den : null;
    });
    return acc;
  }, [rows, year]);

  const totalUsd = [1, 2, 3, 4].reduce((s, q) => s + byQuarter[q].usd, 0);
  const totalCop = [1, 2, 3, 4].reduce((s, q) => s + byQuarter[q].cop, 0);
  const anyIncomplete = [1, 2, 3, 4].some((q) => byQuarter[q].hasIncompleteTrm);
  const actualAgg = byQuarter[currentQuarter];

  return (
    <div style={SECTION}>
      <div style={HEADER}>
        <div style={TITLE}>
          Resumen exposición · por trimestre
          <span style={TITLE_SUB}>({year})</span>
        </div>
        <div style={KPI}>
          <div>
            <span style={KPI_LABEL}>Anual USD:</span>
            <strong style={{ color: signColor(totalUsd) }}>
              {totalUsd >= 0 ? '+' : ''}{fmtUsd(totalUsd)}
            </strong>
          </div>
          <div>
            <span style={KPI_LABEL}>Anual COP:</span>
            <strong style={{ color: signColor(totalCop) }}>
              {totalCop >= 0 ? '+' : ''}{fmtCop(totalCop)}
            </strong>
            {anyIncomplete && (
              <span style={{ color: '#b45309', fontSize: 10, marginLeft: 4 }}>
                (parcial)
              </span>
            )}
          </div>
          <div style={{ paddingLeft: 8, borderLeft: '1px solid #cbd5e1' }}>
            <span style={KPI_LABEL}>Q{currentQuarter} → Benchmark:</span>
            <strong style={{ color: signColor(actualAgg.usd) }}>
              {actualAgg.usd >= 0 ? '+' : ''}{fmtUsd(actualAgg.usd)} USD
            </strong>
            <span style={{ color: '#64748b', margin: '0 4px' }}>·</span>
            <strong style={{ color: signColor(actualAgg.cop) }}>
              {actualAgg.cop >= 0 ? '+' : ''}{fmtCop(actualAgg.cop)} COP
            </strong>
          </div>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={TABLE_STYLE}>
          <thead>
            <tr>
              <th style={{ ...TH, width: 180 }}>Trimestre</th>
              <th style={{ ...TH_NUM, width: 90 }}>Entradas</th>
              <th style={TH_NUM}>Exposición USD</th>
              <th style={TH_NUM}>TRM prom.</th>
              <th style={TH_NUM}>Exposición COP</th>
              <th style={{ ...TH, width: 100, textAlign: 'center' }}>Estado</th>
            </tr>
          </thead>
          <tbody>
            {([1, 2, 3, 4] as const).map((q) => {
              const a = byQuarter[q];
              const isActual = q === currentQuarter;
              const rowBg = isActual ? '#f0fdf4' : 'transparent';
              return (
                <tr key={q} style={{ background: rowBg }}>
                  <td style={{ ...TD, fontWeight: 600, color: '#0f172a' }}>
                    {QUARTER_LABEL[q]}
                  </td>
                  <td style={{ ...TD_NUM, color: '#64748b' }}>
                    {a.count === 0 ? '—' : a.count}
                  </td>
                  <td
                    style={{
                      ...TD_NUM,
                      color: signColor(a.usd),
                      fontWeight: 700,
                      fontSize: 13,
                    }}
                  >
                    {a.usd === 0 ? '—' : `${a.usd >= 0 ? '+' : ''}${fmtUsd(a.usd)}`}
                  </td>
                  <td style={{ ...TD_NUM, color: '#64748b' }}>
                    {fmtTrm(a.trmAvg)}
                  </td>
                  <td
                    style={{
                      ...TD_NUM,
                      color: signColor(a.cop),
                      fontWeight: 700,
                      fontSize: 13,
                    }}
                  >
                    {(() => {
                      if (a.cop !== 0) return `${a.cop >= 0 ? '+' : ''}${fmtCop(a.cop)}`;
                      if (a.usd !== 0) return <span style={{ color: '#b45309', fontSize: 11 }}>sin TRM</span>;
                      return '—';
                    })()}
                  </td>
                  <td style={{ ...TD, textAlign: 'center' }}>
                    {isActual ? (
                      <span style={ACTUAL_BADGE}>Actual</span>
                    ) : (
                      <span style={{ color: '#94a3b8', fontSize: 11 }}>
                        {a.count === 0 ? 'vacío' : 'registrado'}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
            {/* Fila TOTAL */}
            <tr
              style={{
                background: '#f8fafc',
                borderTop: '2px solid #cbd5e1',
                fontWeight: 700,
              }}
            >
              <td
                style={{
                  ...TD,
                  fontSize: 10,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  color: '#475569',
                  fontWeight: 700,
                  borderBottom: 'none',
                }}
              >
                Total anual
              </td>
              <td style={{ ...TD_NUM, color: '#64748b', borderBottom: 'none' }}>
                {rows.filter((r) => r.year === year).length}
              </td>
              <td
                style={{
                  ...TD_NUM,
                  color: signColor(totalUsd),
                  fontWeight: 700,
                  fontSize: 14,
                  borderBottom: 'none',
                }}
              >
                {totalUsd >= 0 ? '+' : ''}{fmtUsd(totalUsd)}
              </td>
              <td style={{ ...TD_NUM, color: '#94a3b8', borderBottom: 'none' }}>—</td>
              <td
                style={{
                  ...TD_NUM,
                  color: signColor(totalCop),
                  fontWeight: 700,
                  fontSize: 14,
                  borderBottom: 'none',
                }}
              >
                {totalCop === 0 && totalUsd !== 0
                  ? <span style={{ color: '#b45309', fontSize: 11 }}>parcial</span>
                  : `${totalCop >= 0 ? '+' : ''}${fmtCop(totalCop)}`}
              </td>
              <td style={{ ...TD, borderBottom: 'none' }}>{' '}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div
        style={{
          padding: '8px 16px',
          background: '#fafafa',
          borderTop: '1px solid #f1f5f9',
          fontSize: 11,
          color: '#64748b',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <span>
          <strong style={{ color: '#0f172a' }}>Cálculo:</strong>{' '}
          USD por Q = Σ entradas · COP por Q = Σ (usd × trm por entrada) ·
          TRM prom = pond. por |USD|.
        </span>
        <span style={{ color: '#94a3b8', fontSize: 10 }}>
          Editable en tab Exposición
        </span>
      </div>
    </div>
  );
}
