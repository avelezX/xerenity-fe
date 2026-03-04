'use client';

import { CoreLayout } from '@layout';
import { Row, Col, Form } from 'react-bootstrap';
import React, { useState, useCallback, useEffect } from 'react';
import Container from 'react-bootstrap/Container';
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import {
  faCalculator,
  faLineChart,
  faPlay,
  faSyncAlt,
  faTable,
  faSave,
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'react-toastify';
import PageTitle from '@components/PageTitle';
import Button from '@components/UI/Button';
import { Tab, Tabs, TabItemType } from '@components/UI/Tabs';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import {
  buildCurves,
  priceXccySwap,
  getXccyCashflows,
  getXccyParBasisCurve,
  getCurveStatus,
  type XccySwapRequest,
  type ParBasisCurveRequest,
} from 'src/models/pricing/pricingApi';
import type {
  XccySwapResult,
  XccyCashflowResponse,
  ParBasisPoint,
  CurveStatus,
} from 'src/types/pricing';
import { createXccyPosition } from 'src/models/trading';

const PAGE_TITLE = 'Cross-Currency Swap';

const TAB_ITEMS: TabItemType[] = [
  { name: 'Pricing', property: 'pricing', icon: faCalculator, active: true },
  { name: 'Cashflows', property: 'cashflows', icon: faTable, active: false },
  { name: 'Par Basis Curve', property: 'basis', icon: faLineChart, active: false },
];

const fmt = (v: number | null | undefined, decimals = 2) =>
  v != null
    ? v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    : '\u2014';

const fmtMM = (v: number | null | undefined) => {
  if (v == null) return '\u2014';
  const abs = Math.abs(v);
  if (abs >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return fmt(v, 2);
};

// Format number with thousand separators for display in inputs
const fmtInput = (v: number) =>
  v ? v.toLocaleString('en-US', { maximumFractionDigits: 0 }) : '';

// Parse formatted string back to number (remove commas)
const parseInput = (s: string): number => {
  const cleaned = s.replace(/,/g, '');
  return parseFloat(cleaned) || 0;
};

function XccySwapPage() {
  const [activeTab, setActiveTab] = useState('pricing');
  const [pageTabs, setPageTabs] = useState<TabItemType[]>(TAB_ITEMS);
  const [loading, setLoading] = useState(false);
  const [curvesReady, setCurvesReady] = useState(false);
  const [curveStatus, setCurveStatus] = useState<CurveStatus | null>(null);

  // Form state
  const [notionalUsd, setNotionalUsd] = useState(1_000_000);
  const [startDate, setStartDate] = useState('');
  const [maturityDate, setMaturityDate] = useState('');
  const [fxInitial, setFxInitial] = useState('');
  const [paymentFrequency, setPaymentFrequency] = useState('3M');
  const [amortizationType, setAmortizationType] = useState('bullet');
  const [customSchedule, setCustomSchedule] = useState('');
  const [usdSpreadBps, setUsdSpreadBps] = useState(0);
  const [copSpreadBps, setCopSpreadBps] = useState(0);
  const [xccyBasisBps, setXccyBasisBps] = useState(0);
  const [payUsd, setPayUsd] = useState(true);

  // Operational fields (for saving to portfolio)
  const [showOperational, setShowOperational] = useState(false);
  const [idOperacion, setIdOperacion] = useState('');
  const [tradeDate, setTradeDate] = useState('');
  const [sociedad, setSociedad] = useState('');
  const [idBanco, setIdBanco] = useState('');
  const [modalidad, setModalidad] = useState('Non Delivery');
  const [settlementDate, setSettlementDate] = useState('');
  const [tipoDivisa, setTipoDivisa] = useState('USD/COP');
  const [estado, setEstado] = useState('Activo');
  const [docSap, setDocSap] = useState('');

  // Results
  const [result, setResult] = useState<XccySwapResult | null>(null);
  const [cashflowResult, setCashflowResult] = useState<XccyCashflowResponse | null>(null);
  const [pricedAt, setPricedAt] = useState<string | null>(null);
  const [parBasisCurve, setParBasisCurve] = useState<ParBasisPoint[]>([]);

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
      setCurvesReady(status.ibr.built && status.sofr.built);
    } catch (e) {
      toast.error(`Error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, []);

  // On mount: check if curves are already built on the backend
  useEffect(() => {
    handleCheckStatus();
  }, [handleCheckStatus]);

  // Validation: returns list of missing field names
  const getMissingFields = useCallback((): string[] => {
    const missing: string[] = [];
    if (!notionalUsd || notionalUsd <= 0) missing.push('Nocional USD');
    if (!startDate) missing.push('Fecha Inicio');
    if (!maturityDate) missing.push('Fecha Vencimiento');
    if (startDate && maturityDate && startDate >= maturityDate) missing.push('Vencimiento debe ser posterior al inicio');
    if (amortizationType === 'custom' && !customSchedule.trim()) missing.push('Schedule Custom');
    return missing;
  }, [notionalUsd, startDate, maturityDate, amortizationType, customSchedule]);

  const handlePrice = useCallback(async () => {
    const missing = getMissingFields();
    if (missing.length > 0) {
      toast.warn(`Campos faltantes: ${missing.join(', ')}`);
      return;
    }
    setLoading(true);
    try {
      const freqMap: Record<string, number> = { '1M': 1, '3M': 3, '6M': 6, '12M': 12 };
      const params: XccySwapRequest = {
        notional_usd: notionalUsd,
        start_date: startDate,
        maturity_date: maturityDate,
        usd_spread_bps: usdSpreadBps,
        cop_spread_bps: copSpreadBps,
        xccy_basis_bps: xccyBasisBps,
        pay_usd: payUsd,
        payment_frequency_months: freqMap[paymentFrequency] ?? 3,
        amortization_type: amortizationType,
      };
      if (fxInitial) params.fx_initial = parseFloat(fxInitial);
      if (amortizationType === 'custom' && customSchedule.trim()) {
        params.amortization_schedule = customSchedule
          .split(',')
          .map((s) => parseFloat(s.trim()))
          .filter((n) => !Number.isNaN(n));
      }
      const [res, cfRes] = await Promise.all([
        priceXccySwap(params),
        getXccyCashflows(params),
      ]);
      setResult(res);
      setCashflowResult(cfRes);
      setPricedAt(new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (e) {
      toast.error(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  }, [notionalUsd, startDate, maturityDate, fxInitial, paymentFrequency, amortizationType, customSchedule, usdSpreadBps, copSpreadBps, xccyBasisBps, payUsd]);

  const handleFetchParBasis = useCallback(async () => {
    setLoading(true);
    try {
      const params: ParBasisCurveRequest = {
        payment_frequency: paymentFrequency,
        amortization_type: amortizationType,
      };
      if (fxInitial) params.fx_initial = parseFloat(fxInitial);
      const data = await getXccyParBasisCurve(params);
      setParBasisCurve(data);
    } catch (e) {
      toast.error(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  }, [paymentFrequency, amortizationType, fxInitial]);

  // ── Curve Status Bar ──
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
        {' | Spot: '}
        {curveStatus.fx_spot ? (
          <span style={{ fontWeight: 600 }}>{fmt(curveStatus.fx_spot, 2)}</span>
        ) : (
          <span style={{ color: '#dc3545', fontWeight: 600 }}>No disponible</span>
        )}
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

  // ── Tab 1: Pricing ──
  const renderPricingTab = () => (
    <Row>
      <Col md={5}>
        <div style={{ background: '#fff', border: '1px solid #dee2e6', borderRadius: 8, padding: 20 }}>
          <h6 style={{ marginBottom: 16 }}>Parametros CCS USD/COP</h6>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label style={{ fontSize: 13, fontWeight: 600 }}>
                Nocional USD {!notionalUsd && <span style={{ color: '#dc3545' }}>*</span>}
              </Form.Label>
              <Form.Control
                type="text"
                value={fmtInput(notionalUsd)}
                onChange={(e) => setNotionalUsd(parseInput(e.target.value))}
                style={{ fontFamily: 'monospace' }}
              />
              <Form.Text muted style={{ fontSize: 11 }}>
                Monto principal en USD. El nocional COP se calcula como Nocional USD x FX Inicial.
              </Form.Text>
            </Form.Group>
            <Row>
              <Col>
                <Form.Group className="mb-3">
                  <Form.Label style={{ fontSize: 13, fontWeight: 600 }}>
                    Fecha Inicio {!startDate && <span style={{ color: '#dc3545' }}>*</span>}
                  </Form.Label>
                  <Form.Control
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    style={!startDate ? { borderColor: '#dc3545' } : undefined}
                  />
                  <Form.Text muted style={{ fontSize: 11 }}>
                    Fecha de inicio de causacion de intereses (T+1 desde celebracion).
                  </Form.Text>
                </Form.Group>
              </Col>
              <Col>
                <Form.Group className="mb-3">
                  <Form.Label style={{ fontSize: 13, fontWeight: 600 }}>
                    Fecha Vencimiento {!maturityDate && <span style={{ color: '#dc3545' }}>*</span>}
                  </Form.Label>
                  <Form.Control
                    type="date"
                    value={maturityDate}
                    onChange={(e) => setMaturityDate(e.target.value)}
                    style={!maturityDate ? { borderColor: '#dc3545' } : undefined}
                  />
                  <Form.Text muted style={{ fontSize: 11 }}>
                    Fecha de vencimiento del swap. Plazos tipicos: 1Y-10Y.
                  </Form.Text>
                </Form.Group>
              </Col>
            </Row>
            <Form.Group className="mb-3">
              <Form.Label style={{ fontSize: 13 }}>FX Inicial</Form.Label>
              <Form.Control
                type="number"
                step="0.01"
                placeholder={curveStatus?.fx_spot ? `Spot: ${fmt(curveStatus.fx_spot, 2)}` : 'Ej: 3661.00'}
                value={fxInitial}
                onChange={(e) => setFxInitial(e.target.value)}
              />
              <Form.Text muted style={{ fontSize: 11 }}>
                Tasa de cambio pactada al inicio del swap (USD/COP). Si se deja vacio, usa el spot de mercado actual.
              </Form.Text>
            </Form.Group>
            <Row>
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
                  </Form.Select>
                  <Form.Text muted style={{ fontSize: 11 }}>
                    Periodicidad de pago de intereses y amortizacion. Estandar en Colombia: 3M.
                  </Form.Text>
                </Form.Group>
              </Col>
              <Col>
                <Form.Group className="mb-3">
                  <Form.Label style={{ fontSize: 13 }}>Amortizacion</Form.Label>
                  <Form.Select
                    value={amortizationType}
                    onChange={(e) => setAmortizationType(e.target.value)}
                  >
                    <option value="bullet">Bullet (sin amortizacion)</option>
                    <option value="linear">Lineal (% igual por periodo)</option>
                    <option value="custom">Custom (schedule manual)</option>
                  </Form.Select>
                  <Form.Text muted style={{ fontSize: 11 }}>
                    Bullet: nocional constante, principal al final. Lineal: amortiza 1/N cada periodo.
                  </Form.Text>
                </Form.Group>
              </Col>
            </Row>
            {amortizationType === 'custom' && (
              <Form.Group className="mb-3">
                <Form.Label style={{ fontSize: 13, fontWeight: 600 }}>
                  Schedule Custom {!customSchedule.trim() && <span style={{ color: '#dc3545' }}>*</span>}
                </Form.Label>
                <Form.Control
                  as="textarea"
                  rows={2}
                  placeholder="Ej: 1.0, 0.875, 0.75, 0.625, 0.5, 0.375, 0.25, 0.125"
                  value={customSchedule}
                  onChange={(e) => setCustomSchedule(e.target.value)}
                  style={{ fontSize: 13, fontFamily: 'monospace', borderColor: !customSchedule.trim() ? '#dc3545' : undefined }}
                />
                <Form.Text muted style={{ fontSize: 11 }}>
                  Fraccion de nocional remanente por periodo (1.0 = 100%). Debe tener exactamente N valores separados por coma, donde N = numero de periodos del swap.
                </Form.Text>
              </Form.Group>
            )}
            <Row>
              <Col>
                <Form.Group className="mb-3">
                  <Form.Label style={{ fontSize: 13 }}>Spread USD (bps)</Form.Label>
                  <Form.Control
                    type="number"
                    step="1"
                    value={usdSpreadBps}
                    onChange={(e) => setUsdSpreadBps(parseFloat(e.target.value) || 0)}
                  />
                  <Form.Text muted style={{ fontSize: 11 }}>
                    Spread sobre SOFR en la pata USD. Este ES el cross-currency basis. Ej: -22 bps. Convencion colombiana: SOFR + basis vs IBR flat.
                  </Form.Text>
                </Form.Group>
              </Col>
              <Col>
                <Form.Group className="mb-3">
                  <Form.Label style={{ fontSize: 13 }}>Spread COP (bps)</Form.Label>
                  <Form.Control
                    type="number"
                    step="1"
                    value={copSpreadBps}
                    onChange={(e) => setCopSpreadBps(parseFloat(e.target.value) || 0)}
                  />
                  <Form.Text muted style={{ fontSize: 11 }}>
                    Spread adicional sobre IBR en la pata COP. Usualmente 0 bps en el mercado colombiano.
                  </Form.Text>
                </Form.Group>
              </Col>
            </Row>
            <Form.Group className="mb-3">
              <Form.Label style={{ fontSize: 13 }}>Basis Xccy COP (bps)</Form.Label>
              <Form.Control
                type="number"
                step="1"
                value={xccyBasisBps}
                onChange={(e) => setXccyBasisBps(parseFloat(e.target.value) || 0)}
              />
              <Form.Text muted style={{ fontSize: 11 }}>
                Cross-currency basis spread sobre la pata COP (IBR). Negativo = penalizacion COP. Distinto del spread USD.
              </Form.Text>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label style={{ fontSize: 13 }}>Direccion</Form.Label>
              <Form.Select
                value={payUsd ? 'pay_usd' : 'receive_usd'}
                onChange={(e) => setPayUsd(e.target.value === 'pay_usd')}
              >
                <option value="pay_usd">Pay USD (SOFR) / Receive COP (IBR)</option>
                <option value="receive_usd">Receive USD (SOFR) / Pay COP (IBR)</option>
              </Form.Select>
              <Form.Text muted style={{ fontSize: 11 }}>
                Pay USD: usted paga la tasa SOFR + spread y recibe IBR. Tipico para empresas colombianas con deuda en USD.
              </Form.Text>
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
                        <Form.Control size="sm" value={idOperacion} onChange={(e) => setIdOperacion(e.target.value)} placeholder="Ej: CCS-BOCS-01" />
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
                        <Form.Select size="sm" value={modalidad} onChange={(e) => setModalidad(e.target.value)}>
                          <option value="Non Delivery">Non Delivery</option>
                          <option value="Delivery">Delivery</option>
                        </Form.Select>
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
                          <option value="USD/COP">USD/COP</option>
                          <option value="EUR/COP">EUR/COP</option>
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

            {/* Validation summary */}
            {getMissingFields().length > 0 && (
              <div
                style={{
                  background: '#fff3cd',
                  border: '1px solid #ffc107',
                  borderRadius: 6,
                  padding: '8px 12px',
                  fontSize: 12,
                  marginBottom: 12,
                  color: '#856404',
                }}
              >
                <strong>Campos requeridos:</strong> {getMissingFields().join(', ')}
              </div>
            )}

            <Button
              variant="primary"
              onClick={handlePrice}
              disabled={loading || !curvesReady}
              style={{ width: '100%' }}
            >
              <Icon icon={faPlay} className="me-1" />
              Valorar CCS
            </Button>

            {/* Convention reference */}
            <div
              style={{
                marginTop: 12,
                padding: '10px 12px',
                background: '#f0f4ff',
                borderRadius: 6,
                fontSize: 11,
                color: '#555',
                lineHeight: 1.5,
              }}
            >
              <strong>Convenciones:</strong> Base liquidacion ACT/360 ambas patas. Calendario conjunto Colombia + US.
              Dia habil siguiente (Modified Following). Settlement: Non-Delivery (neteo en COP al FX pactado).
              Tasas: SOFR compuesta trimestre vencido / IBR nominal trimestral pagadera trimestre vencido.
            </div>
          </Form>
        </div>
      </Col>

      {/* Results */}
      <Col md={7}>
        {result ? (
          <div style={{ background: '#fff', border: '1px solid #dee2e6', borderRadius: 8, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h6 style={{ margin: 0 }}>Resultado</h6>
              <div className="d-flex align-items-center gap-2">
                {pricedAt && (
                  <span style={{ fontSize: 11, color: '#999' }}>Valorado a las {pricedAt}</span>
                )}
                <Button
                  variant="outline-success"
                  size="sm"
                  onClick={async () => {
                    try {
                      await createXccyPosition({
                        label: '',
                        counterparty: '',
                        notional_usd: notionalUsd,
                        start_date: startDate,
                        maturity_date: maturityDate,
                        usd_spread_bps: usdSpreadBps,
                        cop_spread_bps: copSpreadBps,
                        pay_usd: payUsd,
                        fx_initial: parseFloat(fxInitial as string) || 0,
                        payment_frequency: paymentFrequency,
                        amortization_type: amortizationType,
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
                      toast.success('Posicion guardada al portafolio');
                    } catch (e) {
                      toast.error(`Error: ${e instanceof Error ? e.message : String(e)}`);
                    }
                  }}
                >
                  <Icon icon={faSave} className="me-1" />
                  Guardar al Portafolio
                </Button>
              </div>
            </div>

            {/* NPV highlight box */}
            <div
              style={{
                display: 'flex',
                gap: 16,
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  flex: 1,
                  background: result.npv_usd >= 0 ? '#d4edda' : '#f8d7da',
                  borderRadius: 8,
                  padding: '12px 16px',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: 12, color: '#555' }}>NPV USD</div>
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    fontFamily: 'monospace',
                    color: result.npv_usd >= 0 ? '#155724' : '#721c24',
                  }}
                >
                  {fmtMM(result.npv_usd)}
                </div>
                <div style={{ fontSize: 10, color: '#888', marginTop: 4 }}>Mark-to-market en USD</div>
              </div>
              <div
                style={{
                  flex: 1,
                  background: result.npv_cop >= 0 ? '#d4edda' : '#f8d7da',
                  borderRadius: 8,
                  padding: '12px 16px',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: 12, color: '#555' }}>NPV COP</div>
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    fontFamily: 'monospace',
                    color: result.npv_cop >= 0 ? '#155724' : '#721c24',
                  }}
                >
                  {fmtMM(result.npv_cop)}
                </div>
                <div style={{ fontSize: 10, color: '#888', marginTop: 4 }}>Mark-to-market en COP</div>
              </div>
              <div
                style={{
                  flex: 1,
                  background: '#cce5ff',
                  borderRadius: 8,
                  padding: '12px 16px',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: 12, color: '#555' }}>Par Basis</div>
                <div style={{ fontSize: 13, color: '#555', marginTop: 4 }}>Ver pestaña</div>
                <div style={{ fontSize: 10, color: '#888', marginTop: 4 }}>Spread sobre SOFR que hace NPV = 0</div>
              </div>
            </div>

            {/* Carry & Sensitivities */}
            <div
              style={{
                display: 'flex',
                gap: 12,
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  flex: 1,
                  border: '1px solid #e0e0e0',
                  borderRadius: 8,
                  padding: '10px 14px',
                }}
              >
                <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Carry Diario</div>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    fontFamily: 'monospace',
                    color: result.carry_daily_cop >= 0 ? '#155724' : '#721c24',
                  }}
                >
                  {fmtMM(result.carry_daily_cop)} COP/día
                </div>
                <div style={{ fontSize: 10, color: '#aaa', marginTop: 4 }}>
                  IBR leg − SOFR leg × spot (período actual)
                </div>
              </div>
              <div
                style={{
                  flex: 1,
                  border: '1px solid #e0e0e0',
                  borderRadius: 8,
                  padding: '10px 14px',
                }}
              >
                <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>
                  Carry Acumulado{result.current_period ? ` (${result.current_period.days_elapsed}d)` : ''}
                </div>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    fontFamily: 'monospace',
                    color: result.carry_accrued_cop >= 0 ? '#155724' : '#721c24',
                  }}
                >
                  {fmtMM(result.carry_accrued_cop)} COP
                </div>
                <div style={{ fontSize: 10, color: '#aaa', marginTop: 4 }}>
                  En el período de accrual actual
                </div>
              </div>
              <div
                style={{
                  flex: 1,
                  border: '1px solid #e0e0e0',
                  borderRadius: 8,
                  padding: '10px 14px',
                }}
              >
                <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>FX Delta</div>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    fontFamily: 'monospace',
                    color: '#004085',
                  }}
                >
                  {fmtMM(result.fx_delta_cop)} COP
                </div>
                <div style={{ fontSize: 10, color: '#aaa', marginTop: 4 }}>
                  Δ NPV por +1 COP/USD en spot
                </div>
              </div>
            </div>

            <table style={{ width: '100%', fontSize: 14, borderCollapse: 'collapse' }}>
              <tbody>
                {([
                  ['PV Intereses USD', fmtMM(result.usd_leg_pv), 'VP flujos de interes pata SOFR'],
                  ['PV Intereses COP', fmtMM(result.cop_leg_pv), 'VP flujos de interes pata IBR'],
                  ['PV Principal USD', fmtMM(result.usd_notional_exchange_pv), 'VP intercambios de nocional USD'],
                  ['PV Principal COP', fmtMM(result.cop_notional_exchange_pv), 'VP intercambios de nocional COP'],
                  ['', '', ''],
                  ['Nocional USD', fmt(result.notional_usd, 0), 'Monto inicial en dolares'],
                  ['Nocional COP', fmt(result.notional_cop, 0), 'Nocional USD x FX inicial'],
                  ['FX Inicial', fmt(result.fx_initial, 2), 'Tasa de cambio de pactacion'],
                  ['FX Spot', fmt(result.fx_spot, 2), 'Tasa de cambio actual del mercado'],
                  ['Xccy Basis', `${result.xccy_basis_bps} bps`, 'Basis sobre IBR pata COP'],
                  ['Amortizacion', result.amortization_type, 'Tipo de repago del principal'],
                  ['Días en operación', String(result.days_open), 'Dias desde inicio del swap'],
                  ['Períodos restantes', String(result.periods_remaining), 'Periodos de pago pendientes'],
                  ...(result.current_period ? [
                    ['IBR fwd (período)', `${result.current_period.ibr_fwd_pct.toFixed(2)}%`, 'Tasa IBR forward del período actual'],
                    ['SOFR fwd (período)', `${result.current_period.sofr_fwd_pct.toFixed(2)}%`, 'Tasa SOFR forward del período actual'],
                    ['Diferencial', `${result.current_period.differential_bps.toFixed(1)} bps`, 'IBR − SOFR (período actual)'],
                  ] as [string, string, string][] : []),
                  ['Inicio', result.start_date, 'Fecha efectiva del swap'],
                  ['Vencimiento', result.maturity_date, 'Fecha de terminacion'],
                ] as [string, string, string][]).map(([label, value, desc]) => {
                  if (!label && !value) {
                    return <tr key="spacer" style={{ height: 8 }} />;
                  }
                  return (
                    <tr key={label} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '6px 12px', width: '45%' }}>
                        <div style={{ fontWeight: 600, color: '#555' }}>{label}</div>
                        <div style={{ fontSize: 10, color: '#aaa' }}>{desc}</div>
                      </td>
                      <td style={{ padding: '6px 12px', textAlign: 'right', fontFamily: 'monospace', fontSize: 14 }}>
                        {value}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div
            style={{
              height: 300,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#999',
              border: '1px dashed #dee2e6',
              borderRadius: 8,
              padding: 24,
              textAlign: 'center',
            }}
          >
            {(() => {
              if (!curvesReady) {
                return (
                  <div>
                    <div style={{ fontSize: 14, marginBottom: 8 }}>Primero construya las curvas</div>
                    <div style={{ fontSize: 12 }}>Presione &ldquo;Construir Curvas&rdquo; en la esquina superior derecha</div>
                  </div>
                );
              }
              if (getMissingFields().length > 0) {
                return (
                  <div>
                    <div style={{ fontSize: 14, marginBottom: 8 }}>Campos pendientes:</div>
                    {getMissingFields().map((f) => (
                      <div key={f} style={{ fontSize: 13, color: '#dc3545', fontWeight: 600 }}>{f}</div>
                    ))}
                  </div>
                );
              }
              return <div style={{ fontSize: 14 }}>Presione &ldquo;Valorar CCS&rdquo; para calcular</div>;
            })()}
          </div>
        )}
      </Col>
    </Row>
  );

  // ── Tab 2: Cashflows ──
  const renderCashflowsTab = () => {
    if (!cashflowResult || cashflowResult.periods.length === 0) {
      return (
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
          Primero valore un CCS en la pestaña Pricing
        </div>
      );
    }

    const periods = cashflowResult.periods;
    // Chart: skip period 0 (inception notional exchange — dominates the scale)
    const chartData = periods
      .filter((p) => p.period_num > 0)
      .map((p) => ({
        label: p.date_end,
        cop_net: p.cop_net,
        status: p.status,
      }));

    const statusColor = (s: string) =>
      s === 'settled' ? '#adb5bd' : s === 'current' ? '#fd7e14' : '#0d6efd';

    return (
      <>
        {/* Net COP Cashflow Chart */}
        <Row className="mb-3">
          <Col>
            <div style={{ background: '#fff', borderRadius: 8, padding: 16, border: '1px solid #dee2e6' }}>
              <h6 style={{ marginBottom: 12 }}>Flujo Neto COP por Período</h6>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
                  <YAxis tickFormatter={(v: number) => fmtMM(v)} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(v: number) => [fmtMM(v), 'Neto COP']}
                    labelFormatter={(l: string) => `Pago: ${l}`}
                  />
                  <ReferenceLine y={0} stroke="#666" />
                  <Bar
                    dataKey="cop_net"
                    name="Neto COP"
                    radius={[3, 3, 0, 0]}
                    fill="#0d6efd"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Col>
        </Row>

        {/* Cashflow Table */}
        <Row>
          <Col>
            <div style={{ overflowX: 'auto', background: '#fff', borderRadius: 8, padding: 16, border: '1px solid #dee2e6' }}>
              <h6 style={{ marginBottom: 12 }}>
                Flujos de Intercambio — {cashflowResult.pay_usd ? 'Pay USD / Receive COP' : 'Receive USD / Pay COP'}
              </h6>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #dee2e6', background: '#f8f9fa' }}>
                    {['#', 'Fecha Pago', 'USD Neto', 'COP Neto', 'IBR fwd', 'SOFR fwd', 'Estado'].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: '6px 8px',
                          textAlign: h === '#' || h === 'Fecha Pago' || h === 'Estado' ? 'left' : 'right',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {periods.map((p) => (
                    <tr
                      key={p.period_num}
                      style={{
                        borderBottom: '1px solid #eee',
                        background: p.status === 'current' ? '#fff3cd' : undefined,
                      }}
                    >
                      <td style={{ padding: '4px 8px', fontWeight: 600, color: '#555' }}>{p.period_num}</td>
                      <td style={{ padding: '4px 8px', fontSize: 11 }}>{p.date_end}</td>
                      <td
                        style={{
                          padding: '4px 8px',
                          textAlign: 'right',
                          fontFamily: 'monospace',
                          color: p.usd_net >= 0 ? '#155724' : '#721c24',
                          fontWeight: 600,
                        }}
                      >
                        {fmt(p.usd_net, 0)}
                      </td>
                      <td
                        style={{
                          padding: '4px 8px',
                          textAlign: 'right',
                          fontFamily: 'monospace',
                          color: p.cop_net >= 0 ? '#155724' : '#721c24',
                          fontWeight: 600,
                        }}
                      >
                        {fmtMM(p.cop_net)}
                      </td>
                      <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace' }}>
                        {p.ibr_fwd_pct != null ? `${p.ibr_fwd_pct.toFixed(2)}%` : '—'}
                      </td>
                      <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace' }}>
                        {p.sofr_fwd_pct != null ? `${p.sofr_fwd_pct.toFixed(2)}%` : '—'}
                      </td>
                      <td style={{ padding: '4px 8px' }}>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 600,
                            color: statusColor(p.status),
                            textTransform: 'uppercase',
                          }}
                        >
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ fontSize: 10, color: '#aaa', marginTop: 8 }}>
                Negativo = cliente paga · Positivo = cliente recibe · Tasas settled no disponibles (tasas realizadas históricas no almacenadas)
              </div>
            </div>
          </Col>
        </Row>
      </>
    );
  };

  // ── Tab 3: Par Basis Curve ──
  const renderBasisTab = () => (
    <>
      <Row className="mb-3">
        <Col>
          <Button
            variant="outline-primary"
            onClick={handleFetchParBasis}
            disabled={loading || !curvesReady}
          >
            <Icon icon={faSyncAlt} className="me-1" />
            Calcular Par Basis Curve
          </Button>
          <span style={{ marginLeft: 12, fontSize: 13, color: '#666' }}>
            Freq: {paymentFrequency} | Amort: {amortizationType}
          </span>
        </Col>
      </Row>

      {parBasisCurve.length > 0 ? (
        <>
          <Row>
            <Col>
              <div style={{ background: '#fff', borderRadius: 8, padding: 16, border: '1px solid #dee2e6' }}>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={parBasisCurve.filter((p) => p.par_basis_bps != null)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      type="number"
                      dataKey="tenor_years"
                      ticks={parBasisCurve.filter((p) => p.par_basis_bps != null).map((d) => d.tenor_years)}
                      tickFormatter={(y: number) => `${y}Y`}
                    />
                    <YAxis
                      domain={['auto', 'auto']}
                      tickFormatter={(v: number) => `${v.toFixed(0)} bps`}
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip
                      labelFormatter={(y: number) => `${y}Y`}
                      formatter={(v: number) => [`${v.toFixed(2)} bps`, 'Par Basis']}
                    />
                    <ReferenceLine y={0} stroke="#999" strokeDasharray="3 3" />
                    <Line
                      type="monotone"
                      dataKey="par_basis_bps"
                      stroke="#6f42c1"
                      strokeWidth={2}
                      dot={{ r: 5 }}
                      name="Par Basis (bps)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Col>
          </Row>

          <Row className="mt-3">
            <Col md={6}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #dee2e6' }}>
                      <th style={{ padding: '8px 12px', textAlign: 'left' }}>Tenor</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>Par Basis (bps)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parBasisCurve.map((pt) => (
                      <tr key={pt.tenor} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '6px 12px', fontWeight: 600 }}>{pt.tenor}</td>
                        <td
                          style={{
                            padding: '6px 12px',
                            textAlign: 'right',
                            fontFamily: 'monospace',
                            color: (() => {
                              if (pt.par_basis_bps == null) return '#999';
                              return pt.par_basis_bps >= 0 ? '#28a745' : '#dc3545';
                            })(),
                            fontWeight: 600,
                          }}
                        >
                          {pt.par_basis_bps != null ? fmt(pt.par_basis_bps, 2) : pt.error || '\u2014'}
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
                ? 'Presione "Calcular Par Basis Curve" para ver el spread de equilibrio por tenor'
                : 'Primero construya las curvas'}
            </div>
          </Col>
        </Row>
      )}
    </>
  );

  return (
    <CoreLayout>
      <Container fluid className="px-4">
        <Row>
          <div className="d-flex align-items-center justify-content-between py-1">
            <PageTitle>
              <Icon icon={faCalculator} size="1x" />
              <h4>{PAGE_TITLE}</h4>
            </PageTitle>
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
          </div>
        </Row>

        {renderCurveStatus()}

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
        {activeTab === 'cashflows' && renderCashflowsTab()}
        {activeTab === 'basis' && renderBasisTab()}
      </Container>
    </CoreLayout>
  );
}

export default XccySwapPage;
