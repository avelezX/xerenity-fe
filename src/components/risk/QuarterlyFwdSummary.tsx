/**
 * QuarterlyFwdSummary — vista simplificada de FWDs activos agrupados por
 * trimestre (basado en maturity_date). Solo se usa para Los Coches en el
 * tab Benchmark — el resto de empresas no muestran esta seccion.
 *
 * Para cada Q (1..4) renderiza:
 *   - Header con el label del trimestre + cantidad + total notional USD + total NPV USD
 *   - Mini tabla con columnas clave: Tipo, ID/Label, Contraparte, Notional, Strike, Vto, NPV USD, FX Delta
 *
 * El Q actual (basado en el evaluationDate) se destaca con borde verde.
 * Qs sin posiciones activas se muestran colapsados con un indicador discreto.
 */
import React, { useMemo } from 'react';
import type { PricedNdf, PricedXccy, PricedIbrSwap } from 'src/types/trading';
import type { FwdPositionType } from 'src/models/trading/fetchFwdQuarterAssignments';

interface Props {
  ndfs: PricedNdf[];
  xccys: PricedXccy[];
  ibrs: PricedIbrSwap[];
  /** Q actual (1..4) — basado en filterDate global. Para highlight. */
  currentQuarter: number;
  /** Overrides de trimestre por posicion. Key = position_id.
   *  Sin entrada → fallback a quarterOf(trade_date). */
  quarterOverrides?: Record<string, number>;
  /** Callback al reasignar una posicion. onAssign(position_id, tipo, quarter). */
  onAssignQuarter?: (
    positionId: string,
    positionType: FwdPositionType,
    quarter: 1 | 2 | 3 | 4,
  ) => void;
  /** Callback al remover el override (revertir a computed). */
  onClearAssignment?: (positionId: string) => void;
}

type RowLike = {
  id: string;
  tipo: 'NDF' | 'XCCY' | 'IBR';
  label: string;
  counterparty: string;
  notional_usd: number;
  strike_or_fx: number | null;
  trade_date: string;       // fecha de apertura — base del grouping por trimestre
  maturity_date: string;    // fecha de vencimiento — mostrada como columna info
  npv_usd: number;
  fx_delta?: number;
};

const QUARTER_LABEL: Record<number, string> = {
  1: 'Q1 · Ene–Mar',
  2: 'Q2 · Abr–Jun',
  3: 'Q3 · Jul–Sep',
  4: 'Q4 · Oct–Dic',
};

const quarterOf = (isoDate: string): number => {
  const m = parseInt(isoDate.slice(5, 7), 10);
  return Math.ceil(m / 3);
};

