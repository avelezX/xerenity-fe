/* eslint-disable no-nested-ternary, jsx-a11y/control-has-associated-label */
/**
 * Tabla de eventos de liquidacion de NDFs.
 *
 * Se renderiza dentro del BlotterTable cuando el filtro de estado es
 * "Liquidado" en el blotter de NDF. Una fila = un evento (cierre total
 * o parcial). Si una posicion tuvo varias parciales, aparece varias veces.
 *
 * Estilo alineado al blotter principal (misma paleta, headers en gris,
 * monospace para numeros). Filas con borde inferior, hover tenue, totals
 * footer al final.
 */
import React, { useMemo } from 'react';
import type { NdfLiquidationRow } from 'src/models/trading';

interface Props {
  liquidations: NdfLiquidationRow[];
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

export default function LiquidationsTable({ liquidations }: Props) {
  const totals = useMemo(() => liquidations.reduce(
    (acc, l) => ({
      monto: acc.monto + (l.monto_liquidado_usd ?? 0),
      pnl_cop: acc.pnl_cop + (l.realized_pnl_cop || 0),
      pnl_usd: acc.pnl_usd + (l.realized_pnl_usd || 0),
    }),
    { monto: 0, pnl_cop: 0, pnl_usd: 0 },
  ), [liquidations]);

  if (liquidations.length === 0) {
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
        Sin liquidaciones registradas.
        <div style={{ fontSize: 11, marginTop: 6, color: '#adb5bd' }}>
          Liquida una posicion desde el blotter de &quot;Activo&quot; para verla aqui.
        </div>
      </div>
    );
  }

  return (
    <div style={{
      border: '1px solid #dee2e6', borderRadius: 8, overflow: 'auto',
      maxHeight: 'calc(100vh - 320px)',
    }}
    >
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>
            <th style={TH}>Fecha liq.</th>
            <th style={TH}>ID Operación</th>
            <th style={TH}>Contraparte</th>
            <th style={TH}>Dir.</th>
            <th style={TH_NUM}>Monto USD</th>
            <th style={TH_NUM}>Strike orig.</th>
            <th style={TH_NUM}>Tasa negoc.</th>
            <th style={TH_NUM}>Tasa ref.</th>
            <th style={TH_NUM}>P&G COP</th>
            <th style={TH_NUM}>P&G USD</th>
            <th style={TH}>Nota</th>
          </tr>
        </thead>
        <tbody>
          {liquidations.map((l) => {
            const isParcial = l.monto_liquidado_usd != null
              && l.notional_original != null
              && l.monto_liquidado_usd < l.notional_original;
            const dirColor = l.direction === 'sell' ? '#28a745' : l.direction === 'buy' ? '#dc3545' : '#6c757d';

            return (
              <tr key={l.liquidation_id} style={{ cursor: 'default' }}>
                <td style={{ ...TD, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                  {l.liquidation_date}
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
          })}
        </tbody>
        <tfoot>
          <tr style={{ background: '#f8f9fa', borderTop: '2px solid #dee2e6' }}>
            <td style={{ ...TD, fontWeight: 700, color: '#495057' }} colSpan={4}>
              Total ({liquidations.length} liquidaciones)
            </td>
            <td style={{ ...TD_NUM, fontWeight: 700 }}>{fmtAmount(totals.monto)}</td>
            <td style={TD} />
            <td style={TD} />
            <td style={TD} />
            <td style={{ ...TD_NUM, color: pnlColor(totals.pnl_cop), fontWeight: 700 }}>
              {fmtCop(totals.pnl_cop)}
            </td>
            <td style={{ ...TD_NUM, color: pnlColor(totals.pnl_usd), fontWeight: 700 }}>
              {fmtUsd(totals.pnl_usd)}
            </td>
            <td style={TD} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
