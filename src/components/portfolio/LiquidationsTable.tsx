/* eslint-disable no-nested-ternary, jsx-a11y/control-has-associated-label */
/**
 * Tabla unificada de eventos de liquidacion + cashflows realizados.
 *
 * Se renderiza dentro del BlotterTable cuando el filtro de estado es
 * "Liquidado". Muestra DOS tipos de evento como filas separadas:
 *
 *   1. NDF Liquidaciones (manuales): cierre total o parcial de un NDF
 *      via el boton "Liquidar". Una fila = un evento (multiples parciales
 *      en la misma posicion aparecen varias veces).
 *
 *   2. XCCY Cashflows trimestrales: cupones realizados de XCCY swaps,
 *      computados con SOFR/IBR realizados + TRM BanRep al payment_date.
 *      Una fila = un periodo settled de un XCCY (un XCCY de 2Y trimestral
 *      genera 8 filas a lo largo de su vida).
 *
 * Las dos secciones tienen sus propios totales y un grand total al final.
 * El "Tipo" se indica con un badge para distinguirlas visualmente.
 *
 * Doble suma: el SummaryBar del padre (/portfolio) ya suma los tres
 * componentes (NDF liquidations + NDF settlements vencidos + XCCY
 * settlements) por separado. Esta tabla solo VISUALIZA — no cambia
 * la logica de suma del SummaryBar. Los totales del footer reflejan
 * lo MOSTRADO (NDF manual + XCCY) — los vencidos NDF automaticos no
 * aparecen aqui por diseno (no son "eventos de liquidacion" sino
 * settlements determinados por la TRM al maturity).
 */
import React, { useMemo, useState } from 'react';
import type { NdfLiquidationRow, XccySettlementRow } from 'src/models/trading';

interface Props {
  liquidations: NdfLiquidationRow[];
  xccySettlements?: XccySettlementRow[];
}

// ── Date filter presets ─────────────────────────────────────────────────

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function currentMonthRange(): { from: string; to: string } {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { from: isoDate(first), to: isoDate(last) };
}

function previousMonthRange(): { from: string; to: string } {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const last = new Date(now.getFullYear(), now.getMonth(), 0);
  return { from: isoDate(first), to: isoDate(last) };
}

function currentYearRange(): { from: string; to: string } {
  const now = new Date();
  return { from: `${now.getFullYear()}-01-01`, to: isoDate(now) };
}

const fmtCop = (v: number): string => {
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : v > 0 ? '+' : '';
  if (v === 0) return '0';
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(1)}K`;
  return `${sign}${Math.round(abs)}`;
};

const fmtUsd = (v: number): string => {
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : v > 0 ? '+' : '';
  if (v === 0) return '0';
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(1)}K`;
  return `${sign}${Math.round(abs)}`;
};

const fmtRate = (v: number | null): string => {
  if (v == null) return '—';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(v);
};

const fmtAmount = (v: number | null): string => {
  if (v == null) return '—';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(v);
};

const pnlColor = (v: number): string => {
  if (v > 0) return '#28a745';
  if (v < 0) return '#dc3545';
  return '#6c757d';
};

const TH: React.CSSProperties = {
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: '#6c757d',
  fontWeight: 600,
  padding: '8px 10px',
  textAlign: 'left',
  borderBottom: '1px solid #dee2e6',
  background: '#f8f9fa',
  position: 'sticky',
  top: 0,
};

const TH_NUM: React.CSSProperties = { ...TH, textAlign: 'right' };

const TD: React.CSSProperties = {
  fontSize: 12,
  padding: '7px 10px',
  borderBottom: '1px solid #f1f3f5',
  verticalAlign: 'middle',
};

const TD_NUM: React.CSSProperties = {
  ...TD,
  textAlign: 'right',
  fontFamily: 'monospace',
};

const SECTION_HEADER: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  padding: '14px 10px 8px',
  color: '#495057',
  background: '#fff',
  borderTop: '1px solid #dee2e6',
};

