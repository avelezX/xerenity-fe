/**
 * FwdDetailModals — modales de detalle para NDF, XCCY e IBR Swap.
 *
 * Extraidos de src/pages/portfolio/index.tsx para poderlos reutilizar en
 * el summary de QuarterlyFwdSummary (Los Coches). Los modales muestran
 * NPV, DV01, FX Exposure, Carry/Theta y datos operativos completos.
 *
 * Los tres helpers (fmt, fmtMM, npvColor) + los sub-componentes
 * (OperationalSection, ColTip) tambien viven aqui para que el modulo
 * sea auto-contenido.
 */
import React, { useState } from 'react';
import { Row, Col, Modal } from 'react-bootstrap';
import type { PricedNdf, PricedXccy, PricedIbrSwap } from 'src/types/trading';

// ── Formatters ──────────────────────────────────────────────────

export const fmt = (v: number | null | undefined, decimals = 2): string =>
  v != null
    ? v.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
    : '—';

export const fmtMM = (v: number | null | undefined): string => {
  if (v == null) return '—';
  const abs = Math.abs(v);
  if (abs >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return fmt(v, 2);
};

export const npvColor = (v: number): string => (v >= 0 ? '#28a745' : '#dc3545');

// ── Sub-components ──────────────────────────────────────────────

export function ColTip({ label, tip }: { label: string; tip: string }) {
  const [show, setShow] = useState(false);
  if (!tip) return <span>{label}</span>;
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
      {label}
      <span
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 13,
          height: 13,
          borderRadius: '50%',
          background: '#adb5bd',
          color: '#fff',
          fontSize: 9,
          fontWeight: 700,
          cursor: 'help',
          userSelect: 'none',
          flexShrink: 0,
        }}
      >
        ?
      </span>
      {show && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            zIndex: 9999,
            background: '#212529',
            color: '#fff',
            padding: '6px 10px',
            borderRadius: 5,
            fontSize: 11,
            lineHeight: 1.5,
            width: 220,
            whiteSpace: 'normal',
            pointerEvents: 'none',
            boxShadow: '0 3px 10px rgba(0,0,0,0.35)',
          }}
        >
          {tip}
        </div>
      )}
    </span>
  );
}

export const OperationalSection = ({ row }: { row: { id_operacion?: string; trade_date?: string; sociedad?: string; id_banco?: string; modalidad?: string; settlement_date?: string; tipo_divisa?: string; estado?: string; doc_sap?: string } }) => {
  const hasAny = row.id_operacion || row.trade_date || row.sociedad || row.id_banco || row.estado || row.doc_sap;
  if (!hasAny) return null;
  return (
    <div style={{ padding: 12, border: '1px solid #dee2e6', borderRadius: 8, marginTop: 16, background: '#f8f9fa' }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: '#495057' }}>Datos Operativos</div>
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 12 }}>
        {row.id_operacion && <div><span style={{ color: '#6c757d' }}>ID Operacion:</span> <strong>{row.id_operacion}</strong></div>}
        {row.trade_date && <div><span style={{ color: '#6c757d' }}>Fecha Celebracion:</span> <strong>{row.trade_date}</strong></div>}
        {row.sociedad && <div><span style={{ color: '#6c757d' }}>Sociedad:</span> <strong>{row.sociedad}</strong></div>}
        {row.id_banco && <div><span style={{ color: '#6c757d' }}>ID Banco:</span> <strong>{row.id_banco}</strong></div>}
        {row.modalidad && <div><span style={{ color: '#6c757d' }}>Modalidad:</span> <strong>{row.modalidad}</strong></div>}
        {row.settlement_date && <div><span style={{ color: '#6c757d' }}>Fecha Cumplimiento:</span> <strong>{row.settlement_date}</strong></div>}
        {row.tipo_divisa && <div><span style={{ color: '#6c757d' }}>Tipo Divisa:</span> <strong>{row.tipo_divisa}</strong></div>}
        {row.estado && <div><span style={{ color: '#6c757d' }}>Estado:</span> <strong>{row.estado}</strong></div>}
        {row.doc_sap && <div><span style={{ color: '#6c757d' }}>Doc SAP:</span> <strong>{row.doc_sap}</strong></div>}
      </div>
    </div>
  );
};