const fmtNum = (v: number, dec = 2): string => {
  if (v === 0) return '0';
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(dec)}B`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(dec)}M`;
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(dec === 2 ? 1 : dec)}K`;
  return `${sign}${Math.round(abs)}`;
};

const fmtRate = (v: number | null): string => {
  if (v == null) return '—';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v);
};

const fmtAmount = (v: number): string =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(v);

const pnlColor = (v: number): string => {
  if (v > 0) return '#16a34a';
  if (v < 0) return '#dc2626';
  return '#64748b';
};

// ── Styles ──────────────────────────────────────────────────────────────

const SECTION: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 10,
  overflow: 'hidden',
  marginBottom: 14,
};

const SECTION_CURRENT: React.CSSProperties = {
  ...SECTION,
  borderColor: '#22c55e',
  boxShadow: '0 4px 12px rgba(34, 197, 94, 0.08)',
};

const SECTION_EMPTY: React.CSSProperties = {
  ...SECTION,
  background: '#f9fafb',
  borderStyle: 'dashed',
  borderColor: '#d1d5db',
};

const HEADER: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '12px 16px',
  background: 'linear-gradient(180deg, #f8fafc 0%, #fff 100%)',
  borderBottom: '1px solid #e5e7eb',
};

const HEADER_EMPTY: React.CSSProperties = {
  ...HEADER,
  background: '#f9fafb',
  borderBottomColor: '#e5e7eb',
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
  fontFamily: 'monospace',
};

const TIPO_BADGE: Record<RowLike['tipo'], React.CSSProperties> = {
  NDF:  { background: '#dbeafe', color: '#1d4ed8' },
  XCCY: { background: '#fef3c7', color: '#92400e' },
  IBR:  { background: '#ede9fe', color: '#6d28d9' },
};

// ── Component ───────────────────────────────────────────────────────────

export default function QuarterlyFwdSummary({
  ndfs, xccys, ibrs, currentQuarter,
  quarterOverrides, onAssignQuarter, onClearAssignment,
}: Props) {
  // Unifica las 3 fuentes en una sola lista normalizada de RowLike,
  // filtrando solo posiciones activas (estado='Activo').
  const allActive = useMemo<RowLike[]>(() => {
    const isActive = (estado: string | undefined): boolean =>
      !estado || estado === 'Activo';
    const rows: RowLike[] = [];

    // Fallback: si no hay trade_date, usamos maturity_date (no deberia pasar
    // en datos reales, pero asi no perdemos la posicion en el render).
    const tradeOrFallback = (
      p: { trade_date?: string; maturity_date: string },
    ): string => p.trade_date || p.maturity_date;

    ndfs.forEach((p) => {
      if (!isActive(p.estado) || !p.maturity_date) return;
      rows.push({
        id: p.id,
        tipo: 'NDF',
        label: p.label || p.id_operacion || p.id.slice(0, 8),
        counterparty: p.counterparty || '—',
        notional_usd: p.notional_usd,
        strike_or_fx: p.strike,
        trade_date: tradeOrFallback(p),
        maturity_date: p.maturity_date,
        npv_usd: p.npv_usd,
        fx_delta: p.fx_delta,
      });
    });

    xccys.forEach((p) => {
      if (!isActive(p.estado) || !p.maturity_date) return;
      rows.push({
        id: p.id,
        tipo: 'XCCY',
        label: p.label || p.id_operacion || p.id.slice(0, 8),
        counterparty: p.counterparty || '—',
        notional_usd: p.notional_usd,
        strike_or_fx: p.fx_initial,
        trade_date: tradeOrFallback(p),
        maturity_date: p.maturity_date,
        npv_usd: p.npv_usd,
        fx_delta: p.fx_delta,
      });
    });

    ibrs.forEach((p) => {
      if (!isActive(p.estado) || !p.maturity_date) return;
      rows.push({
        id: p.id,
        tipo: 'IBR',
        label: p.label || p.id_operacion || p.id.slice(0, 8),
        counterparty: p.counterparty || '—',
        notional_usd: p.notional,            // notional COP en IBR; misma columna por simplicidad
        strike_or_fx: p.fixed_rate * 100,
        trade_date: tradeOrFallback(p),
        maturity_date: p.maturity_date,
        npv_usd: 0,                          // IBR es COP-only; no NPV USD nativo
      });
    });

    return rows;
  }, [ndfs, xccys, ibrs]);

  // Q efectivo por posicion: usa override si esta asignado, sino
  // fallback a quarterOf(trade_date). Esto refleja si el hedge fue
  // reasignado manualmente al trimestre de cobertura (vs. el de origen).
  const quarterFor = (r: RowLike): number => {
    const override = quarterOverrides?.[r.id];
    if (override && override >= 1 && override <= 4) return override;
    return quarterOf(r.trade_date);
  };

  const byQuarter = useMemo(() => {
    const acc: Record<number, RowLike[]> = { 1: [], 2: [], 3: [], 4: [] };
    allActive.forEach((r) => {
      const q = quarterFor(r);
      if (q >= 1 && q <= 4) acc[q].push(r);
    });
    Object.keys(acc).forEach((k) => {
      acc[Number(k)].sort((a, b) => {
        const cmp = a.trade_date.localeCompare(b.trade_date);
        return cmp !== 0 ? cmp : a.maturity_date.localeCompare(b.maturity_date);
      });
    });
    return acc;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allActive, quarterOverrides]);

  if (allActive.length === 0) {
    return (
      <div style={{
        padding: 20,
        textAlign: 'center',
        color: '#64748b',
        fontSize: 13,
        border: '1px dashed #d1d5db',
        borderRadius: 10,
        background: '#f9fafb',
      }}
      >
        Sin FWDs activos para mostrar.
      </div>
    );
  }

  return (
    <div>
      <div style={{
        fontSize: 13,
        fontWeight: 700,
        color: '#1e293b',
        marginBottom: 10,
        display: 'flex',
        alignItems: 'baseline',
        gap: 8,
      }}
      >
        Portafolio de Derivados · por trimestre asignado
        <span style={{ fontSize: 11, fontWeight: 500, color: '#64748b' }}>
          ({allActive.length} {allActive.length === 1 ? 'posicion activa' : 'posiciones activas'})
        </span>
      </div>

      {[1, 2, 3, 4].map((q) => {
        const items = byQuarter[q];
        const isCurrent = q === currentQuarter;
        const isEmpty = items.length === 0;

        // Totales por trimestre
        const totalNotional = items.reduce((s, r) => s + r.notional_usd, 0);
        const totalNpvUsd = items.reduce((s, r) => s + r.npv_usd, 0);
        const totalFxDelta = items.reduce((s, r) => s + (r.fx_delta ?? 0), 0);

        let sectionStyle: React.CSSProperties = SECTION;
        if (isEmpty) sectionStyle = SECTION_EMPTY;
        else if (isCurrent) sectionStyle = SECTION_CURRENT;

        return (
          <div
            key={q}
            style={sectionStyle}
          >
            <div style={isEmpty ? HEADER_EMPTY : HEADER}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
                    {QUARTER_LABEL[q]}
                  </span>
                  {isCurrent && (
                    <span style={{
                      fontSize: 9,
                      padding: '2px 7px',
                      borderRadius: 4,
                      background: '#22c55e',
                      color: '#fff',
                      fontWeight: 700,
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                    }}
                    >
                      Actual
                    </span>
                  )}
                  <span style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>
                    {items.length} {items.length === 1 ? 'posicion' : 'posiciones'}
                  </span>
                </div>
              </div>
              {!isEmpty && (
                <div style={{ display: 'flex', gap: 16, fontSize: 11, fontFamily: 'monospace' }}>
                  <div>
                    <span style={{ color: '#64748b' }}>Notional:</span>{' '}
                    <strong style={{ color: '#0f172a' }}>${fmtNum(totalNotional)} USD</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>NPV:</span>{' '}
                    <strong style={{ color: pnlColor(totalNpvUsd) }}>
                      {totalNpvUsd >= 0 ? '+' : ''}{fmtNum(totalNpvUsd)} USD
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>FX Δ:</span>{' '}
                    <strong style={{ color: pnlColor(totalFxDelta) }}>
                      {totalFxDelta >= 0 ? '+' : ''}{fmtNum(totalFxDelta)}
                    </strong>
                  </div>
                </div>
              )}
            </div>

            {!isEmpty && (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ ...TH, width: 56 }}>Tipo</th>
                      <th style={TH}>ID / Label</th>
                      <th style={TH}>Contraparte</th>
                      <th style={TH_NUM}>Notional USD</th>
                      <th style={TH_NUM}>Strike / FX</th>
                      <th style={{ ...TH, width: 110 }}>F. Apertura</th>
                      <th style={{ ...TH, width: 110 }}>Vencimiento</th>
                      <th style={TH_NUM}>NPV USD</th>
                      <th style={TH_NUM}>FX Delta</th>
                      <th style={{ ...TH, width: 130, textAlign: 'center' }} title="Reasignar el trimestre de este FWD. 'Auto' = usa la fecha de apertura.">
                        Asignar Q
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((r) => (
                      <tr key={r.id}>
                        <td style={TD}>
                          <span style={{
                            ...TIPO_BADGE[r.tipo],
                            display: 'inline-block',
                            padding: '2px 6px',
                            borderRadius: 3,
                            fontSize: 9,
                            fontWeight: 700,
                            letterSpacing: '0.04em',
                          }}
                          >
                            {r.tipo}
                          </span>
                        </td>
                        <td style={{ ...TD, fontFamily: 'monospace' }}>
                          <a
                            href={`/portfolio?open=${encodeURIComponent(r.id)}&type=${r.tipo}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Ver detalle en Portafolio de Derivados (abrir en nueva pestaña)"
                            style={{
                              color: '#1d4ed8',
                              textDecoration: 'none',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none'; }}
                          >
                            {r.label}
                            <span style={{ fontSize: 10, color: '#94a3b8' }}>↗</span>
                          </a>
                        </td>
                        <td style={TD}>{r.counterparty}</td>
                        <td style={TD_NUM}>{fmtAmount(r.notional_usd)}</td>
                        <td style={{ ...TD_NUM, color: '#64748b' }}>{fmtRate(r.strike_or_fx)}</td>
                        <td style={{ ...TD, fontFamily: 'monospace', color: '#0f172a', fontWeight: 600 }}>
                          {r.trade_date}
                        </td>
                        <td style={{ ...TD, fontFamily: 'monospace', color: '#64748b' }}>
                          {r.maturity_date}
                        </td>
                        <td style={{ ...TD_NUM, color: pnlColor(r.npv_usd), fontWeight: 700 }}>
                          {r.npv_usd >= 0 ? '+' : ''}{fmtNum(r.npv_usd)}
                        </td>
                        <td style={{ ...TD_NUM, color: pnlColor(r.fx_delta ?? 0) }}>
                          {r.fx_delta != null
                            ? `${(r.fx_delta) >= 0 ? '+' : ''}${fmtNum(r.fx_delta)}`
                            : '—'}
                        </td>
                        <td style={{ ...TD, textAlign: 'center', padding: '4px 8px' }}>
                          <select
                            value={quarterOverrides?.[r.id] ?? 'auto'}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === 'auto') {
                                onClearAssignment?.(r.id);
                              } else {
                                const selectedQ = parseInt(val, 10) as 1 | 2 | 3 | 4;
                                onAssignQuarter?.(r.id, r.tipo, selectedQ);
                              }
                            }}
                            title={quarterOverrides?.[r.id]
                              ? `Override manual — apertura: Q${quarterOf(r.trade_date)}`
                              : `Auto (por fecha de apertura Q${quarterOf(r.trade_date)})`}
                            disabled={!onAssignQuarter}
                            style={{
                              fontSize: 11,
                              padding: '3px 6px',
                              border: quarterOverrides?.[r.id]
                                ? '1px solid #f59e0b'
                                : '1px solid #e2e8f0',
                              borderRadius: 4,
                              background: quarterOverrides?.[r.id] ? '#fffbeb' : '#fff',
                              color: '#0f172a',
                              fontFamily: 'monospace',
                              cursor: onAssignQuarter ? 'pointer' : 'not-allowed',
                              width: '100%',
                              maxWidth: 118,
                            }}
                          >
                            <option value="auto">Auto</option>
                            <option value="1">Q1</option>
                            <option value="2">Q2</option>
                            <option value="3">Q3</option>
                            <option value="4">Q4</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
