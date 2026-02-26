'use client';

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
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'react-toastify';
import PageTitle from '@components/PageTitle';
import Button from '@components/UI/Button';
import { Tab, Tabs, TabItemType } from '@components/UI/Tabs';
import {
  buildCurves,
  getCurveStatus,
} from 'src/models/pricing/pricingApi';
import type { CurveStatus } from 'src/types/pricing';
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

const PAGE_TITLE = 'Portafolio de Derivados';

const TAB_ITEMS: TabItemType[] = [
  { name: 'XCCY Swaps', property: 'xccy', icon: faBriefcase, active: true },
  { name: 'NDF', property: 'ndf', icon: faBriefcase, active: false },
  { name: 'IBR Swaps', property: 'ibr', icon: faBriefcase, active: false },
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

// ── XCCY Table ──
function XccyTable({
  rows,
  onDelete,
}: {
  rows: PricedXccy[];
  onDelete: (id: string) => void;
}) {
  if (rows.length === 0) {
    return (
      <div
        style={{
          padding: 40,
          textAlign: 'center',
          color: '#6c757d',
          border: '2px dashed #dee2e6',
          borderRadius: 8,
        }}
      >
        No hay posiciones XCCY. Agrega una desde el boton o desde el pricer.
      </div>
    );
  }
  return (
    <div style={{ overflowX: 'auto' }}>
      <table
        style={{
          width: '100%',
          fontSize: 12,
          borderCollapse: 'collapse',
        }}
      >
        <thead>
          <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
            {['Label', 'Contraparte', 'Nocional USD', 'Vencimiento', 'Spread USD', 'Pay', 'NPV COP', 'NPV USD', 'Carry COP', 'Par Basis', 'P&L Tasas', 'P&L FX', ''].map((h) => (
              <th key={h} style={{ padding: '8px 6px', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '6px' }}>{r.label || '\u2014'}</td>
              <td style={{ padding: '6px' }}>{r.counterparty || '\u2014'}</td>
              <td style={{ padding: '6px', fontFamily: 'monospace' }}>{fmtMM(r.notional_usd)}</td>
              <td style={{ padding: '6px' }}>{r.maturity_date}</td>
              <td style={{ padding: '6px', fontFamily: 'monospace' }}>{fmt(r.usd_spread_bps, 1)} bps</td>
              <td style={{ padding: '6px' }}>{r.pay_usd ? 'USD' : 'COP'}</td>
              <td style={{ padding: '6px', fontFamily: 'monospace', color: npvColor(r.npv_cop) }}>
                {r.error ? 'Error' : fmtMM(r.npv_cop)}
              </td>
              <td style={{ padding: '6px', fontFamily: 'monospace', color: npvColor(r.npv_usd) }}>
                {r.error ? 'Error' : fmtMM(r.npv_usd)}
              </td>
              <td style={{ padding: '6px', fontFamily: 'monospace', color: npvColor(r.carry_cop) }}>
                {r.error ? '\u2014' : fmtMM(r.carry_cop)}
              </td>
              <td style={{ padding: '6px', fontFamily: 'monospace' }}>
                {r.par_basis_bps != null ? `${fmt(r.par_basis_bps, 1)} bps` : '\u2014'}
              </td>
              <td style={{ padding: '6px', fontFamily: 'monospace', color: npvColor(r.pnl_rate_cop) }}>
                {r.error ? '\u2014' : fmtMM(r.pnl_rate_cop)}
              </td>
              <td style={{ padding: '6px', fontFamily: 'monospace', color: npvColor(r.pnl_fx_cop) }}>
                {r.error ? '\u2014' : fmtMM(r.pnl_fx_cop)}
              </td>
              <td style={{ padding: '6px' }}>
                <button
                  type="button"
                  title="Eliminar"
                  onClick={() => onDelete(r.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#dc3545',
                    cursor: 'pointer',
                    fontSize: 12,
                  }}
                >
                  <Icon icon={faTrash} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── NDF Table ──
function NdfTable({
  rows,
  onDelete,
}: {
  rows: PricedNdf[];
  onDelete: (id: string) => void;
}) {
  if (rows.length === 0) {
    return (
      <div
        style={{
          padding: 40,
          textAlign: 'center',
          color: '#6c757d',
          border: '2px dashed #dee2e6',
          borderRadius: 8,
        }}
      >
        No hay posiciones NDF. Agrega una desde el boton o desde el pricer.
      </div>
    );
  }
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
            {['Label', 'Contraparte', 'Nocional USD', 'Strike', 'Vencimiento', 'Dir', 'Forward', 'NPV USD', 'NPV COP', 'Carry/dia COP', 'Dias', ''].map((h) => (
              <th key={h} style={{ padding: '8px 6px', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '6px' }}>{r.label || '\u2014'}</td>
              <td style={{ padding: '6px' }}>{r.counterparty || '\u2014'}</td>
              <td style={{ padding: '6px', fontFamily: 'monospace' }}>{fmtMM(r.notional_usd)}</td>
              <td style={{ padding: '6px', fontFamily: 'monospace' }}>{fmt(r.strike, 2)}</td>
              <td style={{ padding: '6px' }}>{r.maturity_date}</td>
              <td style={{ padding: '6px' }}>{r.direction === 'buy' ? 'Compra' : 'Venta'}</td>
              <td style={{ padding: '6px', fontFamily: 'monospace' }}>
                {r.error ? 'Error' : fmt(r.forward, 2)}
              </td>
              <td style={{ padding: '6px', fontFamily: 'monospace', color: npvColor(r.npv_usd) }}>
                {r.error ? 'Error' : fmtMM(r.npv_usd)}
              </td>
              <td style={{ padding: '6px', fontFamily: 'monospace', color: npvColor(r.npv_cop) }}>
                {r.error ? 'Error' : fmtMM(r.npv_cop)}
              </td>
              <td style={{ padding: '6px', fontFamily: 'monospace', color: npvColor(r.carry_cop_daily) }}>
                {r.error ? '\u2014' : fmtMM(r.carry_cop_daily)}
              </td>
              <td style={{ padding: '6px', fontFamily: 'monospace' }}>{r.days_to_maturity ?? '\u2014'}</td>
              <td style={{ padding: '6px' }}>
                <button
                  type="button"
                  title="Eliminar"
                  onClick={() => onDelete(r.id)}
                  style={{ background: 'none', border: 'none', color: '#dc3545', cursor: 'pointer', fontSize: 12 }}
                >
                  <Icon icon={faTrash} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── IBR Swap Table ──
function IbrSwapTable({
  rows,
  onDelete,
}: {
  rows: PricedIbrSwap[];
  onDelete: (id: string) => void;
}) {
  if (rows.length === 0) {
    return (
      <div
        style={{
          padding: 40,
          textAlign: 'center',
          color: '#6c757d',
          border: '2px dashed #dee2e6',
          borderRadius: 8,
        }}
      >
        No hay posiciones IBR Swap. Agrega una desde el boton o desde el pricer.
      </div>
    );
  }
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
            {['Label', 'Contraparte', 'Nocional COP', 'Vencimiento', 'Tasa Fija', 'Pay', 'NPV', 'Fair Rate', 'DV01', 'Carry COP', 'Diff bps', ''].map((h) => (
              <th key={h} style={{ padding: '8px 6px', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '6px' }}>{r.label || '\u2014'}</td>
              <td style={{ padding: '6px' }}>{r.counterparty || '\u2014'}</td>
              <td style={{ padding: '6px', fontFamily: 'monospace' }}>{fmtMM(r.notional)}</td>
              <td style={{ padding: '6px' }}>{r.maturity_date}</td>
              <td style={{ padding: '6px', fontFamily: 'monospace' }}>{fmt(r.fixed_rate * 100, 2)}%</td>
              <td style={{ padding: '6px' }}>{r.pay_fixed ? 'Fija' : 'IBR'}</td>
              <td style={{ padding: '6px', fontFamily: 'monospace', color: npvColor(r.npv) }}>
                {r.error ? 'Error' : fmtMM(r.npv)}
              </td>
              <td style={{ padding: '6px', fontFamily: 'monospace' }}>
                {r.error ? '\u2014' : `${fmt(r.fair_rate * 100, 2)}%`}
              </td>
              <td style={{ padding: '6px', fontFamily: 'monospace' }}>
                {r.error ? '\u2014' : fmtMM(r.dv01)}
              </td>
              <td style={{ padding: '6px', fontFamily: 'monospace', color: npvColor(r.carry_cop) }}>
                {r.error ? '\u2014' : fmtMM(r.carry_cop)}
              </td>
              <td style={{ padding: '6px', fontFamily: 'monospace' }}>
                {r.error ? '\u2014' : fmt(r.carry_differential_bps, 1)}
              </td>
              <td style={{ padding: '6px' }}>
                <button
                  type="button"
                  title="Eliminar"
                  onClick={() => onDelete(r.id)}
                  style={{ background: 'none', border: 'none', color: '#dc3545', cursor: 'pointer', fontSize: 12 }}
                >
                  <Icon icon={faTrash} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
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
    });
    onHide();
  };

  return (
    <Modal show={show} onHide={onHide} size="lg">
      <Modal.Header closeButton>
        <Modal.Title style={{ fontSize: 16 }}>Nueva Posicion XCCY</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Row className="g-2">
          <Col md={6}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Label</Form.Label>
              <Form.Control size="sm" value={label} onChange={(e) => setLabel(e.target.value)} />
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Contraparte</Form.Label>
              <Form.Control size="sm" value={counterparty} onChange={(e) => setCounterparty(e.target.value)} />
            </Form.Group>
          </Col>
          <Col md={4}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Nocional USD</Form.Label>
              <Form.Control
                size="sm"
                value={fmtInput(notionalUsd)}
                onChange={(e) => setNotionalUsd(parseInput(e.target.value))}
              />
            </Form.Group>
          </Col>
          <Col md={4}>
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
          <Col md={4}>
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
          <Col md={4}>
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
          <Col md={4}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Fecha Inicio</Form.Label>
              <Form.Control size="sm" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </Form.Group>
          </Col>
          <Col md={4}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Fecha Vencimiento</Form.Label>
              <Form.Control size="sm" type="date" value={maturityDate} onChange={(e) => setMaturityDate(e.target.value)} />
            </Form.Group>
          </Col>
          <Col md={4}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Pago</Form.Label>
              <Form.Select size="sm" value={payUsd ? 'usd' : 'cop'} onChange={(e) => setPayUsd(e.target.value === 'usd')}>
                <option value="usd">Pago SOFR</option>
                <option value="cop">Pago IBR</option>
              </Form.Select>
            </Form.Group>
          </Col>
          <Col md={4}>
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
          <Col md={4}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Amortizacion</Form.Label>
              <Form.Select size="sm" value={amortType} onChange={(e) => setAmortType(e.target.value)}>
                <option value="bullet">Bullet</option>
                <option value="linear">Lineal</option>
              </Form.Select>
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
  const [direction, setDirection] = useState('buy');

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
    });
    onHide();
  };

  return (
    <Modal show={show} onHide={onHide}>
      <Modal.Header closeButton>
        <Modal.Title style={{ fontSize: 16 }}>Nueva Posicion NDF</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Row className="g-2">
          <Col md={6}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Label</Form.Label>
              <Form.Control size="sm" value={label} onChange={(e) => setLabel(e.target.value)} />
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Contraparte</Form.Label>
              <Form.Control size="sm" value={counterparty} onChange={(e) => setCounterparty(e.target.value)} />
            </Form.Group>
          </Col>
          <Col md={4}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Nocional USD</Form.Label>
              <Form.Control
                size="sm"
                value={fmtInput(notionalUsd)}
                onChange={(e) => setNotionalUsd(parseInput(e.target.value))}
              />
            </Form.Group>
          </Col>
          <Col md={4}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Strike (FX)</Form.Label>
              <Form.Control
                size="sm"
                type="number"
                step="0.01"
                value={strike || ''}
                onChange={(e) => setStrike(parseFloat(e.target.value) || 0)}
              />
            </Form.Group>
          </Col>
          <Col md={4}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Direccion</Form.Label>
              <Form.Select size="sm" value={direction} onChange={(e) => setDirection(e.target.value)}>
                <option value="buy">Compra USD</option>
                <option value="sell">Venta USD</option>
              </Form.Select>
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Fecha Vencimiento</Form.Label>
              <Form.Control size="sm" type="date" value={maturityDate} onChange={(e) => setMaturityDate(e.target.value)} />
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
    });
    onHide();
  };

  return (
    <Modal show={show} onHide={onHide} size="lg">
      <Modal.Header closeButton>
        <Modal.Title style={{ fontSize: 16 }}>Nueva Posicion IBR Swap</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Row className="g-2">
          <Col md={6}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Label</Form.Label>
              <Form.Control size="sm" value={label} onChange={(e) => setLabel(e.target.value)} />
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Contraparte</Form.Label>
              <Form.Control size="sm" value={counterparty} onChange={(e) => setCounterparty(e.target.value)} />
            </Form.Group>
          </Col>
          <Col md={4}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Nocional COP</Form.Label>
              <Form.Control
                size="sm"
                value={fmtInput(notional)}
                onChange={(e) => setNotional(parseInput(e.target.value))}
              />
            </Form.Group>
          </Col>
          <Col md={4}>
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
          <Col md={4}>
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
          <Col md={4}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Fecha Inicio</Form.Label>
              <Form.Control size="sm" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </Form.Group>
          </Col>
          <Col md={4}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Fecha Vencimiento</Form.Label>
              <Form.Control size="sm" type="date" value={maturityDate} onChange={(e) => setMaturityDate(e.target.value)} />
            </Form.Group>
          </Col>
          <Col md={4}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12 }}>Pago</Form.Label>
              <Form.Select size="sm" value={payFixed ? 'fixed' : 'float'} onChange={(e) => setPayFixed(e.target.value === 'fixed')}>
                <option value="fixed">Pago Fija</option>
                <option value="float">Pago IBR</option>
              </Form.Select>
            </Form.Group>
          </Col>
          <Col md={4}>
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
        </Row>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" size="sm" onClick={onHide}>Cancelar</Button>
        <Button variant="primary" size="sm" onClick={handleSave}>Guardar</Button>
      </Modal.Footer>
    </Modal>
  );
}

// ── Main Page ──

function PortfolioPage() {
  const [activeTab, setActiveTab] = useState('xccy');
  const [pageTabs, setPageTabs] = useState<TabItemType[]>(TAB_ITEMS);
  const [curveStatus, setCurveStatus] = useState<CurveStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  const {
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
  } = useAppStore();

  const handleTabChange = (tabProp: string) => {
    setActiveTab(tabProp);
    setPageTabs((prev) =>
      prev.map((t) => ({ ...t, active: t.property === tabProp }))
    );
  };

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

  const handleReprice = useCallback(async () => {
    await repriceAll();
    toast.success('Portafolio repriceado');
  }, [repriceAll]);

  // Auto-load on mount: check curves + load positions
  useEffect(() => {
    handleCheckStatus();
    loadPositions();
  }, [handleCheckStatus, loadPositions]);

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

  const handleDeleteXccy = useCallback(
    (id: string) => {
      removeXccyPositions([id]);
      toast.info('Posicion XCCY eliminada');
    },
    [removeXccyPositions]
  );

  const handleDeleteNdf = useCallback(
    (id: string) => {
      removeNdfPositions([id]);
      toast.info('Posicion NDF eliminada');
    },
    [removeNdfPositions]
  );

  const handleDeleteIbrSwap = useCallback(
    (id: string) => {
      removeIbrSwapPositions([id]);
      toast.info('Posicion IBR Swap eliminada');
    },
    [removeIbrSwapPositions]
  );

  const isLoading = loading || tradingLoading;

  return (
    <CoreLayout>
      <Container fluid className="px-4">
        {/* Header */}
        <Row className="mb-3">
          <Col>
            <div className="d-flex align-items-center justify-content-between">
              <PageTitle>
                <Icon icon={faBriefcase} size="1x" />
                <h4 className="mb-0">{PAGE_TITLE}</h4>
              </PageTitle>
              <div className="d-flex gap-2">
                <Button
                  variant="outline-primary"
                  size="sm"
                  onClick={handleBuild}
                  disabled={isLoading}
                >
                  <Icon icon={faPlay} className="me-1" />
                  {isLoading ? 'Construyendo...' : 'Build Curvas'}
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleReprice}
                  disabled={isLoading || !curvesReady}
                >
                  <Icon icon={faSyncAlt} className="me-1" />
                  Repricear
                </Button>
                <Button
                  variant="success"
                  size="sm"
                  onClick={() => setShowAddModal(true)}
                >
                  <Icon icon={faPlus} className="me-1" />
                  Agregar
                </Button>
              </div>
            </div>
          </Col>
        </Row>

        {/* Curve status */}
        <CurveStatusBar status={curveStatus} />

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

        {/* Tabs */}
        <Row className="mb-3">
          <Col>
            <Tabs outlined>
              {pageTabs.map(({ active, name, property, icon }) => (
                <Tab
                  active={active}
                  key={name}
                  onClick={() => handleTabChange(property)}
                >
                  {icon && <Icon icon={icon} />}
                  {name}
                </Tab>
              ))}
            </Tabs>
          </Col>
        </Row>

        {/* Tab Content */}
        <div
          style={{
            background: '#fff',
            border: '1px solid #dee2e6',
            borderRadius: 8,
            padding: 20,
          }}
        >
          {activeTab === 'xccy' && (
            <XccyTable rows={pricedXccy} onDelete={handleDeleteXccy} />
          )}
          {activeTab === 'ndf' && (
            <NdfTable rows={pricedNdf} onDelete={handleDeleteNdf} />
          )}
          {activeTab === 'ibr' && (
            <IbrSwapTable rows={pricedIbrSwap} onDelete={handleDeleteIbrSwap} />
          )}
        </div>

        {/* Add Modals */}
        {activeTab === 'xccy' && (
          <AddXccyModal
            show={showAddModal}
            onHide={() => setShowAddModal(false)}
            onSave={async (v) => {
              await addXccyPosition(v);
              toast.success('Posicion XCCY creada');
              if (curvesReady) await repriceAll();
            }}
          />
        )}
        {activeTab === 'ndf' && (
          <AddNdfModal
            show={showAddModal}
            onHide={() => setShowAddModal(false)}
            onSave={async (v) => {
              await addNdfPosition(v);
              toast.success('Posicion NDF creada');
              if (curvesReady) await repriceAll();
            }}
          />
        )}
        {activeTab === 'ibr' && (
          <AddIbrSwapModal
            show={showAddModal}
            onHide={() => setShowAddModal(false)}
            onSave={async (v) => {
              await addIbrSwapPosition(v);
              toast.success('Posicion IBR Swap creada');
              if (curvesReady) await repriceAll();
            }}
          />
        )}
      </Container>
    </CoreLayout>
  );
}

export default PortfolioPage;