const detailRow = (label: string, value: string, color?: string) => (
  <tr key={label}>
    <td style={{ padding: '4px 8px', color: '#6c757d', fontSize: 12, whiteSpace: 'nowrap' }}>{label}</td>
    <td style={{ padding: '4px 8px', fontFamily: 'monospace', fontSize: 12, fontWeight: 600, color: color || '#212529', textAlign: 'right' }}>{value}</td>
  </tr>
);

const npvBox = (label: string, value: number, suffix = '') => (
  <div
    style={{
      flex: 1,
      padding: '12px 16px',
      borderRadius: 8,
      textAlign: 'center',
      background: value >= 0 ? '#d4edda' : '#f8d7da',
    }}
  >
    <div style={{ fontSize: 10, textTransform: 'uppercase', color: '#6c757d' }}>{label}</div>
    <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'monospace', color: npvColor(value) }}>
      {fmtMM(value)}{suffix}
    </div>
  </div>
);

// ── IBR cashflow helper ─────────────────────────────────────────

function generateIbrCashflows(row: PricedIbrSwap) {
  const freqMonths: Record<string, number> = { '1M': 1, '3M': 3, '6M': 6, '12M': 12 };
  const floatingRate = row.fair_rate;
  const maturity = new Date(`${row.maturity_date}T00:00:00`);
  const result = [];

  if (row.payment_frequency === 'Bullet') {
    const start = new Date(`${row.start_date}T00:00:00`);
    const days = Math.round((maturity.getTime() - start.getTime()) / 86400000);
    const fixedAmt = row.notional * row.fixed_rate * days / 365;
    const floatAmt = row.notional * floatingRate * days / 365;
    const net = row.pay_fixed ? floatAmt - fixedAmt : fixedAmt - floatAmt;
    result.push({
      period: 1, start: row.start_date, end: row.maturity_date,
      payment_date: row.maturity_date, days, fixed_rate: row.fixed_rate,
      floating_rate: floatingRate, fixed_amount: fixedAmt,
      floating_amount: floatAmt, net_amount: net, df: 1.0, pv: net,
    });
    return result;
  }

  const months = freqMonths[row.payment_frequency] || 3;
  let periodStart = new Date(`${row.start_date}T00:00:00`);
  let period = 1;

  while (periodStart < maturity && period <= 120) {
    const rawEnd = new Date(periodStart);
    rawEnd.setMonth(rawEnd.getMonth() + months);
    const periodEnd = rawEnd > maturity ? maturity : rawEnd;
    const days = Math.round((periodEnd.getTime() - periodStart.getTime()) / 86400000);
    const fixedAmt = row.notional * row.fixed_rate * days / 365;
    const floatAmt = row.notional * floatingRate * days / 365;
    const net = row.pay_fixed ? floatAmt - fixedAmt : fixedAmt - floatAmt;
    result.push({
      period,
      start: periodStart.toISOString().slice(0, 10),
      end: periodEnd.toISOString().slice(0, 10),
      payment_date: periodEnd.toISOString().slice(0, 10),
      days, fixed_rate: row.fixed_rate, floating_rate: floatingRate,
      fixed_amount: fixedAmt, floating_amount: floatAmt,
      net_amount: net, df: 1.0, pv: net,
    });
    periodStart = new Date(periodEnd);
    period += 1;
  }
  return result;
}

// ── NDF Detail Modal ────────────────────────────────────────────

