'use client';

import { CoreLayout } from '@layout';
import { Row, Col, Form } from 'react-bootstrap';
import React, { useState, useCallback } from 'react';
import Container from 'react-bootstrap/Container';
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import {
  faCalculator,
  faLineChart,
  faPlay,
  faSyncAlt,
  faSave,
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'react-toastify';
import PageTitle from '@components/PageTitle';
import Button from '@components/UI/Button';
import { Tab, Tabs, TabItemType } from '@components/UI/Tabs';
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
  priceIbrSwap,
  getIbrParCurve,
  getCurveStatus,
  type IbrSwapRequest,
} from 'src/models/pricing/pricingApi';
import type {
  IbrSwapPricingResult,
  IbrSwapCashflow,
  ParCurvePoint,
  CurveStatus,
} from 'src/types/pricing';
import { createIbrSwapPosition } from 'src/models/trading';

const PAGE_TITLE = 'IBR Swap Pricer';

const TAB_ITEMS: TabItemType[] = [
  { name: 'Pricing', property: 'pricing', icon: faCalculator, active: true },
  { name: 'Par Curve', property: 'parcurve', icon: faLineChart, active: false },
];

const fmt = (v: number, decimals = 2) =>
  v != null ? v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : '—';

const fmtPct = (v: number) => (v != null ? `${(v * 100).toFixed(4)}%` : '—');

