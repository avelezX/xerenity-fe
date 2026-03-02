'use client';

/* eslint-disable no-nested-ternary */
import { CoreLayout } from '@layout';
import { Row, Col, Form, Modal } from 'react-bootstrap';
import React, { useState, useCallback, useEffect } from 'react';
import Container from 'react-bootstrap/Container';
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import {
  faLandmark,
  faSyncAlt,
  faPlus,
  faTrash,
  faTable,
  faLineChart,
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
import { getTesCatalog, getTesYieldCurve } from 'src/models/pricing/pricingApi';
import type { TesCatalogItem, TesYieldCurvePoint } from 'src/types/pricing';
import type { PricedTesBond, NewTesPosition } from 'src/types/trading';
import useAppStore from 'src/store';

// ── Formatting helpers ──

const fmt = (v: number | null | undefined, decimals = 2) =>
  v != null
    ? v.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })
    : '—';

const fmtPct = (v: number | null | undefined, decimals = 2) =>
  v != null ? `${(v * 100).toFixed(decimals)}%` : '—';

const fmtMM = (v: number | null | undefined) => {
  if (v == null) return '—';
  const abs = Math.abs(v);
  if (abs >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return fmt(v, 2);
};

const pnlColor = (v: number | null | undefined) => {
  if (v == null) return '#495057';
  return v >= 0 ? '#28a745' : '#dc3545';
};

// ── Summary Bar ──

function TesSummaryBar({ bonds }: { bonds: PricedTesBond[] }) {
  const priced = bonds.filter((b) => !b.error);
  if (priced.length === 0) return null;

  const totalNocional = bonds.reduce((s, b) => s + b.notional, 0);
  const totalNpv = priced.reduce((s, b) => s + b.npv, 0);
  const totalPnl = priced.reduce((s, b) => s + b.pnl_mtm, 0);
  const totalDv01 = priced.reduce((s, b) => s + b.dv01 * (b.notional / b.face_value), 0);

  // Weighted average modified duration
  const waDuration = priced.length > 0
    ? priced.reduce((s, b) => s + b.modified_duration * b.notional, 0) / totalNocional
    : 0;

  const items: [string, string, string][] = [
    ['Nocional COP', fmtMM(totalNocional), '#495057'],
    ['NPV COP', fmtMM(totalNpv), pnlColor(totalNpv)],
    ['P&L MTM', fmtMM(totalPnl), pnlColor(totalPnl)],
    ['DV01 Total', fmt(totalDv01, 0), '#004085'],
    ['Dur. Ponderada', `${waDuration.toFixed(2)} años`, '#495057'],
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
        <div key={label} style={{ minWidth: 130 }}>
          <div style={{ fontSize: 10, color: '#6c757d', textTransform: 'uppercase' }}>{label}</div>
          <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'monospace', color }}>
            {value}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Detail Modal ──

function TesDetailModal({
  bond,
  show,
  onHide,
}: {
  bond: PricedTesBond | null;
  show: boolean;
  onHide: () => void;
}) {
  if (!bond) return null;

  const analyticsItems: [string, string][] = [
    ['Precio Limpio', fmt(bond.clean_price, 6)],
    ['Precio Sucio', fmt(bond.dirty_price, 6)],
    ['Interés Corrido', fmt(bond.accrued_interest, 6)],
    ['YTM Mercado', fmtPct(bond.ytm, 4)],
    ...(bond.purchase_ytm != null
      ? [['YTM Entrada', fmtPct(bond.purchase_ytm, 4)] as [string, string]]
      : []),
    ['Duration Macaulay', `${fmt(bond.macaulay_duration, 4)} años`],
    ['Duration Modificada', fmt(bond.modified_duration, 4)],
    ['Convexidad', fmt(bond.convexity, 4)],
    ['DV01 (por 100 nominal)', fmt(bond.dv01, 6)],
    ['BPV', fmt(bond.bpv, 6)],
    ...(bond.z_spread_bps != null
      ? [['Z-Spread', `${fmt(bond.z_spread_bps, 1)} bps`] as [string, string]]
      : []),
  ];

  return (
    <Modal show={show} onHide={onHide} size="xl">
      <Modal.Header closeButton>
        <Modal.Title style={{ fontSize: 16 }}>
          {bond.bond_name}
          {bond.label ? ` — ${bond.label}` : ''}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {bond.error && (
          <div style={{ padding: 8, background: '#f8d7da', color: '#721c24', borderRadius: 6, marginBottom: 12, fontSize: 12 }}>
            Error al pricear: {bond.error}
          </div>
        )}

        <Row>
          {/* Analytics */}
          <Col md={6}>
            <div style={{ padding: 12, border: '1px solid #dee2e6', borderRadius: 8, marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0d6efd', marginBottom: 8 }}>Analítica</div>
              <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                <tbody>
                  {analyticsItems.map(([label, value]) => (
                    <tr key={label} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '5px 8px', color: '#555', fontWeight: 600 }}>{label}</td>
                      <td style={{ padding: '5px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* P&L */}
            <div style={{ padding: 12, border: '2px solid #28a745', borderRadius: 8, background: '#f0fff4' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#28a745', marginBottom: 8 }}>P&L</div>
              <div style={{ display: 'flex', gap: 24 }}>
                <div>
                  <div style={{ fontSize: 10, color: '#6c757d' }}>P&L MTM (COP)</div>
                  <div style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 700, color: pnlColor(bond.pnl_mtm) }}>
                    {fmtMM(bond.pnl_mtm)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: '#6c757d' }}>NPV COP</div>
                  <div style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 600, color: pnlColor(bond.npv) }}>
                    {fmtMM(bond.npv)}
                  </div>
                </div>
              </div>
            </div>
          </Col>

          {/* Carry + Operacional */}
          <Col md={6}>
            {bond.carry && (
              <div style={{ padding: 12, border: '2px solid #17a2b8', borderRadius: 8, background: '#e8f8fb', marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#17a2b8', marginBottom: 8 }}>
                  Carry / Roll-down (30 días)
                </div>
                <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                  <tbody>
                    {[
                      ['Carry Cupón', fmt(bond.carry.coupon_carry, 4)],
                      ['Roll-down', fmt(bond.carry.rolldown, 4)],
                      ['Carry Total', fmt(bond.carry.total_carry, 4)],
                      ['Carry Anualizado', `${fmt(bond.carry.total_carry_bps_annualized, 1)} bps`],
                    ].map(([label, value]) => (
                      <tr key={label} style={{ borderBottom: '1px solid #b2ebf2' }}>
                        <td style={{ padding: '4px 8px', color: '#555', fontWeight: 600 }}>{label}</td>
                        <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Operacional */}
            <div style={{ padding: 12, border: '1px solid #dee2e6', borderRadius: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#6c757d', marginBottom: 8 }}>Datos Operacionales</div>
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                <tbody>
                  {[
                    ['Bono', bond.bond_name],
                    ['Emisión', bond.issue_date],
                    ['Vencimiento', bond.maturity_date],
                    ['Cupón', fmtPct(bond.coupon_rate, 2)],
                    ['Nocional COP', fmtMM(bond.notional)],
                    ['Precio Compra', bond.purchase_price != null ? fmt(bond.purchase_price, 6) : '—'],
                    ['Fecha Compra', bond.trade_date || '—'],
                    ['Sociedad', bond.sociedad || '—'],
                    ['Custodio', bond.counterparty || '—'],
                    ['Estado', bond.estado || '—'],
                  ].map(([label, value]) => (
                    <tr key={label} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '4px 8px', color: '#555', fontWeight: 600 }}>{label}</td>
                      <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Col>
        </Row>

        {/* Cashflows */}
        {bond.cashflows && bond.cashflows.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <h6 style={{ marginBottom: 8, fontSize: 13 }}>
              Flujos de Caja
              <span style={{ fontSize: 11, color: '#888', fontWeight: 400, marginLeft: 8 }}>
                ({bond.cashflows.length} cupones anuales)
              </span>
            </h6>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #dee2e6', background: '#f8f9fa' }}>
                    {['#', 'Fecha', 'Días', 'Cupón', 'Principal', 'Total', 'DF', 'PV'].map((h) => (
                      <th
                        key={h}
                        style={{ padding: '6px 8px', textAlign: h === '#' ? 'center' : 'right', fontWeight: 600 }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bond.cashflows.map((cf) => (
                    <tr
                      key={cf.date}
                      style={{
                        borderBottom: '1px solid #eee',
                        background: cf.principal > 0 ? '#fff8e1' : 'transparent',
                      }}
                    >
                      <td style={{ padding: '4px 8px', textAlign: 'center', color: '#888' }}>{cf.period}</td>
                      <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{cf.date_str || cf.date}</td>
                      <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace', color: '#888' }}>{cf.accrual_days || '—'}</td>
                      <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{fmt(cf.coupon, 4)}</td>
                      <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{cf.principal > 0 ? fmt(cf.principal, 2) : '—'}</td>
                      <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: cf.principal > 0 ? 600 : 400 }}>{fmt(cf.cashflow, 4)}</td>
                      <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace', color: '#666' }}>{cf.discount_factor.toFixed(6)}</td>
                      <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{fmt(cf.pv, 4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal.Body>
    </Modal>
  );
}

// ── Add TES Modal ──

function AddTesModal({
  show,
  onHide,
  onAdd,
  catalog,
  catalogLoading,
}: {
  show: boolean;
  onHide: () => void;
  onAdd: (values: NewTesPosition) => Promise<void>;
  catalog: TesCatalogItem[];
  catalogLoading: boolean;
}) {
  const [selectedBond, setSelectedBond] = useState<TesCatalogItem | null>(null);
  const [nocional, setNocional] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [purchaseYtm, setPurchaseYtm] = useState('');
  const [tradeDate, setTradeDate] = useState('');
  const [sociedad, setSociedad] = useState('');
  const [custodio, setCustodio] = useState('');
  const [estado, setEstado] = useState('Activo');
  const [submitting, setSubmitting] = useState(false);

  const handleBondSelect = (name: string) => {
    const bond = catalog.find((b) => b.name === name) || null;
    setSelectedBond(bond);
  };

  const handleSubmit = async () => {
    if (!selectedBond) { toast.warning('Selecciona un bono'); return; }
    const notional = parseFloat(nocional.replace(/,/g, ''));
    if (!notional || notional <= 0) { toast.warning('Nocional inválido'); return; }

    setSubmitting(true);
    try {
      const values: NewTesPosition = {
        bond_name: selectedBond.name,
        issue_date: selectedBond.issue_date,
        maturity_date: selectedBond.maturity_date,
        coupon_rate: selectedBond.coupon_rate / 100, // pct → decimal
        face_value: 100,
        notional,
        purchase_price: purchasePrice ? parseFloat(purchasePrice) : undefined,
        purchase_ytm: purchaseYtm ? parseFloat(purchaseYtm) / 100 : undefined,
        trade_date: tradeDate || undefined,
        sociedad: sociedad || undefined,
        counterparty: custodio || undefined,
        estado,
      };
      await onAdd(values);
      // Reset
      setSelectedBond(null);
      setNocional('');
      setPurchasePrice('');
      setPurchaseYtm('');
      setTradeDate('');
      setSociedad('');
      setCustodio('');
      setEstado('Activo');
      onHide();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} size="lg">
      <Modal.Header closeButton>
        <Modal.Title style={{ fontSize: 15 }}>Agregar Posición TES</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Row className="g-3">
          <Col md={12}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12, fontWeight: 600 }}>Bono *</Form.Label>
              {catalogLoading ? (
                <div style={{ fontSize: 12, color: '#888' }}>Cargando catálogo...</div>
              ) : (
                <Form.Select
                  size="sm"
                  value={selectedBond?.name || ''}
                  onChange={(e) => handleBondSelect(e.target.value)}
                >
                  <option value="">— Seleccionar bono —</option>
                  {catalog.map((b) => (
                    <option key={b.name} value={b.name}>
                      {b.name} | Vence: {b.maturity_date} | Cupón: {(b.coupon_rate).toFixed(2)}%
                    </option>
                  ))}
                </Form.Select>
              )}
            </Form.Group>
          </Col>

          {selectedBond && (
            <Col md={12}>
              <div style={{ padding: '6px 12px', background: '#e8f4fd', borderRadius: 6, fontSize: 12 }}>
                <strong>{selectedBond.name}</strong> — Emisión: {selectedBond.issue_date} | Venc: {selectedBond.maturity_date} | Cupón: {(selectedBond.coupon_rate).toFixed(2)}%
              </div>
            </Col>
          )}

          <Col md={6}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12, fontWeight: 600 }}>Nocional COP *</Form.Label>
              <Form.Control
                size="sm"
                type="text"
                placeholder="e.g. 5,000,000,000"
                value={nocional}
                onChange={(e) => setNocional(e.target.value)}
              />
              <Form.Text style={{ fontSize: 10 }}>Total COP (unidades × 100)</Form.Text>
            </Form.Group>
          </Col>

          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12, fontWeight: 600 }}>Precio Entrada</Form.Label>
              <Form.Control
                size="sm"
                type="number"
                step="0.0001"
                placeholder="e.g. 98.5432"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
              />
              <Form.Text style={{ fontSize: 10 }}>Precio limpio de compra</Form.Text>
            </Form.Group>
          </Col>

          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12, fontWeight: 600 }}>YTM Entrada (%)</Form.Label>
              <Form.Control
                size="sm"
                type="number"
                step="0.01"
                placeholder="e.g. 9.75"
                value={purchaseYtm}
                onChange={(e) => setPurchaseYtm(e.target.value)}
              />
              <Form.Text style={{ fontSize: 10 }}>YTM de compra en %</Form.Text>
            </Form.Group>
          </Col>

          <Col md={4}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12, fontWeight: 600 }}>Fecha Compra</Form.Label>
              <Form.Control
                size="sm"
                type="date"
                value={tradeDate}
                onChange={(e) => setTradeDate(e.target.value)}
              />
            </Form.Group>
          </Col>

          <Col md={4}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12, fontWeight: 600 }}>Sociedad</Form.Label>
              <Form.Control
                size="sm"
                type="text"
                placeholder="e.g. BP01"
                value={sociedad}
                onChange={(e) => setSociedad(e.target.value)}
              />
            </Form.Group>
          </Col>

          <Col md={4}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12, fontWeight: 600 }}>Custodio / Broker</Form.Label>
              <Form.Control
                size="sm"
                type="text"
                placeholder="e.g. Deceval"
                value={custodio}
                onChange={(e) => setCustodio(e.target.value)}
              />
            </Form.Group>
          </Col>

          <Col md={4}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12, fontWeight: 600 }}>Estado</Form.Label>
              <Form.Select
                size="sm"
                value={estado}
                onChange={(e) => setEstado(e.target.value)}
              >
                <option>Activo</option>
                <option>Vencido</option>
                <option>Cancelado</option>
              </Form.Select>
            </Form.Group>
          </Col>
        </Row>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onHide} disabled={submitting}>
          Cancelar
        </Button>
        <Button variant="success" onClick={handleSubmit} disabled={submitting || !selectedBond}>
          <Icon icon={faPlus} className="me-1" />
          {submitting ? 'Agregando...' : 'Agregar TES'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

// ── Positions Table ──

function TesTable({
  bonds,
  onDelete,
  onSelect,
}: {
  bonds: PricedTesBond[];
  onDelete: (id: string) => void;
  onSelect: (b: PricedTesBond) => void;
}) {
  if (bonds.length === 0) {
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
        No hay posiciones TES. Agrega una con el botón &quot;+ TES&quot;.
      </div>
    );
  }

  const COLS = [
    'Bono', 'Nocional COP', 'F. Compra', 'Precio Entrada', 'Precio Mercado',
    'YTM Entrada', 'YTM Mercado', 'P&L MTM', 'Dur. Mod', 'DV01', 'Estado', '',
  ];

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #dee2e6', background: '#f8f9fa' }}>
            {COLS.map((h) => (
              <th
                key={h}
                title={h}
                style={{
                  padding: '8px 10px',
                  textAlign: h === 'Bono' || h === '' ? 'left' : 'right',
                  fontWeight: 600,
                  fontSize: 12,
                  whiteSpace: 'nowrap',
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bonds.map((b) => (
            <tr
              key={b.id}
              onClick={() => onSelect(b)}
              style={{
                borderBottom: '1px solid #eee',
                cursor: 'pointer',
                background: b.error ? '#fff5f5' : 'transparent',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#f0f7ff'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = b.error ? '#fff5f5' : 'transparent'; }}
            >
              {/* Bono */}
              <td style={{ padding: '8px 10px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                <span
                  style={{
                    display: 'inline-block',
                    padding: '2px 8px',
                    borderRadius: 4,
                    background: '#e8f4fd',
                    color: '#004085',
                    fontSize: 12,
                    marginRight: 4,
                  }}
                >
                  TES
                </span>
                {b.bond_name}
                <div style={{ fontSize: 10, color: '#888', fontWeight: 400 }}>
                  Vence: {b.maturity_date} | Cupón: {(b.coupon_rate * 100).toFixed(2)}%
                </div>
              </td>

              {/* Nocional */}
              <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace' }}>
                {fmtMM(b.notional)}
              </td>

              {/* Fecha compra */}
              <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace', color: '#888' }}>
                {b.trade_date || '—'}
              </td>

              {/* Precio entrada */}
              <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace' }}>
                {b.purchase_price != null ? fmt(b.purchase_price, 4) : '—'}
              </td>

              {/* Precio mercado L / S */}
              <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace' }}>
                {b.error ? (
                  <span style={{ color: '#dc3545', fontSize: 11 }}>Error</span>
                ) : (
                  <>
                    <span style={{ color: '#0d6efd' }}>{fmt(b.clean_price, 4)}</span>
                    <span style={{ color: '#888', fontSize: 11 }}> / {fmt(b.dirty_price, 4)}</span>
                  </>
                )}
              </td>

              {/* YTM entrada */}
              <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace' }}>
                {b.purchase_ytm != null ? fmtPct(b.purchase_ytm, 2) : '—'}
              </td>

              {/* YTM mercado */}
              <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace' }}>
                {b.error ? '—' : fmtPct(b.ytm, 2)}
              </td>

              {/* P&L MTM */}
              <td
                style={{
                  padding: '8px 10px',
                  textAlign: 'right',
                  fontFamily: 'monospace',
                  fontWeight: 700,
                  color: b.purchase_price == null ? '#6c757d' : pnlColor(b.pnl_mtm),
                }}
              >
                {b.purchase_price == null ? '—' : fmtMM(b.pnl_mtm)}
              </td>

              {/* Duration Mod */}
              <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace' }}>
                {b.error ? '—' : fmt(b.modified_duration, 2)}
              </td>

              {/* DV01 */}
              <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace' }}>
                {b.error ? '—' : fmt(b.dv01 * (b.notional / b.face_value), 0)}
              </td>

              {/* Estado */}
              <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 600,
                    background: b.estado === 'Activo' ? '#d4edda' : b.estado === 'Vencido' ? '#fff3cd' : '#f8d7da',
                    color: b.estado === 'Activo' ? '#155724' : b.estado === 'Vencido' ? '#856404' : '#721c24',
                  }}
                >
                  {b.estado || 'Activo'}
                </span>
              </td>

              {/* Acciones */}
              <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onDelete(b.id); }}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#dc3545',
                    padding: '2px 4px',
                  }}
                  title="Eliminar posición"
                >
                  <Icon icon={faTrash} size="sm" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Yield Curve Panel ──

const MOCK_YIELD_CURVE: TesYieldCurvePoint[] = [
  { tenor: '6M', tenor_years: 0.5, ytm: 10.50 },
  { tenor: '1Y', tenor_years: 1, ytm: 10.75 },
  { tenor: '2Y', tenor_years: 2, ytm: 11.00 },
  { tenor: '3Y', tenor_years: 3, ytm: 11.20 },
  { tenor: '5Y', tenor_years: 5, ytm: 11.50 },
  { tenor: '7Y', tenor_years: 7, ytm: 11.65 },
  { tenor: '10Y', tenor_years: 10, ytm: 11.80 },
  { tenor: '15Y', tenor_years: 15, ytm: 11.90 },
];

function YieldCurvePanel() {
  const [curve, setCurve] = useState<TesYieldCurvePoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLoad = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getTesYieldCurve();
      setCurve(data);
    } catch {
      setCurve(MOCK_YIELD_CURVE);
      setError('Usando datos de ejemplo (endpoint en desarrollo)');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { handleLoad(); }, [handleLoad]);

  const chartData = curve.map((p) => ({
    ...p,
    ytm_pct: p.ytm > 1 ? p.ytm : p.ytm * 100,
  }));

  return (
    <div style={{ background: '#fff', borderRadius: 8, padding: 16, border: '1px solid #dee2e6' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h6 style={{ margin: 0 }}>Curva de Rendimientos TES</h6>
        <Button variant="outline-secondary" size="sm" onClick={handleLoad} disabled={loading}>
          <Icon icon={faSyncAlt} className="me-1" />
          Actualizar
        </Button>
      </div>
      {error && (
        <div style={{ fontSize: 11, color: '#856404', background: '#fff3cd', padding: '4px 8px', borderRadius: 4, marginBottom: 8 }}>
          {error}
        </div>
      )}
      {chartData.length > 0 && (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              type="number"
              dataKey="tenor_years"
              ticks={chartData.map((d) => d.tenor_years)}
              tickFormatter={(y: number) => chartData.find((d) => d.tenor_years === y)?.tenor || `${y}Y`}
              tick={{ fontSize: 11 }}
            />
            <YAxis
              domain={['auto', 'auto']}
              tickFormatter={(v: number) => `${v.toFixed(1)}%`}
              tick={{ fontSize: 11 }}
            />
            <Tooltip
              labelFormatter={(y: number) => chartData.find((d) => d.tenor_years === y)?.tenor || `${y}Y`}
              formatter={(v: number) => [`${v.toFixed(2)}%`, 'YTM']}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="ytm_pct"
              name="YTM (%)"
              stroke="#0d6efd"
              strokeWidth={2}
              dot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
      {curve.length > 0 && (
        <div style={{ marginTop: 12, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #dee2e6' }}>
                <th style={{ padding: '4px 8px', textAlign: 'left' }}>Tenor</th>
                <th style={{ padding: '4px 8px', textAlign: 'right' }}>Años</th>
                <th style={{ padding: '4px 8px', textAlign: 'right' }}>YTM (%)</th>
                {curve[0].maturity_date && (
                  <th style={{ padding: '4px 8px', textAlign: 'right' }}>Vencimiento</th>
                )}
                {curve[0].name && (
                  <th style={{ padding: '4px 8px', textAlign: 'right' }}>Bono</th>
                )}
              </tr>
            </thead>
            <tbody>
              {curve.map((p) => (
                <tr key={p.tenor} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '4px 8px', fontWeight: 600 }}>{p.tenor}</td>
                  <td style={{ padding: '4px 8px', textAlign: 'right' }}>{p.tenor_years.toFixed(1)}</td>
                  <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace' }}>
                    {(p.ytm > 1 ? p.ytm : p.ytm * 100).toFixed(2)}%
                  </td>
                  {p.maturity_date && (
                    <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace', color: '#888' }}>
                      {p.maturity_date}
                    </td>
                  )}
                  {p.name && (
                    <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace', color: '#0d6efd' }}>
                      {p.name}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Main Page ──

function TesPortfolioPage() {
  const [viewTab, setViewTab] = useState<'posiciones' | 'curva'>('posiciones');
  const [showAdd, setShowAdd] = useState(false);
  const [selectedBond, setSelectedBond] = useState<PricedTesBond | null>(null);
  const [catalog, setCatalog] = useState<TesCatalogItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);

  const {
    tesPositions,
    pricedTesBonds,
    tesLoading,
    loadTesPositions,
    repriceTes,
    addTesPosition,
    removeTesPositions,
    canEdit,
    loadUserRole,
    userRole,
  } = useAppStore();

  // Mount: load positions + role + catalog
  useEffect(() => {
    loadTesPositions();
    loadUserRole();
    setCatalogLoading(true);
    getTesCatalog()
      .then(setCatalog)
      .catch(() => {})
      .finally(() => setCatalogLoading(false));
  }, [loadTesPositions, loadUserRole]);

  // Reprice when positions load
  useEffect(() => {
    if (tesPositions.length > 0) {
      repriceTes();
    }
  }, [tesPositions.length, repriceTes]);

  // Build display rows: use priced if available, else show unpriced
  const displayBonds: PricedTesBond[] = pricedTesBonds.length > 0
    ? pricedTesBonds
    : tesPositions.map((p) => ({
        ...p,
        clean_price: 0, dirty_price: 0, accrued_interest: 0,
        ytm: 0, macaulay_duration: 0, modified_duration: 0,
        convexity: 0, dv01: 0, bpv: 0, npv: 0, pnl_mtm: 0,
        error: 'Sin pricear',
      }));

  const handleDelete = useCallback(async (id: string) => {
    await removeTesPositions([id]);
    toast.info('Posición eliminada');
  }, [removeTesPositions]);

  const handleReprice = useCallback(async () => {
    await repriceTes();
    toast.success('Repriceado');
  }, [repriceTes]);

  return (
    <CoreLayout>
      <Container fluid className="px-4">
        {/* Header */}
        <Row>
          <div className="d-flex align-items-center justify-content-between py-1">
            <PageTitle>
              <Icon icon={faLandmark} size="1x" />
              <h4>Portafolio TES</h4>
              {userRole.company_name && (
                <span style={{ fontSize: 13, fontWeight: 400, marginLeft: 8 }}>
                  {userRole.company_name}
                  <span
                    style={{
                      marginLeft: 6, padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600,
                      background: userRole.role === 'admin' ? '#198754' : '#0d6efd',
                      color: '#fff',
                    }}
                  >
                    {userRole.role}
                  </span>
                </span>
              )}
            </PageTitle>
            <div className="d-flex align-items-center gap-2">
              <Button
                variant="outline-primary"
                onClick={handleReprice}
                disabled={tesLoading || tesPositions.length === 0}
              >
                <Icon icon={faSyncAlt} className="me-1" />
                Repricear
              </Button>
              {canEdit && (
                <Button variant="outline-success" onClick={() => setShowAdd(true)}>
                  <Icon icon={faPlus} className="me-1" />
                  TES
                </Button>
              )}
            </div>
          </div>
        </Row>

        {/* Summary */}
        <TesSummaryBar bonds={displayBonds.filter((b) => !b.error)} />

        {/* View Toggle */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
          {([['posiciones', 'Posiciones', faTable], ['curva', 'Curva TES', faLineChart]] as const).map(([key, label, icon]) => (
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

        {/* Loading indicator */}
        {tesLoading && (
          <div style={{ padding: '8px 12px', background: '#e8f4fd', borderRadius: 6, fontSize: 12, marginBottom: 12 }}>
            Cargando/repriceando posiciones TES...
          </div>
        )}

        {/* Content */}
        {viewTab === 'posiciones' && (
          <div style={{ background: '#fff', border: '1px solid #dee2e6', borderRadius: 8, padding: 20 }}>
            <TesTable
              bonds={displayBonds}
              onDelete={handleDelete}
              onSelect={setSelectedBond}
            />
          </div>
        )}

        {viewTab === 'curva' && <YieldCurvePanel />}

        {/* Modals */}
        <AddTesModal
          show={showAdd}
          onHide={() => setShowAdd(false)}
          onAdd={addTesPosition}
          catalog={catalog}
          catalogLoading={catalogLoading}
        />

        <TesDetailModal
          bond={selectedBond}
          show={selectedBond !== null}
          onHide={() => setSelectedBond(null)}
        />
      </Container>
    </CoreLayout>
  );
}

export default TesPortfolioPage;