export function NdfDetailModal({ row, show, onHide }: { row: PricedNdf | null; show: boolean; onHide: () => void }) {
  if (!row) return null;
  return (
    <Modal show={show} onHide={onHide} size="lg">
      <Modal.Header closeButton>
        <Modal.Title style={{ fontSize: 16 }}>{row.label} — {row.counterparty}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          {npvBox('NPV USD', row.npv_usd)}
          {npvBox('NPV COP', row.npv_cop)}
        </div>
        <Row>
          <Col md={6}>
            <table style={{ width: '100%' }}>
              <tbody>
                {detailRow('Forward Implicito', fmt(row.forward, 2))}
                {detailRow('Forward Points', fmt(row.forward_points, 2))}
                {detailRow('Strike', fmt(row.strike, 2))}
                {detailRow('Spot', fmt(row.spot, 2))}
                {detailRow('Direccion', row.direction === 'buy' ? 'Compra USD' : 'Venta USD')}
                {detailRow('Nocional USD', fmtMM(row.notional_usd))}
              </tbody>
            </table>
          </Col>
          <Col md={6}>
            <table style={{ width: '100%' }}>
              <tbody>
                {detailRow('DF USD', fmt(row.df_usd, 6))}
                {detailRow('DF COP', fmt(row.df_cop, 6))}
                {detailRow('Delta COP', fmtMM(row.delta_cop))}
                {detailRow('Dias al Vencimiento', String(row.days_to_maturity))}
                {detailRow('Vencimiento', row.maturity_date)}
              </tbody>
            </table>
          </Col>
        </Row>
        <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
          <div style={{ flex: 1, padding: 12, border: '2px solid #6f42c1', borderRadius: 8, background: '#f3eefa' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#6f42c1', marginBottom: 8 }}>DV01 (sensibilidad +1bp)</div>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 10, color: '#6c757d' }}>DV01 COP</div>
                <div style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 700, color: npvColor(row.dv01_cop) }}>{fmtMM(row.dv01_cop)} COP</div>
                <div style={{ fontSize: 10, color: '#6c757d' }}>Si tasa COP sube 1bp</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#6c757d' }}>DV01 USD</div>
                <div style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 700, color: npvColor(row.dv01_usd) }}>{fmtMM(row.dv01_usd)} COP</div>
                <div style={{ fontSize: 10, color: '#6c757d' }}>Si tasa USD sube 1bp</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#6c757d' }}>DV01 Total</div>
                <div style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 700, color: npvColor(row.dv01_total) }}>{fmtMM(row.dv01_total)} COP</div>
              </div>
            </div>
          </div>
          <div style={{ flex: 1, padding: 12, border: '2px solid #fd7e14', borderRadius: 8, background: '#fff8f0' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fd7e14', marginBottom: 8 }}>FX Exposure</div>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 10, color: '#6c757d' }}>FX Delta</div>
                <div style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 700, color: npvColor(row.fx_delta) }}>{fmtMM(row.fx_delta)} COP</div>
                <div style={{ fontSize: 10, color: '#6c757d' }}>Cambio en NPV por +$1 en USDCOP</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#6c757d' }}>Exposicion USD</div>
                <div style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 700 }}>{fmtMM(row.fx_exposure_usd)} USD</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#6c757d' }}>Delta COP (notional)</div>
                <div style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 600 }}>{fmtMM(row.delta_cop)}</div>
              </div>
            </div>
          </div>
        </div>
        <div style={{ padding: 12, border: '2px solid #17a2b8', borderRadius: 8, marginTop: 16, background: '#e8f8fb' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#17a2b8', marginBottom: 8 }}>Carry / Theta Diario</div>
          <div style={{ display: 'flex', gap: 24 }}>
            <div>
              <div style={{ fontSize: 10, color: '#6c757d' }}>Carry COP / dia</div>
              <div style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 700, color: npvColor(row.carry_cop_daily) }}>{fmtMM(row.carry_cop_daily)}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#6c757d' }}>Carry USD / dia</div>
              <div style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 600 }}>{fmtMM(row.carry_usd_daily)}</div>
            </div>
          </div>
          <div style={{ fontSize: 10, color: '#6c757d', marginTop: 6 }}>
            Theta = decaimiento diario del NPV. Negativo si la posicion pierde valor cada dia.
          </div>
        </div>
        <OperationalSection row={row} />
      </Modal.Body>
    </Modal>
  );
}

// ── XCCY Detail Modal ───────────────────────────────────────────