const fmtMM = (v: number) => {
  if (Math.abs(v) >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (Math.abs(v) >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return fmt(v, 2);
};

const fmtInput = (v: number) =>
  v ? v.toLocaleString('en-US', { maximumFractionDigits: 0 }) : '';

const parseInput = (s: string): number => {
  const cleaned = s.replace(/,/g, '');
  return parseFloat(cleaned) || 0;
};

const npvColor = (v: number) => (v >= 0 ? '#28a745' : '#dc3545');

// Generate projected cashflows from swap parameters (mock when backend doesn't return them)
function generateCashflows(
  notional: number,
  fixedRate: number,    // decimal
  floatingRate: number, // decimal (fair_rate as proxy)
  startDateStr: string,
  maturityDateStr: string,
  paymentFrequency: string,
  payFixed: boolean,
): IbrSwapCashflow[] {
  const freqMonths: Record<string, number> = { '1M': 1, '3M': 3, '6M': 6, '12M': 12 };

  const addMonths = (d: Date, months: number): Date => {
    const r = new Date(d);
    r.setMonth(r.getMonth() + months);
    return r;
  };

  const maturity = new Date(maturityDateStr + 'T00:00:00');
  const result: IbrSwapCashflow[] = [];

  if (paymentFrequency === 'Bullet') {
    const start = new Date(startDateStr + 'T00:00:00');
    const days = Math.round((maturity.getTime() - start.getTime()) / 86400000);
    const fixedAmt = notional * fixedRate * days / 365;
    const floatAmt = notional * floatingRate * days / 365;
    const net = payFixed ? floatAmt - fixedAmt : fixedAmt - floatAmt;
    result.push({
      period: 1, start: startDateStr, end: maturityDateStr,
      payment_date: maturityDateStr, days, fixed_rate: fixedRate,
      floating_rate: floatingRate, fixed_amount: fixedAmt,
      floating_amount: floatAmt, net_amount: net, df: 1.0, pv: net,
    });
    return result;
  }

  const months = freqMonths[paymentFrequency] || 3;
  let periodStart = new Date(startDateStr + 'T00:00:00');
  let period = 1;

  while (periodStart < maturity && period <= 120) {
    const rawEnd = addMonths(periodStart, months);
    const periodEnd = rawEnd > maturity ? maturity : rawEnd;
    const days = Math.round((periodEnd.getTime() - periodStart.getTime()) / 86400000);
    const fixedAmt = notional * fixedRate * days / 365;
    const floatAmt = notional * floatingRate * days / 365;
    const net = payFixed ? floatAmt - fixedAmt : fixedAmt - floatAmt;
    result.push({
      period,
      start: periodStart.toISOString().slice(0, 10),
      end: periodEnd.toISOString().slice(0, 10),
      payment_date: periodEnd.toISOString().slice(0, 10),
      days, fixed_rate: fixedRate, floating_rate: floatingRate,
      fixed_amount: fixedAmt, floating_amount: floatAmt,
      net_amount: net, df: 1.0, pv: net,
    });
    periodStart = new Date(periodEnd);
    period++;
  }
  return result;
}

function IbrSwapPricer() {
  const [activeTab, setActiveTab] = useState('pricing');
  const [pageTabs, setPageTabs] = useState<TabItemType[]>(TAB_ITEMS);
  const [loading, setLoading] = useState(false);
  const [curvesReady, setCurvesReady] = useState(false);
  const [curveStatus, setCurveStatus] = useState<CurveStatus | null>(null);

  // Swap form state
  const [notional, setNotional] = useState(10_000_000_000);
  const [fixedRate, setFixedRate] = useState(9.5);
  const [tenorYears, setTenorYears] = useState(5);
  const [payFixed, setPayFixed] = useState(true);
  const [spread, setSpread] = useState(0);
  const [useMaturity, setUseMaturity] = useState(false);
  const [maturityDate, setMaturityDate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [paymentFrequency, setPaymentFrequency] = useState('3M');

  // Operational fields (for saving to portfolio)
  const [showOperational, setShowOperational] = useState(false);
  const [idOperacion, setIdOperacion] = useState('');
  const [tradeDate, setTradeDate] = useState('');
  const [sociedad, setSociedad] = useState('');
  const [idBanco, setIdBanco] = useState('');
  const [modalidad, setModalidad] = useState('');
  const [settlementDate, setSettlementDate] = useState('');
  const [tipoDivisa, setTipoDivisa] = useState('COP');
  const [estado, setEstado] = useState('Activo');
  const [docSap, setDocSap] = useState('');

  // Results
  const [result, setResult] = useState<IbrSwapPricingResult | null>(null);
  const [parCurve, setParCurve] = useState<ParCurvePoint[]>([]);

  const handleTabChange = (tabProp: string) => {
    setActiveTab(tabProp);
    setPageTabs((prev) =>
      prev.map((tab) => ({ ...tab, active: tab.property === tabProp }))
    );
  };

  const handleBuildCurves = useCallback(async () => {
    setLoading(true);
    try {
      const res = await buildCurves();
      setCurvesReady(true);
      setCurveStatus(res.full_status);
      toast.success('Curvas construidas correctamente');
    } catch (e) {
      toast.error(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleCheckStatus = useCallback(async () => {
    try {
      const status = await getCurveStatus();
      setCurveStatus(status);
      setCurvesReady(status.ibr.built);
    } catch (e) {
      toast.error(`Error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, []);

  const handlePriceSwap = useCallback(async () => {
    if (useMaturity && !maturityDate) {
      toast.warn('Ingrese fecha de vencimiento');
      return;
    }
    setLoading(true);
    try {
      const params: IbrSwapRequest = {
        notional,
        fixed_rate: fixedRate / 100,
        pay_fixed: payFixed,
        spread: spread / 10000,
        payment_frequency: paymentFrequency,
      };
      if (startDate) params.start_date = startDate;
      if (useMaturity) {
        params.maturity_date = maturityDate;
      } else {
        params.tenor_years = tenorYears;
      }
      const res = await priceIbrSwap(params);
      setResult(res);
    } catch (e) {
      toast.error(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  }, [notional, fixedRate, tenorYears, payFixed, spread, useMaturity, maturityDate, startDate, paymentFrequency]);

  const handleFetchParCurve = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getIbrParCurve();
      setParCurve(data);
    } catch (e) {
      toast.error(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const renderCurveStatus = () => {
    if (!curveStatus) return null;
    return (
      <div
        style={{
          background: '#f8f9fa',
          borderRadius: 8,
          padding: '12px 16px',
          fontSize: 13,
          marginBottom: 16,
        }}
      >
        <strong>Estado de Curvas</strong> — Val Date: {curveStatus.valuation_date}
        {' | IBR: '}
        <span style={{ color: curveStatus.ibr.built ? '#28a745' : '#dc3545' }}>
          {curveStatus.ibr.built ? 'OK' : 'No'}
        </span>
        {' | SOFR: '}
        <span style={{ color: curveStatus.sofr.built ? '#28a745' : '#dc3545' }}>
          {curveStatus.sofr.built ? 'OK' : 'No'}
        </span>
      </div>
    );
  };

  const renderPricingTab = () => (
    <>
      {/* Build curves bar */}
      <Row className="mb-3">
        <Col>
          <div className="d-flex align-items-center gap-2">
            <Button
              variant="outline-success"
              onClick={handleBuildCurves}
              disabled={loading}
            >
              <Icon icon={faSyncAlt} className="me-1" />
              {curvesReady ? 'Rebuild Curvas' : 'Construir Curvas'}
            </Button>
            <Button variant="outline-secondary" onClick={handleCheckStatus} disabled={loading}>
              Status
            </Button>
          </div>
        </Col>
      </Row>

      {renderCurveStatus()}

      {/* Swap Input Form */}
      <Row>
        <Col md={5}>
          <div
            style={{
              background: '#fff',
              border: '1px solid #dee2e6',
              borderRadius: 8,
              padding: 20,
            }}
          >
            <h6 style={{ marginBottom: 16 }}>Parámetros IBR OIS Swap</h6>
            <Form>
              <Form.Group className="mb-3">
                <Form.Label style={{ fontSize: 13 }}>Notional COP</Form.Label>
                <Form.Control
                  type="text"
                  value={fmtInput(notional)}
                  onChange={(e) => setNotional(parseInput(e.target.value))}
                  style={{ fontFamily: 'monospace' }}
                />
                <Form.Text className="text-muted">
                  {fmtMM(notional)} COP
                </Form.Text>
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label style={{ fontSize: 13 }}>Tasa Fija (%)</Form.Label>
                <Form.Control
                  type="number"
                  step="0.01"
                  value={fixedRate}
                  onChange={(e) => setFixedRate(parseFloat(e.target.value) || 0)}
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Check
                  type="switch"
                  label="Usar fecha de vencimiento (en vez de tenor)"
                  checked={useMaturity}
                  onChange={() => setUseMaturity(!useMaturity)}
                />
              </Form.Group>

              {useMaturity ? (
                <Form.Group className="mb-3">
                  <Form.Label style={{ fontSize: 13 }}>Fecha Vencimiento</Form.Label>
                  <Form.Control
                    type="date"
                    value={maturityDate}
                    onChange={(e) => setMaturityDate(e.target.value)}
                  />
                </Form.Group>
              ) : (
                <Form.Group className="mb-3">
                  <Form.Label style={{ fontSize: 13 }}>Tenor (años)</Form.Label>
                  <Form.Select
                    value={tenorYears}
                    onChange={(e) => setTenorYears(parseInt(e.target.value, 10))}
                  >
                    {[1, 2, 3, 5, 7, 10, 15, 20].map((y) => (
                      <option key={y} value={y}>
                        {y}Y
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              )}

              <Row>
                <Col>
                  <Form.Group className="mb-3">
                    <Form.Label style={{ fontSize: 13 }}>Fecha Inicio</Form.Label>
                    <Form.Control
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                    <Form.Text className="text-muted" style={{ fontSize: 11 }}>
                      Dejar vacio = T+2 desde hoy
                    </Form.Text>
                  </Form.Group>
                </Col>
                <Col>
                  <Form.Group className="mb-3">
                    <Form.Label style={{ fontSize: 13 }}>Frecuencia Pagos</Form.Label>
                    <Form.Select
                      value={paymentFrequency}
                      onChange={(e) => setPaymentFrequency(e.target.value)}
                    >
                      <option value="1M">Mensual (1M)</option>
                      <option value="3M">Trimestral (3M)</option>
                      <option value="6M">Semestral (6M)</option>
                      <option value="12M">Anual (12M)</option>
                      <option value="Bullet">Bullet (al vencimiento)</option>
                    </Form.Select>
                    <Form.Text className="text-muted" style={{ fontSize: 11 }}>
                      Estandar Colombia: 3M
                    </Form.Text>
                  </Form.Group>
                </Col>
              </Row>

              <Form.Group className="mb-3">
                <Form.Label style={{ fontSize: 13 }}>Dirección</Form.Label>
                <Form.Select
                  value={payFixed ? 'pay' : 'receive'}
                  onChange={(e) => setPayFixed(e.target.value === 'pay')}
                >
                  <option value="pay">Pay Fixed / Receive Float</option>
                  <option value="receive">Receive Fixed / Pay Float</option>
                </Form.Select>
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label style={{ fontSize: 13 }}>Spread (bps)</Form.Label>
                <Form.Control
                  type="number"
                  step="1"
                  value={spread}
                  onChange={(e) => setSpread(parseFloat(e.target.value) || 0)}
                />
              </Form.Group>

              {/* Datos Operativos (collapsible) */}
              <div
                style={{
                  marginBottom: 12,
                  border: '1px solid #dee2e6',
                  borderRadius: 6,
                  overflow: 'hidden',
                }}
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setShowOperational(!showOperational)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setShowOperational(!showOperational); }}
                  style={{
                    padding: '8px 12px',
                    background: '#f8f9fa',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 600,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  Datos Operativos
                  <span style={{ fontSize: 11, color: '#888' }}>{showOperational ? '▲' : '▼'}</span>
                </div>
                {showOperational && (
                  <div style={{ padding: 12 }}>
                    <Row>
                      <Col>
                        <Form.Group className="mb-2">
                          <Form.Label style={{ fontSize: 12 }}>ID Operación</Form.Label>
                          <Form.Control size="sm" value={idOperacion} onChange={(e) => setIdOperacion(e.target.value)} placeholder="Ej: IRS-BOCS-01" />
                        </Form.Group>
                      </Col>
                      <Col>
                        <Form.Group className="mb-2">
                          <Form.Label style={{ fontSize: 12 }}>Fecha Celebración</Form.Label>
                          <Form.Control size="sm" type="date" value={tradeDate} onChange={(e) => setTradeDate(e.target.value)} />
                        </Form.Group>
                      </Col>
                    </Row>
                    <Row>
                      <Col>
                        <Form.Group className="mb-2">
                          <Form.Label style={{ fontSize: 12 }}>Sociedad</Form.Label>
                          <Form.Control size="sm" value={sociedad} onChange={(e) => setSociedad(e.target.value)} placeholder="Ej: BP01" />
                        </Form.Group>
                      </Col>
                      <Col>
                        <Form.Group className="mb-2">
                          <Form.Label style={{ fontSize: 12 }}>ID Banco</Form.Label>
                          <Form.Control size="sm" value={idBanco} onChange={(e) => setIdBanco(e.target.value)} />
                        </Form.Group>
                      </Col>
                    </Row>
                    <Row>
                      <Col>
                        <Form.Group className="mb-2">
                          <Form.Label style={{ fontSize: 12 }}>Modalidad</Form.Label>
                          <Form.Control size="sm" value={modalidad} onChange={(e) => setModalidad(e.target.value)} placeholder="Ej: OIS" />
                        </Form.Group>
                      </Col>
                      <Col>
                        <Form.Group className="mb-2">
                          <Form.Label style={{ fontSize: 12 }}>Fecha Cumplimiento</Form.Label>
                          <Form.Control size="sm" type="date" value={settlementDate} onChange={(e) => setSettlementDate(e.target.value)} />
                        </Form.Group>
                      </Col>
                    </Row>
                    <Row>
                      <Col>
                        <Form.Group className="mb-2">
                          <Form.Label style={{ fontSize: 12 }}>Tipo Divisa</Form.Label>
                          <Form.Select size="sm" value={tipoDivisa} onChange={(e) => setTipoDivisa(e.target.value)}>
                            <option value="COP">COP</option>
                            <option value="USD/COP">USD/COP</option>
                          </Form.Select>
                        </Form.Group>
                      </Col>
                      <Col>
                        <Form.Group className="mb-2">
                          <Form.Label style={{ fontSize: 12 }}>Estado</Form.Label>
                          <Form.Select size="sm" value={estado} onChange={(e) => setEstado(e.target.value)}>
                            <option value="Activo">Activo</option>
                            <option value="Vencido">Vencido</option>
                            <option value="Cancelado">Cancelado</option>
                          </Form.Select>
                        </Form.Group>
                      </Col>
                    </Row>
                    <Form.Group className="mb-2">
                      <Form.Label style={{ fontSize: 12 }}>Doc. SAP</Form.Label>
                      <Form.Control size="sm" value={docSap} onChange={(e) => setDocSap(e.target.value)} />
                    </Form.Group>
                  </div>
                )}
              </div>

              <Button
                variant="primary"
                onClick={handlePriceSwap}
                disabled={loading || !curvesReady}
                style={{ width: '100%' }}
              >
                <Icon icon={faPlay} className="me-1" />
                Valorar Swap
              </Button>
            </Form>
          </div>
        </Col>

        {/* Results */}
        <Col md={7}>
          {result ? (
            <div
              style={{
                background: '#fff',
                border: '1px solid #dee2e6',
                borderRadius: 8,
                padding: 20,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h6 style={{ margin: 0 }}>Resultado</h6>
                <Button
                  variant="outline-success"
                  size="sm"
                  onClick={async () => {
                    try {
                      const today = startDate || new Date().toISOString().slice(0, 10);
                      const matDate = useMaturity && maturityDate
                        ? maturityDate
                        : new Date(new Date().setFullYear(new Date().getFullYear() + tenorYears)).toISOString().slice(0, 10);
                      await createIbrSwapPosition({
                        label: '',
                        counterparty: '',
                        notional,
                        start_date: today,
                        maturity_date: matDate,
                        fixed_rate: fixedRate / 100,
                        pay_fixed: payFixed,
                        spread_bps: spread,
                        payment_frequency: paymentFrequency,
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
                      toast.success('Posicion IBR Swap guardada al portafolio');
                    } catch (e) {
                      toast.error(`Error: ${e instanceof Error ? e.message : String(e)}`);
                    }
                  }}
                >
                  <Icon icon={faSave} className="me-1" />
                  Guardar al Portafolio
                </Button>
              </div>

              {/* NPV highlight */}
              <div
                style={{
                  background: result.npv >= 0 ? '#e8f5e9' : '#fce4ec',
                  borderRadius: 8,
                  padding: '16px 20px',
                  marginBottom: 16,
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: 13, color: '#666' }}>NPV</div>
                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 700,
                    fontFamily: 'monospace',
                    color: result.npv >= 0 ? '#2e7d32' : '#c62828',
                  }}
                >
                  {fmtMM(result.npv)} COP
                </div>
              </div>

              <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse', marginBottom: 16 }}>
                <tbody>
                  {[
                    ['Fair Rate', fmtPct(result.fair_rate)],
                    ['Fixed Rate', fmtPct(result.fixed_rate)],
                    ['Spread vs Par', `${((result.fixed_rate - result.fair_rate) * 10000).toFixed(1)} bps`],
                    ['Fixed Leg NPV', fmtMM(result.fixed_leg_npv)],
                    ['Floating Leg NPV', fmtMM(result.floating_leg_npv)],
                    ['DV01', fmtMM(result.dv01)],
                    ['Fixed Leg BPS', fmt(result.fixed_leg_bps, 2)],
                    ['Notional', fmtMM(result.notional)],
                    ['Dirección', result.pay_fixed ? 'Pay Fixed' : 'Receive Fixed'],
                  ].map(([label, value]) => (
                    <tr key={label as string} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '6px 12px', fontWeight: 600, color: '#555', width: '45%' }}>
                        {label}
                      </td>
                      <td style={{ padding: '6px 12px', textAlign: 'right', fontFamily: 'monospace', fontSize: 13 }}>
                        {value}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* ── Carry Diario ── */}
              {(() => {
                const ibrO = result.ibr_overnight_pct ?? curveStatus?.ibr?.nodes?.['ibr_1d'];
                const carryDailyCop = result.carry_daily_cop
                  ?? (ibrO != null
                    ? (ibrO / 100 - result.fixed_rate) * result.notional / 365 * (result.pay_fixed ? 1 : -1)
                    : null);
                const diffBps = result.carry_daily_diff_bps
                  ?? (ibrO != null
                    ? (ibrO / 100 - result.fixed_rate) * 10000 * (result.pay_fixed ? 1 : -1)
                    : null);
                const ibrPct = result.ibr_overnight_pct ?? ibrO;
                return (
                  <div style={{ padding: 12, border: '2px solid #17a2b8', borderRadius: 8, marginBottom: 8, background: '#e8f8fb' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#17a2b8', marginBottom: 8 }}>Carry Diario (IBR Overnight)</div>
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontSize: 10, color: '#6c757d' }}>Carry COP / día</div>
                        <div style={{ fontFamily: 'monospace', fontSize: 15, fontWeight: 700, color: carryDailyCop != null ? npvColor(carryDailyCop) : '#999' }}>
                          {carryDailyCop != null ? `${fmtMM(carryDailyCop)} COP` : '—'}
                        </div>
                      </div>
                      {ibrPct != null && (
                        <div>
                          <div style={{ fontSize: 10, color: '#6c757d' }}>IBR Overnight</div>
                          <div style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 600 }}>{fmt(ibrPct, 4)}%</div>
                        </div>
                      )}
                      <div>
                        <div style={{ fontSize: 10, color: '#6c757d' }}>Tasa Fija</div>
                        <div style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 600 }}>{fmtPct(result.fixed_rate)}</div>
                      </div>
                      {diffBps != null && (
                        <div>
                          <div style={{ fontSize: 10, color: '#6c757d' }}>Diferencial</div>
                          <div style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: npvColor(diffBps) }}>
                            {fmt(diffBps, 1)} bps
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* ── Carry Periodo ── */}
              {(() => {
                const ibrFwd = result.ibr_fwd_period_pct;
                const carryPeriod = result.carry_period_cop
                  ?? (() => {
                    // Estimate: fair_rate approximates next period floating
                    const freq: Record<string, number> = { '1M': 1, '3M': 3, '6M': 6, '12M': 12 };
                    const months = freq[paymentFrequency] || 3;
                    return (result.fair_rate - result.fixed_rate) * result.notional * (months / 12) * (payFixed ? 1 : -1);
                  })();
                const periodDiffBps = result.carry_period_diff_bps
                  ?? ((result.fair_rate - result.fixed_rate) * 10000 * (payFixed ? 1 : -1));
                return (
                  <div style={{ padding: 12, border: '1px solid #dee2e6', borderRadius: 8, background: '#f8f9fa' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#6c757d', marginBottom: 6 }}>Carry Periodo (Forward implícito)</div>
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontSize: 10, color: '#6c757d' }}>Carry Periodo COP</div>
                        <div style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 600, color: npvColor(carryPeriod) }}>
                          {fmtMM(carryPeriod)} COP
                        </div>
                      </div>
                      {ibrFwd != null && (
                        <div>
                          <div style={{ fontSize: 10, color: '#6c757d' }}>IBR Fwd Periodo</div>
                          <div style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 600 }}>{fmt(ibrFwd, 4)}%</div>
                        </div>
                      )}
                      <div>
                        <div style={{ fontSize: 10, color: '#6c757d' }}>Fair Rate (proxy fwd)</div>
                        <div style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 600 }}>{fmtPct(result.fair_rate)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: '#6c757d' }}>Diff Periodo</div>
                        <div style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: npvColor(periodDiffBps) }}>
                          {fmt(periodDiffBps, 1)} bps
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : (
            <div
              style={{
                height: 300,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#999',
                border: '1px dashed #dee2e6',
                borderRadius: 8,
              }}
            >
              {curvesReady
                ? 'Complete los parámetros y presione Valorar'
                : 'Primero construya las curvas'}
            </div>
          )}
        </Col>
      </Row>

      {/* ── Cashflows Proyectados ── */}
      {result && (() => {
        const resolvedStart = startDate || (() => {
          const d = new Date();
          d.setDate(d.getDate() + 2);
          return d.toISOString().slice(0, 10);
        })();
        const resolvedMaturity = useMaturity && maturityDate
          ? maturityDate
          : (() => {
            const d = new Date(resolvedStart + 'T00:00:00');
            d.setFullYear(d.getFullYear() + tenorYears);
            return d.toISOString().slice(0, 10);
          })();
        const cashflows: IbrSwapCashflow[] = result.cashflows
          ?? generateCashflows(
            notional, fixedRate / 100, result.fair_rate,
            resolvedStart, resolvedMaturity,
            paymentFrequency, payFixed,
          );
        const totalNet = cashflows.reduce((s, c) => s + c.net_amount, 0);
        return (
          <Row className="mt-3">
            <Col>
              <div style={{ background: '#fff', border: '1px solid #dee2e6', borderRadius: 8, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <h6 style={{ margin: 0, fontSize: 14 }}>Cashflows Proyectados</h6>
                  <span style={{ fontSize: 12, color: '#6c757d' }}>
                    Total neto: <strong style={{ fontFamily: 'monospace', color: npvColor(totalNet) }}>{fmtMM(totalNet)} COP</strong>
                    {!result.cashflows && <span style={{ fontSize: 10, color: '#ffc107', marginLeft: 8 }}>* estimado (fair rate como proxy)</span>}
                  </span>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #dee2e6', background: '#f8f9fa' }}>
                        {['#', 'Inicio', 'Fin', 'Días', 'Tasa Fija', 'IBR Fwd', 'Pago Fijo', 'Pago Flotante', 'Neto COP'].map((h) => (
                          <th key={h} style={{ padding: '6px 8px', textAlign: h === '#' || h === 'Días' ? 'center' : 'right', whiteSpace: 'nowrap', fontWeight: 600 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {cashflows.map((cf) => {
                        const today = new Date();
                        const isPast = new Date(cf.end) < today;
                        const isCurrent = new Date(cf.start) <= today && new Date(cf.end) >= today;
                        return (
                          <tr
                            key={cf.period}
                            style={{
                              borderBottom: '1px solid #f0f0f0',
                              background: isCurrent ? '#fffde7' : isPast ? '#fafafa' : 'transparent',
                            }}
                          >
                            <td style={{ padding: '4px 8px', textAlign: 'center', color: '#6c757d' }}>{cf.period}</td>
                            <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{cf.start}</td>
                            <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{cf.end}</td>
                            <td style={{ padding: '4px 8px', textAlign: 'center', color: '#6c757d' }}>{cf.days}</td>
                            <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{(cf.fixed_rate * 100).toFixed(4)}%</td>
                            <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{(cf.floating_rate * 100).toFixed(4)}%</td>
                            <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace', color: '#dc3545' }}>
                              ({fmtMM(cf.fixed_amount)})
                            </td>
                            <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace', color: '#28a745' }}>
                              {fmtMM(cf.floating_amount)}
                            </td>
                            <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: npvColor(cf.net_amount) }}>
                              {fmtMM(cf.net_amount)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{ borderTop: '2px solid #dee2e6', background: '#f8f9fa' }}>
                        <td colSpan={8} style={{ padding: '6px 8px', fontWeight: 600, textAlign: 'right', fontSize: 12 }}>Total</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: npvColor(totalNet) }}>
                          {fmtMM(totalNet)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </Col>
          </Row>
        );
      })()}
    </>
  );

  const renderParCurveTab = () => {
    const chartData = parCurve
      .filter((p) => p.par_rate != null)
      .map((p) => ({
        ...p,
        par_rate_pct: p.par_rate * 100,
      }));

    return (
      <>
        <Row className="mb-3">
          <Col>
            <Button
              variant="outline-primary"
              onClick={handleFetchParCurve}
              disabled={loading || !curvesReady}
            >
              <Icon icon={faSyncAlt} className="me-1" />
              Cargar Par Curve
            </Button>
          </Col>
        </Row>

        {chartData.length > 0 ? (
          <>
            {/* Chart */}
            <Row>
              <Col>
                <div style={{ background: '#fff', borderRadius: 8, padding: 16, border: '1px solid #dee2e6' }}>
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="tenor" />
                      <YAxis
                        domain={['auto', 'auto']}
                        tickFormatter={(v: number) => `${v.toFixed(1)}%`}
                      />
                      <Tooltip formatter={(v: number) => `${v.toFixed(4)}%`} />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="par_rate_pct"
                        name="Par Swap Rate (%)"
                        stroke="#1f77b4"
                        strokeWidth={2}
                        dot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Col>
            </Row>

            {/* Table */}
            <Row className="mt-3">
              <Col>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #dee2e6' }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left' }}>Tenor</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>Años</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>Par Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parCurve.map((pt) => (
                        <tr key={pt.tenor} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={{ padding: '6px 12px', fontWeight: 600 }}>{pt.tenor}</td>
                          <td style={{ padding: '6px 12px', textAlign: 'right' }}>
                            {pt.tenor_years}
                          </td>
                          <td style={{ padding: '6px 12px', textAlign: 'right', fontFamily: 'monospace' }}>
                            {pt.par_rate != null ? fmtPct(pt.par_rate) : pt.error || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Col>
            </Row>
          </>
        ) : (
          <Row>
            <Col>
              <div
                style={{
                  height: 400,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#999',
                  border: '1px dashed #dee2e6',
                  borderRadius: 8,
                }}
              >
                {curvesReady
                  ? 'Presione "Cargar Par Curve" para ver las tasas par'
                  : 'Primero construya las curvas'}
              </div>
            </Col>
          </Row>
        )}
      </>
    );
  };

  return (
    <CoreLayout>
      <Container fluid className="px-4">
        <Row>
          <div className="d-flex align-items-center gap-2 py-1">
            <PageTitle>
              <Icon icon={faCalculator} size="1x" />
              <h4>{PAGE_TITLE}</h4>
            </PageTitle>
          </div>
        </Row>
        <Row>
          <div className="d-flex justify-content-between pb-3">
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
          </div>
        </Row>

        {activeTab === 'pricing' && renderPricingTab()}
        {activeTab === 'parcurve' && renderParCurveTab()}
      </Container>
    </CoreLayout>
  );
}

export default IbrSwapPricer;
