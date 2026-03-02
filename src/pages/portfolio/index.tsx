'use client';

/* eslint-disable no-nested-ternary, no-underscore-dangle, no-restricted-syntax, prefer-template, jsx-a11y/control-has-associated-label */
import { CoreLayout } from '@layout';
import { Row, Col, Form, Modal } from 'react-bootstrap';
import React, { useState, useCallback, useEffect } from 'react';
import Container from 'react-bootstrap/Container';
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import {
  faBriefcase,
  faPlay,
  faSyncAlt,
  faPlus,
  faTrash,
  faLineChart,
  faTable,
  faCog,
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'react-toastify';
import PageTitle from '@components/PageTitle';
import Button from '@components/UI/Button';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  buildCurves,
  getCurveStatus,
  getNdfImpliedCurve,
} from 'src/models/pricing/pricingApi';
import type { CurveStatus, NdfImpliedCurvePoint } from 'src/types/pricing';
import type {
  NewXccyPosition,
  NewNdfPosition,
  NewIbrSwapPosition,
  PricedXccy,
  PricedNdf,
  PricedIbrSwap,
  PortfolioSummary,
} from 'src/types/trading';
import useAppStore from 'src/store';
import MarketDataConfigModal from './_MarketDataConfigModal';
import MarcasPanel from './_MarcasPanel';

const PAGE_TITLE = 'Portafolio de Derivados';

const SOURCE_LABELS: Record<string, string> = {
  set_fx: 'SET FX',
  fxempire: 'FXEmpire',
  fxempire_fwd_pts: 'FXEmpire',
  dtcc: 'DTCC',
  implied: 'Implied',
  banrep: 'Banrep',
  set: 'SET',
  fed: 'Fed',
  manual: 'Manual',
};

const ADD_TYPE_OPTIONS = [
  { value: 'xccy', label: 'XCCY Swap' },
  { value: 'ndf', label: 'NDF' },
  { value: 'ibr', label: 'IBR Swap' },
];

const fmt = (v: number | null | undefined, decimals = 2) =>
  v != null
    ? v.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })
    : '\u2014';

const fmtMM = (v: number | null | undefined) => {
  if (v == null) return '\u2014';
  const abs = Math.abs(v);
  if (abs >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return fmt(v, 2);
};

const fmtInput = (v: number) =>
  v ? v.toLocaleString('en-US', { maximumFractionDigits: 0 }) : '';

const parseInput = (s: string): number => {
  const cleaned = s.replace(/,/g, '');
  return parseFloat(cleaned) || 0;
};

const npvColor = (v: number) => (v >= 0 ? '#28a745' : '#dc3545');

// Compute accrued carry from XCCY cashflows
const computeAccruedCarry = (row: PricedXccy): number => {
  const today = new Date();
  return (row.cashflows ?? []).reduce((sum, cf) => {
    const cfEnd = new Date(cf.end);
    const cfStart = new Date(cf.start);
    const daysInPeriod = Math.max(1, Math.floor((cfEnd.getTime() - cfStart.getTime()) / 86400000));
    const carryCop = cf.cop_interest - cf.usd_interest * row.fx_spot;
    const dailyCarry = carryCop / daysInPeriod;
    const isPast = cfEnd <= today;
    const isCurrent = cfStart <= today && cfEnd > today;
    const daysElapsed = isCurrent
      ? Math.floor((today.getTime() - cfStart.getTime()) / 86400000)
      : isPast ? daysInPeriod : 0;
    return sum + dailyCarry * daysElapsed;
  }, 0);
};

// ── Summary Card ──
function SummaryBar({ summary, pricedAt }: { summary: PortfolioSummary | null; pricedAt: string | undefined }) {
  if (!summary) return null;
  const items: [string, string, string][] = [
    ['NPV COP', fmtMM(summary.total_npv_cop), npvColor(summary.total_npv_cop)],
    ['NPV USD', fmtMM(summary.total_npv_usd), npvColor(summary.total_npv_usd)],
    ['Carry COP', fmtMM(summary.total_carry_cop), npvColor(summary.total_carry_cop)],
    ['P&L Tasas', fmtMM(summary.total_pnl_rate_cop), npvColor(summary.total_pnl_rate_cop)],
    ['P&L FX', fmtMM(summary.total_pnl_fx_cop), npvColor(summary.total_pnl_fx_cop)],
  ];
  return (
    <div
      style={{
        display: 'flex',
        gap: 16,
        flexWrap: 'wrap',
        padding: '12px 16px',
        background: '#f8f9fa',
        border: '1px solid #dee2e6',
        borderRadius: 8,
        marginBottom: 16,
        alignItems: 'center',
      }}
    >
      {items.map(([label, value, color]) => (
        <div key={label} style={{ minWidth: 120 }}>
          <div style={{ fontSize: 10, color: '#6c757d', textTransform: 'uppercase' }}>{label}</div>
          <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'monospace', color }}>
            {value}
          </div>
        </div>
      ))}
      {pricedAt && (
        <div style={{ marginLeft: 'auto', fontSize: 11, color: '#6c757d' }}>
          Valorado a las {pricedAt}
        </div>
      )}
    </div>
  );
}

// ── Curve Status Bar ──
function CurveStatusBar({ status }: { status: CurveStatus | null }) {
  if (!status) return null;
  const curves = [
    { name: 'IBR', built: status.ibr.built },
    { name: 'SOFR', built: status.sofr.built },
    { name: 'NDF', built: status.ndf.built },
  ];
  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        marginBottom: 12,
        fontSize: 12,
        alignItems: 'center',
      }}
    >
      <span style={{ color: '#6c757d' }}>Curvas:</span>
      {curves.map((c) => (
        <span
          key={c.name}
          style={{
            padding: '2px 8px',
            borderRadius: 4,
            background: c.built ? '#d4edda' : '#f8d7da',
            color: c.built ? '#155724' : '#721c24',
            fontWeight: 600,
          }}
        >
          {c.name} {c.built ? '\u2713' : '\u2717'}
        </span>
      ))}
      {status.fx_spot && (
        <span style={{ color: '#004085', fontFamily: 'monospace', fontWeight: 600 }}>
          Spot: {fmt(status.fx_spot, 2)}
        </span>
      )}
    </div>
  );
}

// ── Unified Portfolio Row ──
type PortfolioRow = {
  id: string;
  type: 'XCCY' | 'NDF' | 'IBR';
  label: string;
  counterparty: string;
  notional_usd: number;
  maturity_date: string;
  detail: string;          // type-specific summary
  npv_cop: number;
  npv_usd: number;
  carry_cop: number;       // accrued carry or daily carry
  carry_label: string;     // "Acum" / "Diario" / "Periodo"
  dv01: number;
  dv01_label: string;      // "IBR" / "SOFR" / "IBR" etc
  dv01_2?: number;         // second DV01 for XCCY
  dv01_2_label?: string;
  fx_delta?: number;
  error?: string;
  // Operational fields
  id_operacion?: string;
  trade_date?: string;
  sociedad?: string;
  id_banco?: string;
  estado?: string;
  // Original priced objects for click-through
  _xccy?: PricedXccy;
  _ndf?: PricedNdf;
  _ibr?: PricedIbrSwap;
};

const TYPE_COLORS: Record<string, { bg: string; fg: string }> = {
  XCCY: { bg: '#cce5ff', fg: '#004085' },
  NDF: { bg: '#d4edda', fg: '#155724' },
  IBR: { bg: '#fff3cd', fg: '#856404' },
};

function buildPortfolioRows(
  xccy: PricedXccy[],
  ndf: PricedNdf[],
  ibr: PricedIbrSwap[],
): PortfolioRow[] {
  const rows: PortfolioRow[] = [];

  for (const r of xccy) {
    const accrued = r.error ? 0 : computeAccruedCarry(r);
    rows.push({
      id: r.id, type: 'XCCY', label: r.label, counterparty: r.counterparty,
      notional_usd: r.notional_usd, maturity_date: r.maturity_date,
      detail: `${r.pay_usd ? 'Pay SOFR' : 'Pay IBR'} | ${fmt(r.usd_spread_bps, 0)}bps | ${r.amortization_type} ${r.payment_frequency}`,
      npv_cop: r.npv_cop, npv_usd: r.npv_usd,
      carry_cop: accrued, carry_label: 'Acum',
      dv01: r.dv01_ibr, dv01_label: 'IBR',
      dv01_2: r.dv01_sofr, dv01_2_label: 'SOFR',
      fx_delta: r.fx_delta, error: r.error,
      id_operacion: r.id_operacion, trade_date: r.trade_date, sociedad: r.sociedad, id_banco: r.id_banco, estado: r.estado,
      _xccy: r,
    });
  }

  for (const r of ndf) {
    rows.push({
      id: r.id, type: 'NDF', label: r.label, counterparty: r.counterparty,
      notional_usd: r.notional_usd, maturity_date: r.maturity_date,
      detail: `${r.direction === 'buy' ? 'Compra' : 'Venta'} | Strike ${fmt(r.strike, 2)} | Fwd ${r.error ? '-' : fmt(r.forward, 2)} | ${r.days_to_maturity ?? '?'}d`,
      npv_cop: r.npv_cop, npv_usd: r.npv_usd,
      carry_cop: r.carry_cop_daily, carry_label: '/dia',
      dv01: r.dv01_cop, dv01_label: 'COP',
      dv01_2: r.dv01_usd, dv01_2_label: 'USD',
      fx_delta: r.fx_delta,
      error: r.error,
      id_operacion: r.id_operacion, trade_date: r.trade_date, sociedad: r.sociedad, id_banco: r.id_banco, estado: r.estado,
      _ndf: r,
    });
  }

  for (const r of ibr) {
    rows.push({
      id: r.id, type: 'IBR', label: r.label, counterparty: r.counterparty,
      notional_usd: r.notional / 4200, // approx USD for sorting
      maturity_date: r.maturity_date,
      detail: `${r.pay_fixed ? 'Pay Fija' : 'Pay IBR'} | Fija ${fmt(r.fixed_rate * 100, 2)}% | Fair ${r.error ? '-' : fmt(r.fair_rate * 100, 2)}% | IBR O/N ${r.error ? '-' : fmt(r.ibr_overnight_pct, 2)}% | Diff ${r.error ? '-' : fmt(r.carry_daily_diff_bps, 0)}bps`,
      npv_cop: r.npv, npv_usd: r.npv / 4200,
      carry_cop: r.carry_daily_cop, carry_label: '/dia',
      dv01: r.dv01, dv01_label: 'IBR',
      error: r.error,
      id_operacion: r.id_operacion, trade_date: r.trade_date, sociedad: r.sociedad, id_banco: r.id_banco, estado: r.estado,
      _ibr: r,
    });
  }

  return rows;
}