export function XccyDetailModal({ row, show, onHide }: { row: PricedXccy | null; show: boolean; onHide: () => void }) {
  if (!row) return null;
  return (
    <Modal show={show} onHide={onHide} size="xl">
      <Modal.Header closeButton>
        <Modal.Title style={{ fontSize: 16 }}>{row.label} — {row.counterparty}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          {npvBox('NPV USD', row.npv_usd)}
          {npvBox('NPV COP', row.npv_cop)}
          <div style={{ flex: 1, padding: '12px 16px', borderRadius: 8, textAlign: 'center', background: row.par_basis_bps != null ? '#cce5ff' : '#f8f9fa', border: '1px solid #dee2e6' }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', color: row.par_basis_bps != null ? '#004085' : '#6c757d' }}>
              <ColTip label="Par Basis" tip="Spread justo de basis XCCY para una nueva operación hoy. No disponible para swaps mid-life." />
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'monospace', color: row.par_basis_bps != null ? '#004085' : '#adb5bd' }}>
              {row.par_basis_bps != null ? `${fmt(row.par_basis_bps, 1)} bps` : 'N/A'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1, padding: 12, border: '1px solid #dee2e6', borderRadius: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 4 }}>P&amp;L por Tasas</div>
            <div style={{ fontFamily: 'monospace', fontSize: 14, color: npvColor(row.pnl_rate_cop) }}>{fmtMM(row.pnl_rate_cop)} COP</div>
            <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#6c757d' }}>{fmtMM(row.pnl_rate_usd)} USD</div>
            <div style={{ fontSize: 10, color: '#6c757d', marginTop: 4 }}>Diferencial de tasas (spread contractual vs mercado)</div>
          </div>
          <div style={{ flex: 1, padding: 12, border: '1px solid #dee2e6', borderRadius: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 4 }}>P&amp;L por FX</div>
            <div style={{ fontFamily: 'monospace', fontSize: 14, color: npvColor(row.pnl_fx_cop) }}>{fmtMM(row.pnl_fx_cop)} COP</div>
            <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#6c757d' }}>{fmtMM(row.pnl_fx_usd)} USD</div>
            <div style={{ fontSize: 10, color: '#6c757d', marginTop: 4 }}>Movimiento del tipo de cambio (spot vs pactacion)</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1, padding: 12, border: '2px solid #6f42c1', borderRadius: 8, background: '#f3eefa' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#6f42c1', marginBottom: 8 }}>DV01 (sensibilidad +1bp)</div>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 10, color: '#6c757d' }}>DV01 IBR</div>
                <div style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 700, color: npvColor(row.dv01_ibr) }}>{fmtMM(row.dv01_ibr)} COP</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#6c757d' }}>DV01 SOFR</div>
                <div style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 700, color: npvColor(row.dv01_sofr) }}>{fmtMM(row.dv01_sofr)} COP</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#6c757d' }}>DV01 Total</div>
                <div style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 700, color: npvColor(row.dv01_total) }}>{fmtMM(row.dv01_total)} COP</div>
              </div>
            </div>
          </div>
          <div style={{ flex: 1, padding: 12, border: '2px solid #fd7e14', borderRadius: 8, background: '#fff8f0' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fd7e14', marginBottom: 8 }}>FX Exposure</div>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 10, color: '#6c757d' }}>FX Delta</div>
                <div style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 700, color: npvColor(row.fx_delta) }}>{fmtMM(row.fx_delta)} COP</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#6c757d' }}>Exposicion USD</div>
                <div style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 700 }}>{fmtMM(row.fx_exposure_usd)} USD</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#6c757d' }}>FX Pactacion</div>
                <div style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 700 }}>{fmt(row.fx_initial, 2)}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#6c757d' }}>FX Spot</div>
                <div style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 700 }}>{fmt(row.fx_spot, 2)}</div>
              </div>
            </div>
          </div>
        </div>
        <div style={{ padding: 12, border: '2px solid #17a2b8', borderRadius: 8, marginBottom: 16, background: '#e8f8fb' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#17a2b8', marginBottom: 8 }}>Carry &amp; Devengado</div>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 10, color: '#6c757d' }}>Dias Abierto</div>
              <div style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 700 }}>{row.days_open ?? 0}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#6c757d' }}>Carry Diario COP</div>
              <div style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 700, color: npvColor(row.carry_cop) }}>{fmtMM(row.carry_cop)}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#6c757d' }}>Devengado Acumulado</div>
              <div style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 700, color: npvColor(row.carry_accrued_cop ?? 0) }}>{fmtMM(row.carry_accrued_cop ?? 0)}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#6c757d' }}>Tasa IBR</div>
              <div style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 600 }}>{fmt(row.carry_rate_cop_pct, 4)}%</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#6c757d' }}>Tasa SOFR+Sprd</div>
              <div style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 600 }}>{fmt(row.carry_rate_usd_pct, 4)}%</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#6c757d' }}>Diferencial</div>
              <div style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 700, color: npvColor(row.carry_differential_bps) }}>{fmt(row.carry_differential_bps, 1)} bps</div>
            </div>
          </div>
        </div>
        <Row>
          <Col md={6}>
            <table style={{ width: '100%' }}>
              <tbody>
                {detailRow('Nocional USD', fmtMM(row.notional_usd))}
                {detailRow('Nocional COP', fmtMM(row.notional_cop))}
                {detailRow('FX Pactacion', fmt(row.fx_initial, 2))}
                {detailRow('FX Spot', fmt(row.fx_spot, 2))}
                {detailRow('USD Spread', `${fmt(row.usd_spread_bps, 1)} bps`)}
                {detailRow('COP Spread', `${fmt(row.cop_spread_bps, 1)} bps`)}
              </tbody>
            </table>
          </Col>
          <Col md={6}>
            <table style={{ width: '100%' }}>
              <tbody>
                {detailRow('Pago', row.pay_usd ? 'SOFR (USD)' : 'IBR (COP)')}
                {detailRow('Amortizacion', row.amortization_type)}
                {detailRow('Frecuencia', row.payment_frequency)}
                {detailRow('Periodos', String(row.n_periods))}
                {detailRow('Inicio', row.start_date)}
                {detailRow('Vencimiento', row.maturity_date)}
                {detailRow('Interest PV USD', fmtMM(row.usd_leg_pv))}
                {detailRow('Interest PV COP', fmtMM(row.cop_leg_pv))}
              </tbody>
            </table>
          </Col>
        </Row>
        <OperationalSection row={row} />
      </Modal.Body>
    </Modal>
  );
}