const TYPE_BADGE: React.CSSProperties = {
  display: 'inline-block',
  padding: '2px 6px',
  borderRadius: 3,
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
};

// ── NDF row renderer ────────────────────────────────────────────────────

interface RenderNdfRowProps {
  l: NdfLiquidationRow;
}

function NdfRow({ l }: RenderNdfRowProps) {
  const isParcial = l.monto_liquidado_usd != null
    && l.notional_original != null
    && l.monto_liquidado_usd < l.notional_original;
  const dirColor = l.direction === 'sell' ? '#28a745' : l.direction === 'buy' ? '#dc3545' : '#6c757d';

  return (
    <tr style={{ cursor: 'default' }}>
      <td style={{ ...TD, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
        {l.liquidation_date}
      </td>
      <td style={TD}>
        <span style={{ ...TYPE_BADGE, background: '#dbeafe', color: '#1d4ed8' }}>NDF</span>
      </td>
      <td style={{ ...TD, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
        <div>{l.id_operacion ?? l.label}</div>
        {isParcial && (
          <div style={{ fontSize: 9, color: '#d97706', fontWeight: 600 }}>
            PARCIAL
          </div>
        )}
      </td>
      <td style={{ ...TD, whiteSpace: 'nowrap' }}>{l.counterparty}</td>
      <td style={{
        ...TD,
        textTransform: 'capitalize',
        fontFamily: 'monospace',
        color: dirColor,
        fontWeight: 600,
      }}
      >
        {l.direction}
      </td>
      <td style={TD_NUM}>{fmtAmount(l.monto_liquidado_usd)}</td>
      <td style={{ ...TD_NUM, color: '#6c757d' }}>{fmtRate(l.strike)}</td>
      <td style={TD_NUM}>{fmtRate(l.tasa_negociada)}</td>
      <td style={TD_NUM}>{fmtRate(l.tasa_referencia)}</td>
      <td style={{ ...TD_NUM, color: pnlColor(l.realized_pnl_cop), fontWeight: 700 }}>
        {fmtCop(l.realized_pnl_cop)}
      </td>
      <td style={{ ...TD_NUM, color: pnlColor(l.realized_pnl_usd), fontWeight: 600 }}>
        {fmtUsd(l.realized_pnl_usd)}
      </td>
      <td style={{ ...TD, color: '#6c757d', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={l.note ?? undefined}>
        {l.note ?? '—'}
      </td>
    </tr>
  );
}

// ── XCCY row renderer ───────────────────────────────────────────────────

interface RenderXccyRowProps {
  s: XccySettlementRow;
}

function XccyRow({ s }: RenderXccyRowProps) {
  // Cliente paga USD → 'sell USD'-ish; recibe COP → 'buy COP'.
  // Mantenemos el mapping legible para no confundir con NDF.
  const dirLabel = s.position_direction === 'pay_usd' ? 'pay USD' : 'rec USD';
  const dirColor = s.position_direction === 'pay_usd' ? '#dc3545' : '#28a745';

  return (
    <tr style={{ cursor: 'default' }}>
      <td style={{ ...TD, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
        {s.payment_date}
      </td>
      <td style={TD}>
        <span style={{ ...TYPE_BADGE, background: '#fef3c7', color: '#92400e' }}>XCCY</span>
      </td>
      <td style={{ ...TD, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
        <div>{s.position_label}</div>
        <div style={{ fontSize: 9, color: '#6c757d', fontWeight: 600 }}>
          {`Cupon Q${s.period_index}`}
        </div>
      </td>
      <td style={{ ...TD, whiteSpace: 'nowrap' }}>{s.position_counterparty}</td>
      <td style={{
        ...TD,
        fontFamily: 'monospace',
        color: dirColor,
        fontWeight: 600,
      }}
      >
        {dirLabel}
      </td>
      <td style={TD_NUM}>{fmtAmount(s.notional_usd_at_period)}</td>
      <td style={{ ...TD_NUM, color: '#6c757d' }}>{fmtRate(s.position_fx_initial)}</td>
      {/* "Tasa negoc." no aplica a XCCY (no hay tasa negociada en cupones) */}
      <td style={{ ...TD_NUM, color: '#adb5bd' }}>—</td>
      <td style={TD_NUM}>{fmtRate(s.trm_at_payment)}</td>
      <td style={{ ...TD_NUM, color: pnlColor(s.realized_pnl_cop), fontWeight: 700 }}>
        {fmtCop(s.realized_pnl_cop)}
      </td>
      <td style={{ ...TD_NUM, color: pnlColor(s.realized_pnl_usd), fontWeight: 600 }}>
        {fmtUsd(s.realized_pnl_usd)}
      </td>
      <td style={{ ...TD, color: '#6c757d', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {`SOFR ${s.realized_sofr != null ? (s.realized_sofr * 100).toFixed(2) : '—'}% · IBR ${s.realized_ibr != null ? (s.realized_ibr * 100).toFixed(2) : '—'}%`}
      </td>
    </tr>
  );
}

// ── Main component ──────────────────────────────────────────────────────

export default function LiquidationsTable({ liquidations, xccySettlements = [] }: Props) {
  // ── Date filter state ──────────────────────────────────────────────
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  const applyPreset = (preset: 'month' | 'prev-month' | 'ytd' | 'clear') => {
    if (preset === 'clear') { setDateFrom(''); setDateTo(''); return; }
    const range = preset === 'month' ? currentMonthRange()
      : preset === 'prev-month' ? previousMonthRange()
        : currentYearRange();
    setDateFrom(range.from);
    setDateTo(range.to);
  };

  const isFiltered = dateFrom !== '' || dateTo !== '';

  const passesDateFilter = (d: string): boolean => {
    if (dateFrom && d < dateFrom) return false;
    if (dateTo && d > dateTo) return false;
    return true;
  };

  // Apply date filter BEFORE all downstream memoization
  const filteredLiquidations = useMemo(
    () => liquidations.filter((l) => passesDateFilter(l.liquidation_date)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [liquidations, dateFrom, dateTo],
  );
  const filteredXccy = useMemo(
    () => xccySettlements.filter((s) => passesDateFilter(s.payment_date)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [xccySettlements, dateFrom, dateTo],
  );

  const ndfTotals = useMemo(() => filteredLiquidations.reduce(
    (acc, l) => ({
      monto: acc.monto + (l.monto_liquidado_usd ?? 0),
      pnl_cop: acc.pnl_cop + (l.realized_pnl_cop || 0),
      pnl_usd: acc.pnl_usd + (l.realized_pnl_usd || 0),
    }),
    { monto: 0, pnl_cop: 0, pnl_usd: 0 },
  ), [filteredLiquidations]);

  const xccyTotals = useMemo(() => filteredXccy.reduce(
    (acc, s) => ({
      monto: acc.monto + (s.notional_usd_at_period ?? 0),
      pnl_cop: acc.pnl_cop + (s.realized_pnl_cop || 0),
      pnl_usd: acc.pnl_usd + (s.realized_pnl_usd || 0),
    }),
    { monto: 0, pnl_cop: 0, pnl_usd: 0 },
  ), [filteredXccy]);

  const grandTotal = useMemo(() => ({
    pnl_cop: ndfTotals.pnl_cop + xccyTotals.pnl_cop,
    pnl_usd: ndfTotals.pnl_usd + xccyTotals.pnl_usd,
    count: filteredLiquidations.length + filteredXccy.length,
  }), [ndfTotals, xccyTotals, filteredLiquidations.length, filteredXccy.length]);

  // Ordenar por fecha dentro de cada seccion (desc)
  const ndfSorted = useMemo(
    () => [...filteredLiquidations].sort((a, b) => b.liquidation_date.localeCompare(a.liquidation_date)),
    [filteredLiquidations],
  );
  const xccySorted = useMemo(
    () => [...filteredXccy].sort((a, b) => b.payment_date.localeCompare(a.payment_date)),
    [filteredXccy],
  );

  if (liquidations.length === 0 && xccySettlements.length === 0) {
    return (
      <div style={{
        padding: 40,
        textAlign: 'center',
        color: '#6c757d',
        border: '2px dashed #dee2e6',
        borderRadius: 8,
        fontSize: 13,
      }}
      >
        Sin liquidaciones ni cashflows trimestrales registrados.
        <div style={{ fontSize: 11, marginTop: 6, color: '#adb5bd' }}>
          Liquida una posicion NDF desde el blotter de &quot;Activo&quot;, o espera al
          siguiente cupon trimestral de un XCCY activo.
        </div>
      </div>
    );
  }

  const emptyAfterFilter = filteredLiquidations.length === 0 && filteredXccy.length === 0;

  const inputStyle: React.CSSProperties = {
    fontSize: 12,
    padding: '4px 8px',
    border: '1px solid #ced4da',
    borderRadius: 4,
    fontFamily: 'monospace',
    color: '#212529',
  };

  const presetBtnStyle: React.CSSProperties = {
    fontSize: 11,
    padding: '4px 10px',
    border: '1px solid #ced4da',
    borderRadius: 999,
    background: '#fff',
    color: '#495057',
    cursor: 'pointer',
    fontWeight: 500,
  };

  const clearBtnStyle: React.CSSProperties = {
    ...presetBtnStyle,
    background: isFiltered ? '#dc3545' : '#e9ecef',
    color: isFiltered ? '#fff' : '#adb5bd',
    borderColor: isFiltered ? '#dc3545' : '#ced4da',
    cursor: isFiltered ? 'pointer' : 'not-allowed',
  };

  return (
    <div>
      {/* ── Date filter bar ─── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexWrap: 'wrap',
        padding: '10px 12px',
        marginBottom: 8,
        background: '#f8f9fa',
        border: '1px solid #dee2e6',
        borderRadius: 6,
      }}
      >
        <span style={{
          fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em',
          fontWeight: 700, color: '#6c757d',
        }}
        >
          Filtrar por fecha:
        </span>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#495057' }}>
          Desde
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            style={inputStyle}
          />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#495057' }}>
          Hasta
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            style={inputStyle}
          />
        </label>
        <div style={{ display: 'flex', gap: 4, marginLeft: 6 }}>
          <button type="button" style={presetBtnStyle} onClick={() => applyPreset('month')}>
            Este mes
          </button>
          <button type="button" style={presetBtnStyle} onClick={() => applyPreset('prev-month')}>
            Mes anterior
          </button>
          <button type="button" style={presetBtnStyle} onClick={() => applyPreset('ytd')}>
            YTD
          </button>
          <button
            type="button"
            style={clearBtnStyle}
            onClick={() => applyPreset('clear')}
            disabled={!isFiltered}
          >
            Limpiar
          </button>
        </div>
        {isFiltered && (
          <span style={{
            marginLeft: 'auto', fontSize: 11, color: '#495057', fontWeight: 500,
          }}
          >
            {`${filteredLiquidations.length + filteredXccy.length} de ${liquidations.length + xccySettlements.length} eventos`}
          </span>
        )}
      </div>

      {emptyAfterFilter ? (
        <div style={{
          padding: 32,
          textAlign: 'center',
          color: '#6c757d',
          border: '2px dashed #dee2e6',
          borderRadius: 8,
          fontSize: 13,
        }}
        >
          Sin liquidaciones ni cashflows trimestrales en el rango de fechas seleccionado.
          <div style={{ fontSize: 11, marginTop: 6, color: '#adb5bd' }}>
            Ajusta el rango o presiona &quot;Limpiar&quot; para ver todos los eventos.
          </div>
        </div>
      ) : (
      <div style={{
        border: '1px solid #dee2e6', borderRadius: 8, overflow: 'auto',
        maxHeight: 'calc(100vh - 380px)',
      }}
      >
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>
            <th style={TH}>Fecha</th>
            <th style={TH}>Tipo</th>
            <th style={TH}>ID / Cupon</th>
            <th style={TH}>Contraparte</th>
            <th style={TH}>Dir.</th>
            <th style={TH_NUM}>Monto USD</th>
            <th style={TH_NUM}>Strike / FX init.</th>
            <th style={TH_NUM}>Tasa negoc.</th>
            <th style={TH_NUM}>Tasa ref. / TRM</th>
            <th style={TH_NUM}>P&G COP</th>
            <th style={TH_NUM}>P&G USD</th>
            <th style={TH}>Nota / Rates</th>
          </tr>
        </thead>
        <tbody>
          {/* ── NDF section ─── */}
          {ndfSorted.length > 0 && (
            <>
              <tr>
                <td colSpan={12} style={SECTION_HEADER}>
                  NDF · Liquidaciones manuales ({ndfSorted.length})
                </td>
              </tr>
              {ndfSorted.map((l) => <NdfRow key={l.liquidation_id} l={l} />)}
              <tr style={{ background: '#f8f9fa' }}>
                <td style={{ ...TD, fontWeight: 600, color: '#495057' }} colSpan={5}>
                  Subtotal NDF
                </td>
                <td style={{ ...TD_NUM, fontWeight: 600 }}>{fmtAmount(ndfTotals.monto)}</td>
                <td style={TD} />
                <td style={TD} />
                <td style={TD} />
                <td style={{ ...TD_NUM, color: pnlColor(ndfTotals.pnl_cop), fontWeight: 700 }}>
                  {fmtCop(ndfTotals.pnl_cop)}
                </td>
                <td style={{ ...TD_NUM, color: pnlColor(ndfTotals.pnl_usd), fontWeight: 700 }}>
                  {fmtUsd(ndfTotals.pnl_usd)}
                </td>
                <td style={TD} />
              </tr>
            </>
          )}

          {/* ── XCCY section ─── */}
          {xccySorted.length > 0 && (
            <>
              <tr>
                <td colSpan={12} style={SECTION_HEADER}>
                  XCCY · Cashflows trimestrales realizados ({xccySorted.length})
                </td>
              </tr>
              {xccySorted.map((s) => (
                <XccyRow key={`${s.xccy_position_id}-${s.period_index}`} s={s} />
              ))}
              <tr style={{ background: '#f8f9fa' }}>
                <td style={{ ...TD, fontWeight: 600, color: '#495057' }} colSpan={5}>
                  Subtotal XCCY
                </td>
                <td style={{ ...TD_NUM, fontWeight: 600 }}>{fmtAmount(xccyTotals.monto)}</td>
                <td style={TD} />
                <td style={TD} />
                <td style={TD} />
                <td style={{ ...TD_NUM, color: pnlColor(xccyTotals.pnl_cop), fontWeight: 700 }}>
                  {fmtCop(xccyTotals.pnl_cop)}
                </td>
                <td style={{ ...TD_NUM, color: pnlColor(xccyTotals.pnl_usd), fontWeight: 700 }}>
                  {fmtUsd(xccyTotals.pnl_usd)}
                </td>
                <td style={TD} />
              </tr>
            </>
          )}
        </tbody>

        {/* ── Grand total ─── */}
        {ndfSorted.length > 0 && xccySorted.length > 0 && (
          <tfoot>
            <tr style={{ background: '#e9ecef', borderTop: '2px solid #495057' }}>
              <td style={{ ...TD, fontWeight: 700, color: '#212529' }} colSpan={9}>
                Total ({grandTotal.count} eventos)
              </td>
              <td style={{ ...TD_NUM, color: pnlColor(grandTotal.pnl_cop), fontWeight: 700 }}>
                {fmtCop(grandTotal.pnl_cop)}
              </td>
              <td style={{ ...TD_NUM, color: pnlColor(grandTotal.pnl_usd), fontWeight: 700 }}>
                {fmtUsd(grandTotal.pnl_usd)}
              </td>
              <td style={TD} />
            </tr>
          </tfoot>
        )}
      </table>
      </div>
      )}
    </div>
  );
}