// ── Unified Portfolio Table ──
function PortfolioTable({
  rows,
  onDelete,
  onSelectXccy,
  onSelectNdf,
  onSelectIbr,
  canEdit = true,
}: {
  rows: PortfolioRow[];
  onDelete: (id: string, type: string) => void;
  onSelectXccy: (r: PricedXccy) => void;
  onSelectNdf: (r: PricedNdf) => void;
  onSelectIbr: (r: PricedIbrSwap) => void;
  canEdit?: boolean;
}) {
  if (rows.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#6c757d', border: '2px dashed #dee2e6', borderRadius: 8 }}>
        No hay posiciones. Agrega una desde el boton o desde los pricers individuales.
      </div>
    );
  }

  const handleSelect = (r: PortfolioRow) => {
    if (r._xccy) onSelectXccy(r._xccy);
    else if (r._ndf) onSelectNdf(r._ndf);
    else if (r._ibr) onSelectIbr(r._ibr);
  };

  const COLS: [string, string][] = [
    ['Tipo', 'Tipo de instrumento: XCCY, NDF, IBR'],
    ['ID Op', 'ID Operacion Interno'],
    ['Contraparte', ''],
    ['Sociedad', 'Codigo sociedad (BP01, BP02, etc.)'],
    ['Nocional', 'Nocional USD (XCCY/NDF) o COP (IBR Swap)'],
    ['Tasa/Strike', 'NDF: Tasa FW. XCCY: Spread USD. IBR: Tasa Fija'],
    ['F. Celebr.', 'Fecha de celebracion de la operacion'],
    ['Vencimiento', 'Fecha de vencimiento o fixing'],
    ['Estado', 'Estado de la operacion: Activo, Vencido, Cancelado'],
    ['NPV COP', 'Valor presente neto en COP. Positivo = a favor'],
    ['NPV USD', 'Valor presente neto en USD. Positivo = a favor'],
    ['Carry COP', 'XCCY: carry acumulado. NDF: theta diario. IBR: carry periodo'],
    ['DV01', 'Sensibilidad en USD a +1bp. XCCY: IBR. NDF: COP curve. IBR: IBR'],
    ['DV01 (2)', 'Sensibilidad en USD a +1bp. XCCY: SOFR. NDF: USD curve'],
    ['FX Delta', 'Cambio en NPV COP por +$1 en USDCOP'],
    ['', ''],
  ];

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
            {COLS.map(([h, tip]) => (
              <th key={h} style={{ padding: '8px 6px', fontWeight: 600, whiteSpace: 'nowrap', cursor: tip ? 'help' : 'default' }} title={tip || undefined}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const tc = TYPE_COLORS[r.type];
            return (
              <tr key={`${r.type}-${r.id}`} style={{ borderBottom: '1px solid #eee' }}>
                {/* Tipo */}
                <td style={{ padding: '6px' }}>
                  <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: tc.bg, color: tc.fg }}>{r.type}</span>
                </td>
                {/* ID Op */}
                <td style={{ padding: '6px', fontSize: 11 }}>
                  {r.id_operacion ? (
                    <button type="button" onClick={() => handleSelect(r)} style={{ background: 'none', border: 'none', color: '#0d6efd', cursor: 'pointer', textDecoration: 'underline', padding: 0, fontSize: 11 }}>
                      {r.id_operacion}
                    </button>
                  ) : (
                    <button type="button" onClick={() => handleSelect(r)} style={{ background: 'none', border: 'none', color: '#0d6efd', cursor: 'pointer', textDecoration: 'underline', padding: 0, fontSize: 11 }}>
                      {r.label || '\u2014'}
                    </button>
                  )}
                </td>
                {/* Contraparte */}
                <td style={{ padding: '6px', fontSize: 11 }}>{r.counterparty || '\u2014'}</td>
                {/* Sociedad */}
                <td style={{ padding: '6px', fontSize: 11 }}>{r.sociedad || '\u2014'}</td>
                {/* Nocional */}
                <td style={{ padding: '6px', fontFamily: 'monospace', fontSize: 11 }}>
                  {r.type === 'IBR' ? fmtMM((r._ibr?.notional ?? 0)) : fmtMM(r.notional_usd)}
                  <span style={{ fontSize: 9, color: '#6c757d', marginLeft: 2 }}>{r.type === 'IBR' ? 'COP' : 'USD'}</span>
                </td>
                {/* Tasa/Strike */}
                <td style={{ padding: '6px', fontFamily: 'monospace', fontSize: 11 }}>
                  {r._ndf ? fmt(r._ndf.strike, 2) : r._xccy ? `${fmt(r._xccy.usd_spread_bps, 0)}bps` : r._ibr ? `${fmt(r._ibr.fixed_rate * 100, 2)}%` : '\u2014'}
                </td>
                {/* F. Celebr. */}
                <td style={{ padding: '6px', fontSize: 11 }}>{r.trade_date || '\u2014'}</td>
                {/* Vencimiento */}
                <td style={{ padding: '6px', fontSize: 11 }}>{r.maturity_date}</td>
                {/* Estado */}
                <td style={{ padding: '6px', fontSize: 11 }}>
                  {r.estado ? (
                    <span style={{ padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600, background: r.estado === 'Activo' ? '#d4edda' : '#f8d7da', color: r.estado === 'Activo' ? '#155724' : '#721c24' }}>
                      {r.estado}
                    </span>
                  ) : '\u2014'}
                </td>
                {/* NPV COP */}
                <td style={{ padding: '6px', fontFamily: 'monospace', fontSize: 11, color: npvColor(r.npv_cop) }}>
                  {r.error ? 'Err' : fmtMM(r.npv_cop)}
                </td>
                {/* NPV USD */}
                <td style={{ padding: '6px', fontFamily: 'monospace', fontSize: 11, color: npvColor(r.npv_usd) }}>
                  {r.error ? 'Err' : fmtMM(r.npv_usd)}
                </td>
                {/* Carry COP */}
                <td style={{ padding: '6px', fontFamily: 'monospace', fontSize: 11, color: npvColor(r.carry_cop) }}>
                  {r.error ? '\u2014' : <>{fmtMM(r.carry_cop)} <span style={{ fontSize: 9, color: '#6c757d' }}>{r.carry_label}</span></>}
                </td>
                {/* DV01 */}
                <td style={{ padding: '6px', fontFamily: 'monospace', fontSize: 11, color: npvColor(r.dv01) }}>
                  {r.error ? '\u2014' : <>{fmtMM(r.dv01)} <span style={{ fontSize: 9, color: '#6c757d' }}>{r.dv01_label}</span></>}
                </td>
                {/* DV01 (2) */}
                <td style={{ padding: '6px', fontFamily: 'monospace', fontSize: 11, color: r.dv01_2 != null ? npvColor(r.dv01_2) : '#6c757d' }}>
                  {r.dv01_2 != null ? <>{fmtMM(r.dv01_2)} <span style={{ fontSize: 9, color: '#6c757d' }}>{r.dv01_2_label}</span></> : '\u2014'}
                </td>
                {/* FX Delta */}
                <td style={{ padding: '6px', fontFamily: 'monospace', fontSize: 11, color: r.fx_delta != null ? npvColor(r.fx_delta) : '#6c757d' }}>
                  {r.fx_delta != null ? fmtMM(r.fx_delta) : '\u2014'}
                </td>
                {/* Delete */}
                <td style={{ padding: '6px' }}>
                  {canEdit && (
                    <button type="button" title="Eliminar" onClick={() => onDelete(r.id, r.type)} style={{ background: 'none', border: 'none', color: '#dc3545', cursor: 'pointer', fontSize: 12 }}>
                      <Icon icon={faTrash} />
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
        {(() => {
          const valid = rows.filter((r) => !r.error);
          const sumNpvCop = valid.reduce((s, r) => s + r.npv_cop, 0);
          const sumNpvUsd = valid.reduce((s, r) => s + r.npv_usd, 0);
          const sumCarry = valid.reduce((s, r) => s + r.carry_cop, 0);
          const sumDv01 = valid.reduce((s, r) => s + r.dv01, 0);
          const sumDv012 = valid.reduce((s, r) => s + (r.dv01_2 ?? 0), 0);
          const sumFx = valid.reduce((s, r) => s + (r.fx_delta ?? 0), 0);
          const tStyle = { padding: '8px 6px', fontFamily: 'monospace' as const, fontSize: 11, fontWeight: 700 as const };
          return (
            <tfoot>
              <tr style={{ borderTop: '2px solid #343a40', background: '#f1f3f5' }}>
                <td style={tStyle} colSpan={9}>TOTAL ({valid.length} posiciones)</td>
                <td style={{ ...tStyle, color: npvColor(sumNpvCop) }}>{fmtMM(sumNpvCop)}</td>
                <td style={{ ...tStyle, color: npvColor(sumNpvUsd) }}>{fmtMM(sumNpvUsd)}</td>
                <td style={{ ...tStyle, color: npvColor(sumCarry) }}>{fmtMM(sumCarry)}</td>
                <td style={{ ...tStyle, color: npvColor(sumDv01) }}>{fmtMM(sumDv01)}</td>
                <td style={{ ...tStyle, color: npvColor(sumDv012) }}>{fmtMM(sumDv012)}</td>
                <td style={{ ...tStyle, color: npvColor(sumFx) }}>{fmtMM(sumFx)}</td>
                <td />
              </tr>
            </tfoot>
          );
        })()}
      </table>
    </div>
  );
}

// ── Add Position Modals ──

function AddXccyModal({
  show,
  onHide,
  onSave,
}: {
  show: boolean;
  onHide: () => void;
  onSave: (v: NewXccyPosition) => void;
}) {
  const [label, setLabel] = useState('');
  const [counterparty, setCounterparty] = useState('');
  const [notionalUsd, setNotionalUsd] = useState(0);
  const [startDate, setStartDate] = useState('');
  const [maturityDate, setMaturityDate] = useState('');
  const [usdSpread, setUsdSpread] = useState(0);
  const [copSpread, setCopSpread] = useState(0);
  const [payUsd, setPayUsd] = useState(true);
  const [fxInitial, setFxInitial] = useState(0);
  const [freq, setFreq] = useState('3M');
  const [amortType, setAmortType] = useState('bullet');
  // Operational
  const [idOperacion, setIdOperacion] = useState('');
  const [tradeDate, setTradeDate] = useState('');
  const [sociedad, setSociedad] = useState('BP01');
  const [idBanco, setIdBanco] = useState('');
  const [modalidad, setModalidad] = useState('Non Delivery');
  const [settlementDate, setSettlementDate] = useState('');
  const [tipoDivisa, setTipoDivisa] = useState('USD/COP');
  const [estado, setEstado] = useState('Activo');
  const [docSap, setDocSap] = useState('');

  const handleSave = () => {
    if (!notionalUsd || !startDate || !maturityDate) {
      toast.warn('Completa nocional, fecha inicio y vencimiento');
      return;
    }
    onSave({
      label,
      counterparty,
      notional_usd: notionalUsd,
      start_date: startDate,
      maturity_date: maturityDate,
      usd_spread_bps: usdSpread,
      cop_spread_bps: copSpread,
      pay_usd: payUsd,
      fx_initial: fxInitial,
      payment_frequency: freq,
      amortization_type: amortType,
      id_operacion: idOperacion || undefined,
      trade_date: tradeDate || undefined,
      sociedad: sociedad || undefined,
      id_banco: idBanco || undefined,
      modalidad: modalidad || undefined,
      settlement_date: settlementDate || undefined,
      tipo_divisa: tipoDivisa || undefined,
      estado: estado || undefined,
      doc_sap: docSap || undefined,
    });
    onHide();
  };

  return (
    <Modal show={show} onHide={onHide} size="lg">
      <Modal.Header closeButton>
        <Modal.Title style={{ fontSize: 16 }}>Nueva Posicion XCCY</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#004085', marginBottom: 6 }}>Datos del Instrumento</div>
        <Row className="g-2 mb-3">
          <Col md={4}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>ID Operacion</Form.Label>
              <Form.Control size="sm" value={idOperacion} onChange={(e) => setIdOperacion(e.target.value)} />
            </Form.Group>
          </Col>
          <Col md={4}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Contraparte</Form.Label>
              <Form.Control size="sm" value={counterparty} onChange={(e) => setCounterparty(e.target.value)} />
            </Form.Group>
          </Col>
          <Col md={4}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Label</Form.Label>
              <Form.Control size="sm" value={label} onChange={(e) => setLabel(e.target.value)} />
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Nocional USD</Form.Label>
              <Form.Control
                size="sm"
                value={fmtInput(notionalUsd)}
                onChange={(e) => setNotionalUsd(parseInput(e.target.value))}
              />
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>FX Pactacion</Form.Label>
              <Form.Control
                size="sm"
                type="number"
                step="0.01"
                value={fxInitial || ''}
                onChange={(e) => setFxInitial(parseFloat(e.target.value) || 0)}
              />
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>USD Spread (bps)</Form.Label>
              <Form.Control
                size="sm"
                type="number"
                step="0.1"
                value={usdSpread || ''}
                onChange={(e) => setUsdSpread(parseFloat(e.target.value) || 0)}
              />
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>COP Spread (bps)</Form.Label>
              <Form.Control
                size="sm"
                type="number"
                step="0.1"
                value={copSpread || ''}
                onChange={(e) => setCopSpread(parseFloat(e.target.value) || 0)}
              />
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Pago</Form.Label>
              <Form.Select size="sm" value={payUsd ? 'usd' : 'cop'} onChange={(e) => setPayUsd(e.target.value === 'usd')}>
                <option value="usd">Pago SOFR</option>
                <option value="cop">Pago IBR</option>
              </Form.Select>
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Frecuencia</Form.Label>
              <Form.Select size="sm" value={freq} onChange={(e) => setFreq(e.target.value)}>
                <option value="1M">Mensual</option>
                <option value="3M">Trimestral</option>
                <option value="6M">Semestral</option>
                <option value="12M">Anual</option>
              </Form.Select>
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Amortizacion</Form.Label>
              <Form.Select size="sm" value={amortType} onChange={(e) => setAmortType(e.target.value)}>
                <option value="bullet">Bullet</option>
                <option value="linear">Lineal</option>
              </Form.Select>
            </Form.Group>
          </Col>
        </Row>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#004085', marginBottom: 6 }}>Fechas y Operacion</div>
        <Row className="g-2">
          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Fecha Celebracion</Form.Label>
              <Form.Control size="sm" type="date" value={tradeDate} onChange={(e) => setTradeDate(e.target.value)} />
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Fecha Inicio</Form.Label>
              <Form.Control size="sm" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Fecha Vencimiento</Form.Label>
              <Form.Control size="sm" type="date" value={maturityDate} onChange={(e) => setMaturityDate(e.target.value)} />
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Fecha Cumplimiento</Form.Label>
              <Form.Control size="sm" type="date" value={settlementDate} onChange={(e) => setSettlementDate(e.target.value)} />
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Modalidad</Form.Label>
              <Form.Select size="sm" value={modalidad} onChange={(e) => setModalidad(e.target.value)}>
                <option value="Non Delivery">Non Delivery</option>
                <option value="Delivery">Delivery</option>
              </Form.Select>
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Tipo Divisa</Form.Label>
              <Form.Select size="sm" value={tipoDivisa} onChange={(e) => setTipoDivisa(e.target.value)}>
                <option value="USD/COP">USD/COP</option>
                <option value="EUR/COP">EUR/COP</option>
              </Form.Select>
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Sociedad</Form.Label>
              <Form.Control size="sm" value={sociedad} onChange={(e) => setSociedad(e.target.value)} />
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>ID Operacion Banco</Form.Label>
              <Form.Control size="sm" value={idBanco} onChange={(e) => setIdBanco(e.target.value)} />
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Estado</Form.Label>
              <Form.Select size="sm" value={estado} onChange={(e) => setEstado(e.target.value)}>
                <option value="Activo">Activo</option>
                <option value="Vencido">Vencido</option>
                <option value="Cancelado">Cancelado</option>
              </Form.Select>
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Doc SAP</Form.Label>
              <Form.Control size="sm" value={docSap} onChange={(e) => setDocSap(e.target.value)} />
            </Form.Group>
          </Col>
        </Row>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" size="sm" onClick={onHide}>Cancelar</Button>
        <Button variant="primary" size="sm" onClick={handleSave}>Guardar</Button>
      </Modal.Footer>
    </Modal>
  );
}

function AddNdfModal({
  show,
  onHide,
  onSave,
}: {
  show: boolean;
  onHide: () => void;
  onSave: (v: NewNdfPosition) => void;
}) {
  const [label, setLabel] = useState('');
  const [counterparty, setCounterparty] = useState('');
  const [notionalUsd, setNotionalUsd] = useState(0);
  const [strike, setStrike] = useState(0);
  const [maturityDate, setMaturityDate] = useState('');
  const [direction, setDirection] = useState('sell');
  // Operational fields
  const [idOperacion, setIdOperacion] = useState('');
  const [tradeDate, setTradeDate] = useState('');
  const [sociedad, setSociedad] = useState('BP01');
  const [idBanco, setIdBanco] = useState('');
  const [modalidad, setModalidad] = useState('Non Delivery');
  const [settlementDate, setSettlementDate] = useState('');
  const [tipoDivisa, setTipoDivisa] = useState('USD/COP');
  const [estado, setEstado] = useState('Activo');
  const [docSap, setDocSap] = useState('');

  const handleSave = () => {
    if (!notionalUsd || !strike || !maturityDate) {
      toast.warn('Completa nocional, strike y fecha vencimiento');
      return;
    }
    onSave({
      label,
      counterparty,
      notional_usd: notionalUsd,
      strike,
      maturity_date: maturityDate,
      direction,
      id_operacion: idOperacion || undefined,
      trade_date: tradeDate || undefined,
      sociedad: sociedad || undefined,
      id_banco: idBanco || undefined,
      modalidad: modalidad || undefined,
      settlement_date: settlementDate || undefined,
      tipo_divisa: tipoDivisa || undefined,
      estado: estado || undefined,
      doc_sap: docSap || undefined,
    });
    onHide();
  };

  return (
    <Modal show={show} onHide={onHide} size="lg">
      <Modal.Header closeButton>
        <Modal.Title style={{ fontSize: 16 }}>Nueva Posicion NDF</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {/* Core fields */}
        <div style={{ fontSize: 11, fontWeight: 700, color: '#004085', marginBottom: 6 }}>Datos del Instrumento</div>
        <Row className="g-2 mb-3">
          <Col md={4}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>ID Operacion Interno</Form.Label>
              <Form.Control size="sm" value={idOperacion} onChange={(e) => setIdOperacion(e.target.value)} placeholder="FW-BOCS-05.02.2026" />
            </Form.Group>
          </Col>
          <Col md={4}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Contraparte</Form.Label>
              <Form.Control size="sm" value={counterparty} onChange={(e) => setCounterparty(e.target.value)} />
            </Form.Group>
          </Col>
          <Col md={4}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Label</Form.Label>
              <Form.Control size="sm" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Nombre descriptivo" />
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Nocional USD</Form.Label>
              <Form.Control
                size="sm"
                value={fmtInput(notionalUsd)}
                onChange={(e) => setNotionalUsd(parseInput(e.target.value))}
              />
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Tasa FW (Strike)</Form.Label>
              <Form.Control
                size="sm"
                type="number"
                step="0.01"
                value={strike || ''}
                onChange={(e) => setStrike(parseFloat(e.target.value) || 0)}
              />
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Tipo Operacion</Form.Label>
              <Form.Select size="sm" value={direction} onChange={(e) => setDirection(e.target.value)}>
                <option value="sell">VENTA (USD)</option>
                <option value="buy">COMPRA (USD)</option>
              </Form.Select>
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Modalidad</Form.Label>
              <Form.Select size="sm" value={modalidad} onChange={(e) => setModalidad(e.target.value)}>
                <option value="Non Delivery">Non Delivery</option>
                <option value="Delivery">Delivery</option>
              </Form.Select>
            </Form.Group>
          </Col>
        </Row>
        {/* Dates & operational */}
        <div style={{ fontSize: 11, fontWeight: 700, color: '#004085', marginBottom: 6 }}>Fechas y Operacion</div>
        <Row className="g-2 mb-3">
          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Fecha Celebracion</Form.Label>
              <Form.Control size="sm" type="date" value={tradeDate} onChange={(e) => setTradeDate(e.target.value)} />
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Fecha Vencimiento</Form.Label>
              <Form.Control size="sm" type="date" value={maturityDate} onChange={(e) => setMaturityDate(e.target.value)} />
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Fecha Cumplimiento</Form.Label>
              <Form.Control size="sm" type="date" value={settlementDate} onChange={(e) => setSettlementDate(e.target.value)} />
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Tipo Divisa</Form.Label>
              <Form.Select size="sm" value={tipoDivisa} onChange={(e) => setTipoDivisa(e.target.value)}>
                <option value="USD/COP">USD/COP</option>
                <option value="EUR/COP">EUR/COP</option>
              </Form.Select>
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Sociedad</Form.Label>
              <Form.Control size="sm" value={sociedad} onChange={(e) => setSociedad(e.target.value)} placeholder="BP01" />
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>ID Operacion Banco</Form.Label>
              <Form.Control size="sm" value={idBanco} onChange={(e) => setIdBanco(e.target.value)} placeholder="FW327520" />
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Estado</Form.Label>
              <Form.Select size="sm" value={estado} onChange={(e) => setEstado(e.target.value)}>
                <option value="Activo">Activo</option>
                <option value="Vencido">Vencido</option>
                <option value="Cancelado">Cancelado</option>
              </Form.Select>
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Doc SAP</Form.Label>
              <Form.Control size="sm" value={docSap} onChange={(e) => setDocSap(e.target.value)} placeholder="6000003210" />
            </Form.Group>
          </Col>
        </Row>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" size="sm" onClick={onHide}>Cancelar</Button>
        <Button variant="primary" size="sm" onClick={handleSave}>Guardar</Button>
      </Modal.Footer>
    </Modal>
  );
}

function AddIbrSwapModal({
  show,
  onHide,
  onSave,
}: {
  show: boolean;
  onHide: () => void;
  onSave: (v: NewIbrSwapPosition) => void;
}) {
  const [label, setLabel] = useState('');
  const [counterparty, setCounterparty] = useState('');
  const [notional, setNotional] = useState(0);
  const [startDate, setStartDate] = useState('');
  const [maturityDate, setMaturityDate] = useState('');
  const [fixedRate, setFixedRate] = useState(0);
  const [payFixed, setPayFixed] = useState(true);
  const [spreadBps, setSpreadBps] = useState(0);
  const [freq, setFreq] = useState('3M');
  const [tenor, setTenor] = useState('');

  const yearsMap: Record<string, number> = { '1Y': 1, '2Y': 2, '3Y': 3, '5Y': 5, '7Y': 7, '10Y': 10, '15Y': 15, '20Y': 20 };

  const calcMaturity = (sd: string, t: string) => {
    if (!sd || !t) return;
    const y = yearsMap[t];
    if (y) {
      const mat = new Date(sd + 'T00:00:00');
      mat.setFullYear(mat.getFullYear() + y);
      setMaturityDate(mat.toISOString().slice(0, 10));
    }
  };

  const handleTenor = (t: string) => {
    setTenor(t);
    calcMaturity(startDate, t);
  };

  const handleStartDate = (sd: string) => {
    setStartDate(sd);
    calcMaturity(sd, tenor);
  };

  // Operational
  const [idOperacion, setIdOperacion] = useState('');
  const [tradeDate, setTradeDate] = useState('');
  const [sociedad, setSociedad] = useState('BP01');
  const [idBanco, setIdBanco] = useState('');
  const [modalidad, setModalidad] = useState('');
  const [settlementDate, setSettlementDate] = useState('');
  const [tipoDivisa, setTipoDivisa] = useState('COP');
  const [estado, setEstado] = useState('Activo');
  const [docSap, setDocSap] = useState('');

  const handleSave = () => {
    if (!notional || !startDate || !maturityDate || !fixedRate) {
      toast.warn('Completa nocional, fechas y tasa fija');
      return;
    }
    onSave({
      label,
      counterparty,
      notional,
      start_date: startDate,
      maturity_date: maturityDate,
      fixed_rate: fixedRate / 100,
      pay_fixed: payFixed,
      spread_bps: spreadBps,
      payment_frequency: freq,
      id_operacion: idOperacion || undefined,
      trade_date: tradeDate || undefined,
      sociedad: sociedad || undefined,
      id_banco: idBanco || undefined,
      modalidad: modalidad || undefined,
      settlement_date: settlementDate || undefined,
      tipo_divisa: tipoDivisa || undefined,
      estado: estado || undefined,
      doc_sap: docSap || undefined,
    });
    onHide();
  };

  return (
    <Modal show={show} onHide={onHide} size="lg">
      <Modal.Header closeButton>
        <Modal.Title style={{ fontSize: 16 }}>Nueva Posicion IBR Swap</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#004085', marginBottom: 6 }}>Datos del Instrumento</div>
        <Row className="g-2 mb-3">
          <Col md={4}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>ID Operacion</Form.Label>
              <Form.Control size="sm" value={idOperacion} onChange={(e) => setIdOperacion(e.target.value)} />
            </Form.Group>
          </Col>
          <Col md={4}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Contraparte</Form.Label>
              <Form.Control size="sm" value={counterparty} onChange={(e) => setCounterparty(e.target.value)} />
            </Form.Group>
          </Col>
          <Col md={4}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Label</Form.Label>
              <Form.Control size="sm" value={label} onChange={(e) => setLabel(e.target.value)} />
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Nocional COP</Form.Label>
              <Form.Control
                size="sm"
                value={fmtInput(notional)}
                onChange={(e) => setNotional(parseInput(e.target.value))}
              />
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Tasa Fija (%)</Form.Label>
              <Form.Control
                size="sm"
                type="number"
                step="0.01"
                value={fixedRate || ''}
                onChange={(e) => setFixedRate(parseFloat(e.target.value) || 0)}
              />
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Spread (bps)</Form.Label>
              <Form.Control
                size="sm"
                type="number"
                step="0.1"
                value={spreadBps || ''}
                onChange={(e) => setSpreadBps(parseFloat(e.target.value) || 0)}
              />
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Pago</Form.Label>
              <Form.Select size="sm" value={payFixed ? 'fixed' : 'float'} onChange={(e) => setPayFixed(e.target.value === 'fixed')}>
                <option value="fixed">Pago Fija</option>
                <option value="float">Pago IBR</option>
              </Form.Select>
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Frecuencia</Form.Label>
              <Form.Select size="sm" value={freq} onChange={(e) => setFreq(e.target.value)}>
                <option value="1M">Mensual</option>
                <option value="3M">Trimestral</option>
                <option value="6M">Semestral</option>
                <option value="12M">Anual</option>
                <option value="Bullet">Bullet</option>
              </Form.Select>
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Tenor</Form.Label>
              <Form.Select size="sm" value={tenor} onChange={(e) => handleTenor(e.target.value)}>
                <option value="">Manual</option>
                <option value="1Y">1 Año</option>
                <option value="2Y">2 Años</option>
                <option value="3Y">3 Años</option>
                <option value="5Y">5 Años</option>
                <option value="7Y">7 Años</option>
                <option value="10Y">10 Años</option>
                <option value="15Y">15 Años</option>
                <option value="20Y">20 Años</option>
              </Form.Select>
              {tenor && <Form.Text style={{ fontSize: 10 }} className="text-muted">Vencimiento auto-calculado</Form.Text>}
            </Form.Group>
          </Col>
        </Row>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#004085', marginBottom: 6 }}>Fechas y Operacion</div>
        <Row className="g-2">
          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Fecha Celebracion</Form.Label>
              <Form.Control size="sm" type="date" value={tradeDate} onChange={(e) => setTradeDate(e.target.value)} />
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Fecha Inicio</Form.Label>
              <Form.Control size="sm" type="date" value={startDate} onChange={(e) => handleStartDate(e.target.value)} />
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Fecha Vencimiento</Form.Label>
              <Form.Control size="sm" type="date" value={maturityDate} onChange={(e) => { setMaturityDate(e.target.value); setTenor(''); }} />
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Fecha Cumplimiento</Form.Label>
              <Form.Control size="sm" type="date" value={settlementDate} onChange={(e) => setSettlementDate(e.target.value)} />
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Modalidad</Form.Label>
              <Form.Control size="sm" value={modalidad} onChange={(e) => setModalidad(e.target.value)} placeholder="OIS, Swap, etc." />
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Tipo Divisa</Form.Label>
              <Form.Select size="sm" value={tipoDivisa} onChange={(e) => setTipoDivisa(e.target.value)}>
                <option value="COP">COP</option>
                <option value="USD/COP">USD/COP</option>
              </Form.Select>
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Sociedad</Form.Label>
              <Form.Control size="sm" value={sociedad} onChange={(e) => setSociedad(e.target.value)} />
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>ID Operacion Banco</Form.Label>
              <Form.Control size="sm" value={idBanco} onChange={(e) => setIdBanco(e.target.value)} />
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Estado</Form.Label>
              <Form.Select size="sm" value={estado} onChange={(e) => setEstado(e.target.value)}>
                <option value="Activo">Activo</option>
                <option value="Vencido">Vencido</option>
                <option value="Cancelado">Cancelado</option>
              </Form.Select>
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Doc SAP</Form.Label>
              <Form.Control size="sm" value={docSap} onChange={(e) => setDocSap(e.target.value)} />
            </Form.Group>
          </Col>
        </Row>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" size="sm" onClick={onHide}>Cancelar</Button>
        <Button variant="primary" size="sm" onClick={handleSave}>Guardar</Button>
      </Modal.Footer>
    </Modal>
  );
}

// ── Detail Modals ──

// Operational fields section (shared across all detail modals)
const OperationalSection = ({ row }: { row: { id_operacion?: string; trade_date?: string; sociedad?: string; id_banco?: string; modalidad?: string; settlement_date?: string; tipo_divisa?: string; estado?: string; doc_sap?: string } }) => {
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
  <div style={{
    flex: 1, padding: '12px 16px', borderRadius: 8, textAlign: 'center',
    background: value >= 0 ? '#d4edda' : '#f8d7da',
  }}>
    <div style={{ fontSize: 10, textTransform: 'uppercase', color: '#6c757d' }}>{label}</div>
    <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'monospace', color: npvColor(value) }}>
      {fmtMM(value)}{suffix}
    </div>
  </div>
);