// ── IBR Swap Detail Modal ───────────────────────────────────────

export function IbrSwapDetailModal({ row, show, onHide }: { row: PricedIbrSwap | null; show: boolean; onHide: () => void }) {
  if (!row) return null;
  const cashflows = row.cashflows ?? (row.error ? [] : generateIbrCashflows(row));
  const totalNet = cashflows.reduce((s, c) => s + c.net_amount, 0);

  return (
    <Modal show={show} onHide={onHide} size="xl">
      <Modal.Header closeButton>
        <Modal.Title style={{ fontSize: 16 }}>{row.label} — {row.counterparty}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          {npvBox('NPV COP', row.npv)}
          <div style={{ flex: 1, padding: '12px 16px', borderRadius: 8, textAlign: 'center', background: '#cce5ff' }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', color: '#004085' }}>Fair Rate</div>
            <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'monospace', color: '#004085' }}>{fmt(row.fair_rate * 100, 2)}%</div>
          </div>
        </div>
        <Row>
          <Col md={6}>
            <table style={{ width: '100%' }}>
              <tbody>
                {detailRow('Tasa Fija', `${fmt(row.fixed_rate * 100, 2)}%`)}
                {detailRow('Fair Rate', `${fmt(row.fair_rate * 100, 2)}%`)}
                {detailRow('Spread vs Par', `${fmt((row.fixed_rate - row.fair_rate) * 10000, 1)} bps`)}
                {detailRow('DV01', fmtMM(row.dv01))}
                {detailRow('Nocional COP', fmtMM(row.notional))}
              </tbody>
            </table>
          </Col>
          <Col md={6}>
            <table style={{ width: '100%' }}>
              <tbody>
                {detailRow('Fixed Leg NPV', fmtMM(row.fixed_leg_npv))}
                {detailRow('Floating Leg NPV', fmtMM(row.floating_leg_npv))}
                {detailRow('Pago', row.pay_fixed ? 'Fija' : 'IBR')}
                {detailRow('Frecuencia', row.payment_frequency)}
                {detailRow('Inicio', row.start_date)}
                {detailRow('Vencimiento', row.maturity_date)}
              </tbody>
            </table>
          </Col>
        </Row>
        {cashflows.length > 0 && (
          <div style={{ marginTop: 16, padding: 8, background: '#f8f9fa', borderRadius: 6, fontSize: 12 }}>
            Total neto (todos los periodos):{' '}
            <strong style={{ fontFamily: 'monospace', color: npvColor(totalNet) }}>{fmtMM(totalNet)} COP</strong>
            {!row.cashflows && <span style={{ fontSize: 10, color: '#ffc107', marginLeft: 6 }}>* estimado</span>}
          </div>
        )}
        <OperationalSection row={row} />
      </Modal.Body>
    </Modal>
  );
}