function XccyDetailModal({ row, show, onHide }: { row: PricedXccy | null; show: boolean; onHide: () => void }) {
  if (!row) return null;
  return (
    <Modal show={show} onHide={onHide} size="xl">
      <Modal.Header closeButton>
        <Modal.Title style={{ fontSize: 16 }}>{row.label} — {row.counterparty}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {/* NPV boxes */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          {npvBox('NPV USD', row.npv_usd)}
          {npvBox('NPV COP', row.npv_cop)}
          {row.par_basis_bps != null && (
            <div style={{ flex: 1, padding: '12px 16px', borderRadius: 8, textAlign: 'center', background: '#cce5ff' }}>
              <div style={{ fontSize: 10, textTransform: 'uppercase', color: '#004085' }}>Par Basis</div>
              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'monospace', color: '#004085' }}>
                {fmt(row.par_basis_bps, 1)} bps
              </div>
            </div>
          )}
        </div>

        {/* P&L decomposition */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1, padding: 12, border: '1px solid #dee2e6', borderRadius: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 4 }}>P&L por Tasas</div>
            <div style={{ fontFamily: 'monospace', fontSize: 14, color: npvColor(row.pnl_rate_cop) }}>
              {fmtMM(row.pnl_rate_cop)} COP
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#6c757d' }}>
              {fmtMM(row.pnl_rate_usd)} USD
            </div>
            <div style={{ fontSize: 10, color: '#6c757d', marginTop: 4 }}>Diferencial de tasas (spread contractual vs mercado)</div>
          </div>
          <div style={{ flex: 1, padding: 12, border: '1px solid #dee2e6', borderRadius: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 4 }}>P&L por FX</div>
            <div style={{ fontFamily: 'monospace', fontSize: 14, color: npvColor(row.pnl_fx_cop) }}>
              {fmtMM(row.pnl_fx_cop)} COP
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#6c757d' }}>
              {fmtMM(row.pnl_fx_usd)} USD
            </div>
            <div style={{ fontSize: 10, color: '#6c757d', marginTop: 4 }}>Movimiento del tipo de cambio (spot vs pactacion)</div>
          </div>
        </div>

        {/* Risk Metrics: DV01 & FX Exposure */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1, padding: 12, border: '2px solid #6f42c1', borderRadius: 8, background: '#f3eefa' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#6f42c1', marginBottom: 8 }}>DV01 (sensibilidad +1bp)</div>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 10, color: '#6c757d' }}>DV01 IBR</div>
                <div style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 700, color: npvColor(row.dv01_ibr) }}>
                  {fmtMM(row.dv01_ibr)} COP
                </div>
                <div style={{ fontSize: 10, color: '#6c757d' }}>Si IBR sube 1bp, NPV cambia en este monto</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#6c757d' }}>DV01 SOFR</div>
                <div style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 700, color: npvColor(row.dv01_sofr) }}>
                  {fmtMM(row.dv01_sofr)} COP
                </div>
                <div style={{ fontSize: 10, color: '#6c757d' }}>Si SOFR sube 1bp, NPV cambia en este monto</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#6c757d' }}>DV01 Total</div>
                <div style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 700, color: npvColor(row.dv01_total) }}>
                  {fmtMM(row.dv01_total)} COP
                </div>
              </div>
            </div>
          </div>
          <div style={{ flex: 1, padding: 12, border: '2px solid #fd7e14', borderRadius: 8, background: '#fff8f0' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fd7e14', marginBottom: 8 }}>FX Exposure</div>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 10, color: '#6c757d' }}>FX Delta</div>
                <div style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 700, color: npvColor(row.fx_delta) }}>
                  {fmtMM(row.fx_delta)} COP
                </div>
                <div style={{ fontSize: 10, color: '#6c757d' }}>Cambio en NPV por +$1 en USDCOP</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#6c757d' }}>Exposicion USD</div>
                <div style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 700 }}>
                  {fmtMM(row.fx_exposure_usd)} USD
                </div>
                <div style={{ fontSize: 10, color: '#6c757d' }}>PV total de pata USD (intereses + principal)</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#6c757d' }}>FX Pactacion</div>
                <div style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 700 }}>
                  {fmt(row.fx_initial, 2)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#6c757d' }}>FX Spot</div>
                <div style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 700 }}>
                  {fmt(row.fx_spot, 2)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Carry breakdown */}
        {(() => {
          const today = new Date();
          const startD = new Date(row.start_date);
          const daysOpen = Math.max(0, Math.floor((today.getTime() - startD.getTime()) / 86400000));

          // Compute per-period carry from cashflows
          const cfCarry = (row.cashflows ?? []).map((cf) => {
            const cfEnd = new Date(cf.end);
            const cfStart = new Date(cf.start);
            const daysInPeriod = Math.max(1, Math.floor((cfEnd.getTime() - cfStart.getTime()) / 86400000));
            const carryCop = cf.cop_interest - cf.usd_interest * row.fx_spot;
            const isPast = cfEnd <= today;
            const isCurrent = cfStart <= today && cfEnd > today;
            const daysElapsed = isCurrent
              ? Math.floor((today.getTime() - cfStart.getTime()) / 86400000)
              : isPast ? daysInPeriod : 0;
            const dailyCarry = carryCop / daysInPeriod;
            const accruedCarry = dailyCarry * daysElapsed;
            return {
              ...cf,
              daysInPeriod,
              carryCop,
              dailyCarry,
              daysElapsed,
              accruedCarry,
              isPast,
              isCurrent,
              diffBps: (cf.cop_rate - cf.usd_rate) * 10000,
            };
          });

          const totalAccrued = cfCarry.reduce((s, c) => s + c.accruedCarry, 0);
          const currentPeriod = cfCarry.find((c) => c.isCurrent);
          const dailyCarryNow = currentPeriod?.dailyCarry ?? 0;

          return (
            <div style={{ padding: 12, border: '2px solid #17a2b8', borderRadius: 8, marginBottom: 16, background: '#e8f8fb' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#17a2b8', marginBottom: 8 }}>Carry &amp; Devengado</div>

              {/* Summary metrics */}
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 10, color: '#6c757d' }}>Dias Abierto</div>
                  <div style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 700 }}>{daysOpen}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: '#6c757d' }}>Carry Diario COP</div>
                  <div style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 700, color: npvColor(dailyCarryNow) }}>
                    {fmtMM(dailyCarryNow)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: '#6c757d' }}>Devengado Acumulado</div>
                  <div style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 700, color: npvColor(totalAccrued) }}>
                    {fmtMM(totalAccrued)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: '#6c757d' }}>Carry Periodo Actual</div>
                  <div style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 600, color: npvColor(row.carry_cop) }}>
                    {fmtMM(row.carry_cop)}
                  </div>
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
                  <div style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 700, color: npvColor(row.carry_differential_bps) }}>
                    {fmt(row.carry_differential_bps, 1)} bps
                  </div>
                </div>
              </div>

              {/* Per-period carry table */}
              {cfCarry.length > 0 && (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #17a2b8' }}>
                        {['#', 'Inicio', 'Fin', 'Dias', 'IBR %', 'SOFR %', 'Diff bps', 'Carry COP', 'Diario COP', 'Dias Devengo', 'Devengado COP', ''].map((h) => (
                          <th key={h} style={{ padding: '4px 4px', fontWeight: 600, whiteSpace: 'nowrap', textAlign: 'right', fontSize: 10, color: '#17a2b8' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {cfCarry.map((c) => (
                        <tr
                          key={c.period}
                          style={{
                            borderBottom: '1px solid #bee5eb',
                            background: c.isCurrent ? '#d1ecf1' : c.isPast ? '#f0fafb' : 'transparent',
                          }}
                        >
                          <td style={{ padding: '3px 4px', textAlign: 'right' }}>{c.period}</td>
                          <td style={{ padding: '3px 4px' }}>{c.start}</td>
                          <td style={{ padding: '3px 4px' }}>{c.end}</td>
                          <td style={{ padding: '3px 4px', textAlign: 'right', fontFamily: 'monospace' }}>{c.daysInPeriod}</td>
                          <td style={{ padding: '3px 4px', textAlign: 'right', fontFamily: 'monospace' }}>{fmt(c.cop_rate, 4)}</td>
                          <td style={{ padding: '3px 4px', textAlign: 'right', fontFamily: 'monospace' }}>{fmt(c.usd_rate, 4)}</td>
                          <td style={{ padding: '3px 4px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: npvColor(c.diffBps) }}>
                            {fmt(c.diffBps, 1)}
                          </td>
                          <td style={{ padding: '3px 4px', textAlign: 'right', fontFamily: 'monospace', color: npvColor(c.carryCop) }}>
                            {fmtMM(c.carryCop)}
                          </td>
                          <td style={{ padding: '3px 4px', textAlign: 'right', fontFamily: 'monospace', color: npvColor(c.dailyCarry) }}>
                            {fmtMM(c.dailyCarry)}
                          </td>
                          <td style={{ padding: '3px 4px', textAlign: 'right', fontFamily: 'monospace' }}>
                            {c.daysElapsed > 0 ? c.daysElapsed : '\u2014'}
                          </td>
                          <td style={{ padding: '3px 4px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: npvColor(c.accruedCarry) }}>
                            {c.daysElapsed > 0 ? fmtMM(c.accruedCarry) : '\u2014'}
                          </td>
                          <td style={{ padding: '3px 4px', textAlign: 'center', fontSize: 10 }}>
                            {c.isCurrent ? 'HOY' : c.isPast ? 'OK' : ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div style={{ fontSize: 10, color: '#6c757d', marginTop: 6 }}>
                Carry = interes COP recibido - interes USD pagado (en COP al spot). Devengado = carry diario x dias transcurridos del periodo.
              </div>
            </div>
          );
        })()}

        {/* Trade details */}
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

        {/* Cashflows */}
        {row.cashflows && row.cashflows.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Flujos de Caja</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                    {['#', 'Inicio', 'Fin', 'Rem%', 'Not USD', 'Rate USD', 'Rate COP', 'Int USD', 'Int COP', 'Princ USD', 'DF USD', 'DF COP', 'Neto COP'].map((h) => (
                      <th key={h} style={{ padding: '4px 4px', fontWeight: 600, whiteSpace: 'nowrap', textAlign: 'right' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {row.cashflows.map((cf) => (
                    <tr key={cf.period} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '3px 4px', textAlign: 'right' }}>{cf.period}</td>
                      <td style={{ padding: '3px 4px' }}>{cf.start}</td>
                      <td style={{ padding: '3px 4px' }}>{cf.end}</td>
                      <td style={{ padding: '3px 4px', textAlign: 'right', fontFamily: 'monospace' }}>{fmt(cf.remaining_pct, 1)}%</td>
                      <td style={{ padding: '3px 4px', textAlign: 'right', fontFamily: 'monospace' }}>{fmtMM(cf.notional_usd)}</td>
                      <td style={{ padding: '3px 4px', textAlign: 'right', fontFamily: 'monospace' }}>{fmt(cf.usd_rate, 4)}%</td>
                      <td style={{ padding: '3px 4px', textAlign: 'right', fontFamily: 'monospace' }}>{fmt(cf.cop_rate, 4)}%</td>
                      <td style={{ padding: '3px 4px', textAlign: 'right', fontFamily: 'monospace' }}>{fmtMM(cf.usd_interest)}</td>
                      <td style={{ padding: '3px 4px', textAlign: 'right', fontFamily: 'monospace' }}>{fmtMM(cf.cop_interest)}</td>
                      <td style={{ padding: '3px 4px', textAlign: 'right', fontFamily: 'monospace' }}>{fmtMM(cf.usd_principal)}</td>
                      <td style={{ padding: '3px 4px', textAlign: 'right', fontFamily: 'monospace' }}>{fmt(cf.usd_df, 6)}</td>
                      <td style={{ padding: '3px 4px', textAlign: 'right', fontFamily: 'monospace' }}>{fmt(cf.cop_df, 6)}</td>
                      <td style={{ padding: '3px 4px', textAlign: 'right', fontFamily: 'monospace', color: npvColor(cf.net_cop) }}>{fmtMM(cf.net_cop)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <OperationalSection row={row} />
      </Modal.Body>
    </Modal>
  );
}

function NdfDetailModal({ row, show, onHide }: { row: PricedNdf | null; show: boolean; onHide: () => void }) {
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
        {/* Risk Metrics: DV01 & FX Exposure */}
        <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
          <div style={{ flex: 1, padding: 12, border: '2px solid #6f42c1', borderRadius: 8, background: '#f3eefa' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#6f42c1', marginBottom: 8 }}>DV01 (sensibilidad +1bp)</div>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 10, color: '#6c757d' }}>DV01 COP</div>
                <div style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 700, color: npvColor(row.dv01_cop) }}>
                  {fmtMM(row.dv01_cop)} COP
                </div>
                <div style={{ fontSize: 10, color: '#6c757d' }}>Si tasa COP sube 1bp</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#6c757d' }}>DV01 USD</div>
                <div style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 700, color: npvColor(row.dv01_usd) }}>
                  {fmtMM(row.dv01_usd)} COP
                </div>
                <div style={{ fontSize: 10, color: '#6c757d' }}>Si tasa USD sube 1bp</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#6c757d' }}>DV01 Total</div>
                <div style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 700, color: npvColor(row.dv01_total) }}>
                  {fmtMM(row.dv01_total)} COP
                </div>
              </div>
            </div>
          </div>
          <div style={{ flex: 1, padding: 12, border: '2px solid #fd7e14', borderRadius: 8, background: '#fff8f0' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fd7e14', marginBottom: 8 }}>FX Exposure</div>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 10, color: '#6c757d' }}>FX Delta</div>
                <div style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 700, color: npvColor(row.fx_delta) }}>
                  {fmtMM(row.fx_delta)} COP
                </div>
                <div style={{ fontSize: 10, color: '#6c757d' }}>Cambio en NPV por +$1 en USDCOP</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#6c757d' }}>Exposicion USD</div>
                <div style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 700 }}>
                  {fmtMM(row.fx_exposure_usd)} USD
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#6c757d' }}>Delta COP (notional)</div>
                <div style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 600 }}>
                  {fmtMM(row.delta_cop)}
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* Carry / Theta */}
        <div style={{ padding: 12, border: '2px solid #17a2b8', borderRadius: 8, marginTop: 16, background: '#e8f8fb' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#17a2b8', marginBottom: 8 }}>Carry / Theta Diario</div>
          <div style={{ display: 'flex', gap: 24 }}>
            <div>
              <div style={{ fontSize: 10, color: '#6c757d' }}>Carry COP / dia</div>
              <div style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 700, color: npvColor(row.carry_cop_daily) }}>
                {fmtMM(row.carry_cop_daily)}
              </div>
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

function IbrSwapDetailModal({ row, show, onHide }: { row: PricedIbrSwap | null; show: boolean; onHide: () => void }) {
  if (!row) return null;
  return (
    <Modal show={show} onHide={onHide} size="lg">
      <Modal.Header closeButton>
        <Modal.Title style={{ fontSize: 16 }}>{row.label} — {row.counterparty}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          {npvBox('NPV COP', row.npv)}
          <div style={{ flex: 1, padding: '12px 16px', borderRadius: 8, textAlign: 'center', background: '#cce5ff' }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', color: '#004085' }}>Fair Rate</div>
            <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'monospace', color: '#004085' }}>
              {fmt(row.fair_rate * 100, 2)}%
            </div>
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
        {/* Carry Diario */}
        <div style={{ padding: 12, border: '2px solid #17a2b8', borderRadius: 8, marginTop: 16, background: '#e8f8fb' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#17a2b8', marginBottom: 8 }}>Carry Diario (IBR Overnight)</div>
          <div style={{ display: 'flex', gap: 24 }}>
            <div>
              <div style={{ fontSize: 10, color: '#6c757d' }}>Carry COP / dia</div>
              <div style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 700, color: npvColor(row.carry_daily_cop) }}>
                {fmtMM(row.carry_daily_cop)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#6c757d' }}>IBR Overnight</div>
              <div style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 600 }}>{fmt(row.ibr_overnight_pct, 4)}%</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#6c757d' }}>Tasa Fija</div>
              <div style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 600 }}>{fmt(row.fixed_rate * 100, 4)}%</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#6c757d' }}>Diferencial</div>
              <div style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 700, color: npvColor(row.carry_daily_diff_bps) }}>
                {fmt(row.carry_daily_diff_bps, 1)} bps
              </div>
            </div>
          </div>
        </div>
        {/* Carry Periodo */}
        <div style={{ padding: 12, border: '1px solid #dee2e6', borderRadius: 8, marginTop: 8, background: '#f8f9fa' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#6c757d', marginBottom: 6 }}>Carry Periodo (Forward implícito)</div>
          <div style={{ display: 'flex', gap: 24 }}>
            <div>
              <div style={{ fontSize: 10, color: '#6c757d' }}>Carry Periodo COP</div>
              <div style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 600, color: npvColor(row.carry_period_cop) }}>
                {fmtMM(row.carry_period_cop)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#6c757d' }}>IBR Fwd Periodo</div>
              <div style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 600 }}>{fmt(row.ibr_fwd_period_pct, 4)}%</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#6c757d' }}>Diff Periodo</div>
              <div style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 600, color: npvColor(row.carry_period_diff_bps) }}>
                {fmt(row.carry_period_diff_bps, 1)} bps
              </div>
            </div>
          </div>
        </div>
        <OperationalSection row={row} />
      </Modal.Body>
    </Modal>
  );
}

// ── Curves Panel (IBR + SOFR side by side) ──
const TENOR_TO_MONTHS: Record<string, number> = {
  '1d': 1 / 30, '1m': 1, '3m': 3, '6m': 6, '9m': 9, '12m': 12,
  '2y': 24, '3y': 36, '5y': 60, '7y': 84, '10y': 120, '15y': 180, '20y': 240,
};

function CurvesPanel({ status }: { status: CurveStatus | null }) {
  if (!status || (!status.ibr.built && !status.sofr.built)) {
    return (
      <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', border: '1px dashed #dee2e6', borderRadius: 8 }}>
        Primero construya las curvas
      </div>
    );
  }

  const ibrNodes = status.ibr.nodes || {};
  const sofrNodes = status.sofr.nodes || {};

  const ibrEntries = Object.entries(ibrNodes).sort((a, b) => {
    const aK = a[0].replace('ibr_', '').toLowerCase();
    const bK = b[0].replace('ibr_', '').toLowerCase();
    return (TENOR_TO_MONTHS[aK] ?? 999) - (TENOR_TO_MONTHS[bK] ?? 999);
  });
  const sofrEntries = Object.entries(sofrNodes).sort((a, b) => Number(a[0]) - Number(b[0]));

  const ibrChart = ibrEntries.map(([k, v]) => {
    const t = k.replace('ibr_', '').toLowerCase();
    return { months: TENOR_TO_MONTHS[t] ?? 0, tenor: t.toUpperCase(), rate: v };
  });
  const sofrChart = sofrEntries.map(([k, v]) => ({
    months: Number(k),
    tenor: Number(k) >= 12 ? `${Number(k) / 12}Y` : `${k}M`,
    rate: v,
  }));

  return (
    <Row>
      <Col md={6}>
        <div style={{ background: '#fff', border: '1px solid #dee2e6', borderRadius: 8, padding: 16 }}>
          <h6 style={{ marginBottom: 12, color: '#1f77b4' }}>Curva IBR ({ibrEntries.length} nodos)</h6>
          {ibrChart.length > 0 && (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={ibrChart}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" dataKey="months" ticks={ibrChart.map((d) => d.months)} tickFormatter={(m: number) => ibrChart.find((d) => d.months === m)?.tenor || ''} tick={{ fontSize: 10 }} />
                <YAxis domain={['auto', 'auto']} tickFormatter={(v: number) => `${v.toFixed(1)}%`} tick={{ fontSize: 10 }} />
                <Tooltip labelFormatter={(m: number) => ibrChart.find((d) => d.months === m)?.tenor || ''} formatter={(v: number) => `${v.toFixed(4)}%`} />
                <Line type="monotone" dataKey="rate" stroke="#1f77b4" strokeWidth={2} dot={{ r: 3 }} name="IBR %" />
              </LineChart>
            </ResponsiveContainer>
          )}
          <div style={{ overflowX: 'auto', maxHeight: 250, marginTop: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead><tr style={{ borderBottom: '2px solid #dee2e6' }}><th style={{ padding: '4px 8px', textAlign: 'left' }}>Tenor</th><th style={{ padding: '4px 8px', textAlign: 'right' }}>Tasa (%)</th></tr></thead>
              <tbody>
                {ibrEntries.map(([k, v]) => (
                  <tr key={k} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '3px 8px', fontWeight: 600 }}>{k.replace('ibr_', '').toUpperCase()}</td>
                    <td style={{ padding: '3px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{v.toFixed(4)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Col>
      <Col md={6}>
        <div style={{ background: '#fff', border: '1px solid #dee2e6', borderRadius: 8, padding: 16 }}>
          <h6 style={{ marginBottom: 12, color: '#ff7f0e' }}>Curva SOFR ({sofrEntries.length} nodos)</h6>
          {sofrChart.length > 0 && (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={sofrChart}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" dataKey="months" ticks={sofrChart.map((d) => d.months)} tickFormatter={(m: number) => sofrChart.find((d) => d.months === m)?.tenor || ''} tick={{ fontSize: 10 }} />
                <YAxis domain={['auto', 'auto']} tickFormatter={(v: number) => `${v.toFixed(1)}%`} tick={{ fontSize: 10 }} />
                <Tooltip labelFormatter={(m: number) => sofrChart.find((d) => d.months === m)?.tenor || ''} formatter={(v: number) => `${v.toFixed(4)}%`} />
                <Line type="monotone" dataKey="rate" stroke="#ff7f0e" strokeWidth={2} dot={{ r: 3 }} name="SOFR %" />
              </LineChart>
            </ResponsiveContainer>
          )}
          <div style={{ overflowX: 'auto', maxHeight: 250, marginTop: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead><tr style={{ borderBottom: '2px solid #dee2e6' }}><th style={{ padding: '4px 8px', textAlign: 'left' }}>Tenor</th><th style={{ padding: '4px 8px', textAlign: 'right' }}>Tasa (%)</th></tr></thead>
              <tbody>
                {sofrEntries.map(([k, v]) => (
                  <tr key={k} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '3px 8px', fontWeight: 600 }}>{Number(k) >= 12 ? `${Number(k) / 12}Y` : `${k}M`}</td>
                    <td style={{ padding: '3px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{v.toFixed(4)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Col>
    </Row>
  );
}

// ── NDF Implied Curve Panel ──
function ImpliedCurvePanel({ data, onLoad, loading, curvesReady }: { data: NdfImpliedCurvePoint[]; onLoad: () => void; loading: boolean; curvesReady: boolean }) {
  return (
    <>
      <div className="mb-3">
        <Button variant="outline-primary" size="sm" onClick={onLoad} disabled={loading || !curvesReady}>
          <Icon icon={faSyncAlt} className="me-1" />
          Cargar Curva Implicita
        </Button>
      </div>
      {data.length > 0 ? (
        <>
          <div style={{ background: '#fff', borderRadius: 8, padding: 16, border: '1px solid #dee2e6' }}>
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" dataKey="tenor_months" ticks={data.map((d) => d.tenor_months)} tickFormatter={(m: number) => data.find((d) => d.tenor_months === m)?.tenor || ''} />
                <YAxis domain={['auto', 'auto']} tickFormatter={(v: number) => fmt(v, 0)} />
                <Tooltip labelFormatter={(m: number) => data.find((d) => d.tenor_months === m)?.tenor || ''} formatter={(v: number) => fmt(v, 2)} />
                <Legend />
                <Line type="monotone" dataKey="forward_market" name="Mercado (FXEmpire)" stroke="#1f77b4" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="forward_irt_parity" name="Implicito (IBR/SOFR)" stroke="#ff7f0e" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div style={{ overflowX: 'auto', marginTop: 12 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #dee2e6' }}>
                  <th style={{ padding: '6px 10px', textAlign: 'left' }}>Tenor</th>
                  <th style={{ padding: '6px 10px', textAlign: 'right' }}>Meses</th>
                  <th style={{ padding: '6px 10px', textAlign: 'right', color: '#1f77b4' }}>Fwd Mercado</th>
                  <th style={{ padding: '6px 10px', textAlign: 'right', color: '#ff7f0e' }}>Fwd Implicito</th>
                  <th style={{ padding: '6px 10px', textAlign: 'right' }}>Basis</th>
                </tr>
              </thead>
              <tbody>
                {data.map((pt) => (
                  <tr key={pt.tenor} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '4px 10px', fontWeight: 600 }}>{pt.tenor}</td>
                    <td style={{ padding: '4px 10px', textAlign: 'right' }}>{pt.tenor_months}</td>
                    <td style={{ padding: '4px 10px', textAlign: 'right', color: '#1f77b4', fontFamily: 'monospace' }}>{fmt(pt.forward_market, 2)}</td>
                    <td style={{ padding: '4px 10px', textAlign: 'right', color: '#ff7f0e', fontFamily: 'monospace' }}>{fmt(pt.forward_irt_parity, 2)}</td>
                    <td style={{ padding: '4px 10px', textAlign: 'right', fontWeight: 600, fontFamily: 'monospace', color: pt.basis > 0 ? '#28a745' : '#dc3545' }}>{fmt(pt.basis, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', border: '1px dashed #dee2e6', borderRadius: 8 }}>
          Presione &quot;Cargar Curva Implicita&quot; para ver Mercado vs Implicita
        </div>
      )}
    </>
  );
}

// ── Main Page ──

function PortfolioPage() {
  const [curveStatus, setCurveStatus] = useState<CurveStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [addType, setAddType] = useState<string | null>(null); // 'xccy' | 'ndf' | 'ibr' | null
  const [selectedXccy, setSelectedXccy] = useState<PricedXccy | null>(null);
  const [selectedNdf, setSelectedNdf] = useState<PricedNdf | null>(null);
  const [selectedIbrSwap, setSelectedIbrSwap] = useState<PricedIbrSwap | null>(null);
  const [viewTab, setViewTab] = useState<'portfolio' | 'curves' | 'implied' | 'marcas'>('portfolio');
  const [impliedCurve, setImpliedCurve] = useState<NdfImpliedCurvePoint[]>([]);
  const [showConfigModal, setShowConfigModal] = useState(false);

  const {
    xccyPositions,
    ndfPositions,
    ibrSwapPositions,
    pricedXccy,
    pricedNdf,
    pricedIbrSwap,
    summary,
    pricedAt,
    tradingLoading,
    tradingError,
    loadPositions,
    repriceAll,
    addXccyPosition,
    addNdfPosition,
    addIbrSwapPosition,
    removeXccyPositions,
    removeNdfPositions,
    removeIbrSwapPositions,
    canEdit,
    loadUserRole,
    userRole,
    marketDataConfig,
    loadMarketDataConfig,
    updateMarketDataConfig,
  } = useAppStore();

  const handleCheckStatus = useCallback(async () => {
    try {
      const status = await getCurveStatus();
      setCurveStatus(status);
    } catch {
      // silently fail
    }
  }, []);

  const handleBuild = useCallback(async () => {
    setLoading(true);
    try {
      const result = await buildCurves();
      setCurveStatus(result.full_status);
      toast.success('Curvas construidas');
    } catch (e) {
      toast.error(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleFetchImplied = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getNdfImpliedCurve();
      setImpliedCurve(data);
    } catch (e) {
      toast.error(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleReprice = useCallback(async () => {
    await repriceAll();
    toast.success('Portafolio repriceado');
  }, [repriceAll]);

  // Auto-load on mount: check curves + load positions + role + market data config
  useEffect(() => {
    handleCheckStatus();
    loadPositions();
    loadUserRole();
    loadMarketDataConfig();
  }, [handleCheckStatus, loadPositions, loadUserRole, loadMarketDataConfig]);


  // Auto-reprice when positions loaded and curves are ready
  const curvesReady =
    curveStatus?.ibr.built && curveStatus?.sofr.built;

  useEffect(() => {
    if (curvesReady) {
      repriceAll();
    }
    // Only reprice when curves become ready, not on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curvesReady]);

  const handleDelete = useCallback(
    (id: string, type: string) => {
      if (type === 'XCCY') removeXccyPositions([id]);
      else if (type === 'NDF') removeNdfPositions([id]);
      else if (type === 'IBR') removeIbrSwapPositions([id]);
      toast.info('Posicion eliminada');
    },
    [removeXccyPositions, removeNdfPositions, removeIbrSwapPositions]
  );

  const isLoading = loading || tradingLoading;

  // Build unified portfolio rows
  const xccyRows: PricedXccy[] = pricedXccy.length > 0
    ? pricedXccy
    : xccyPositions.map((p) => ({ ...p, npv_cop: 0, npv_usd: 0, pnl_rate_cop: 0, pnl_rate_usd: 0, pnl_fx_cop: 0, pnl_fx_usd: 0, usd_leg_pv: 0, cop_leg_pv: 0, usd_principal_pv: 0, cop_principal_pv: 0, carry_cop: 0, carry_usd: 0, carry_rate_cop_pct: 0, carry_rate_usd_pct: 0, carry_differential_bps: 0, dv01_ibr: 0, dv01_sofr: 0, dv01_total: 0, fx_delta: 0, fx_exposure_usd: 0, par_basis_bps: null, notional_cop: p.notional_usd * p.fx_initial, fx_spot: 0, n_periods: 0, cashflows: [], error: 'Sin pricear' } as PricedXccy));
  const ndfRows: PricedNdf[] = pricedNdf.length > 0
    ? pricedNdf
    : ndfPositions.map((p) => ({ ...p, npv_usd: 0, npv_cop: 0, forward: 0, forward_points: 0, carry_cop_daily: 0, carry_usd_daily: 0, days_to_maturity: 0, df_usd: 0, df_cop: 0, delta_cop: 0, dv01_cop: 0, dv01_usd: 0, dv01_total: 0, fx_delta: 0, fx_exposure_usd: 0, spot: 0, error: 'Sin pricear' } as PricedNdf));
  const ibrRows: PricedIbrSwap[] = pricedIbrSwap.length > 0
    ? pricedIbrSwap
    : ibrSwapPositions.map((p) => ({ ...p, npv: 0, fair_rate: 0, dv01: 0, fixed_leg_npv: 0, floating_leg_npv: 0, ibr_overnight_pct: 0, carry_daily_cop: 0, carry_daily_diff_bps: 0, ibr_fwd_period_pct: 0, carry_period_cop: 0, carry_period_diff_bps: 0, error: 'Sin pricear' } as PricedIbrSwap));

  const portfolioRows = buildPortfolioRows(xccyRows, ndfRows, ibrRows);

  return (
    <CoreLayout>
      <Container fluid className="px-4">
        {/* Header */}
        <Row>
          <div className="d-flex align-items-center justify-content-between py-1">
            <PageTitle>
              <Icon icon={faBriefcase} size="1x" />
              <h4>{PAGE_TITLE}</h4>
              {userRole.company_name && (
                <span style={{ fontSize: 12, color: '#6c757d', marginLeft: 8 }}>
                  {userRole.company_name}
                  <span style={{
                    marginLeft: 6, padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600,
                    background: userRole.role === 'admin' ? '#198754' : userRole.role === 'manager' ? '#0d6efd' : '#6c757d',
                    color: '#fff',
                  }}>
                    {userRole.role}
                  </span>
                </span>
              )}
            </PageTitle>
            <div className="d-flex align-items-center gap-2">
              <Button
                variant="outline-success"
                onClick={handleBuild}
                disabled={isLoading}
              >
                <Icon icon={faPlay} className="me-1" />
                {curvesReady ? 'Rebuild Curvas' : 'Construir Curvas'}
              </Button>
              <Button
                variant="outline-primary"
                onClick={handleReprice}
                disabled={isLoading || !curvesReady}
              >
                <Icon icon={faSyncAlt} className="me-1" />
                Repricear
              </Button>
              {canEdit && (
                <div className="d-flex align-items-center gap-1">
                  {ADD_TYPE_OPTIONS.map((opt) => (
                    <Button
                      key={opt.value}
                      variant="outline-success"
                      size="sm"
                      onClick={() => setAddType(opt.value)}
                    >
                      <Icon icon={faPlus} className="me-1" />
                      {opt.label}
                    </Button>
                  ))}
                </div>
              )}
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={() => setShowConfigModal(true)}
                title="Configurar fuentes de market data"
              >
                <Icon icon={faCog} className="me-1" />
                Fuentes
              </Button>
            </div>
          </div>
        </Row>

        {/* Curve status */}
        <CurveStatusBar status={curveStatus} />

        {/* Active market data sources */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
          {(
            [
              ['FX', SOURCE_LABELS[marketDataConfig.spot_fx]],
              ['NDF', SOURCE_LABELS[marketDataConfig.ndf_curve]],
              ['IBR', SOURCE_LABELS[marketDataConfig.ibr]],
              ['SOFR', SOURCE_LABELS[marketDataConfig.sofr]],
            ] as [string, string][]
          ).map(([variable, source]) => (
            <span
              key={variable}
              style={{
                fontSize: 11,
                padding: '2px 7px',
                borderRadius: 4,
                background: '#e9ecef',
                color: '#495057',
                fontFamily: 'monospace',
              }}
            >
              {variable}: <strong>{source}</strong>
            </span>
          ))}
        </div>

        {/* Error */}
        {tradingError && (
          <div
            style={{
              padding: '8px 12px',
              background: '#f8d7da',
              color: '#721c24',
              borderRadius: 6,
              fontSize: 12,
              marginBottom: 12,
            }}
          >
            {tradingError}
          </div>
        )}

        {/* Summary */}
        <SummaryBar summary={summary} pricedAt={pricedAt} />

        {/* View Toggle */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
          {([
            ['portfolio', 'Portafolio', faTable],
            ['curves', 'Curvas', faLineChart],
            ['implied', 'Curva Implicita', faLineChart],
            ['marcas', 'Marcas', faTable],
          ] as const).map(([key, label, icon]) => (
            <button
              key={key}
              type="button"
              onClick={() => setViewTab(key)}
              style={{
                padding: '5px 14px',
                fontSize: 12,
                fontWeight: 600,
                border: '1px solid #dee2e6',
                borderRadius: 6,
                cursor: 'pointer',
                background: viewTab === key ? '#0d6efd' : '#fff',
                color: viewTab === key ? '#fff' : '#495057',
              }}
            >
              <Icon icon={icon} className="me-1" />
              {label}
            </button>
          ))}
        </div>

        {/* Content area */}
        {viewTab === 'portfolio' && (
          <div
            style={{
              background: '#fff',
              border: '1px solid #dee2e6',
              borderRadius: 8,
              padding: 20,
            }}
          >
            <PortfolioTable
              rows={portfolioRows}
              onDelete={handleDelete}
              onSelectXccy={setSelectedXccy}
              onSelectNdf={setSelectedNdf}
              onSelectIbr={setSelectedIbrSwap}
              canEdit={canEdit}
            />
          </div>
        )}
        {viewTab === 'curves' && <CurvesPanel status={curveStatus} />}
        {viewTab === 'implied' && (
          <ImpliedCurvePanel
            data={impliedCurve}
            onLoad={handleFetchImplied}
            loading={isLoading}
            curvesReady={!!curvesReady}
          />
        )}
        {viewTab === 'marcas' && <MarcasPanel />}

        {/* Add Modals */}
        <AddXccyModal
          show={addType === 'xccy'}
          onHide={() => setAddType(null)}
          onSave={async (v) => {
            await addXccyPosition(v);
            toast.success('Posicion XCCY creada');
            if (curvesReady) await repriceAll();
          }}
        />
        <AddNdfModal
          show={addType === 'ndf'}
          onHide={() => setAddType(null)}
          onSave={async (v) => {
            await addNdfPosition(v);
            toast.success('Posicion NDF creada');
            if (curvesReady) await repriceAll();
          }}
        />
        <AddIbrSwapModal
          show={addType === 'ibr'}
          onHide={() => setAddType(null)}
          onSave={async (v) => {
            await addIbrSwapPosition(v);
            toast.success('Posicion IBR Swap creada');
            if (curvesReady) await repriceAll();
          }}
        />
        {/* Detail Modals */}
        <XccyDetailModal row={selectedXccy} show={!!selectedXccy} onHide={() => setSelectedXccy(null)} />
        <NdfDetailModal row={selectedNdf} show={!!selectedNdf} onHide={() => setSelectedNdf(null)} />
        <IbrSwapDetailModal row={selectedIbrSwap} show={!!selectedIbrSwap} onHide={() => setSelectedIbrSwap(null)} />

        {/* Market Data Config Modal */}
        <MarketDataConfigModal
          show={showConfigModal}
          onHide={() => setShowConfigModal(false)}
          config={marketDataConfig}
          onSave={updateMarketDataConfig}
        />
      </Container>
    </CoreLayout>
  );
}

export default PortfolioPage;
