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
  getXccyParBasisCurve,
  getCurveStatus,
  type XccySwapRequest,
  type ParBasisCurveRequest,
} from 'src/models/pricing/pricingApi';
import type {
  XccySwapResult,
  ParBasisPoint,
  CurveStatus,
} from 'src/types/pricing';

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
  const [payUsd, setPayUsd] = useState(true);

  // Results
  const [result, setResult] = useState<XccySwapResult | null>(null);
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
      const params: XccySwapRequest = {
        notional_usd: notionalUsd,
        start_date: startDate,
        maturity_date: maturityDate,
        usd_spread_bps: usdSpreadBps,
        cop_spread_bps: copSpreadBps,
        pay_usd: payUsd,
        payment_frequency: paymentFrequency,
        amortization_type: amortizationType,
      };
      if (fxInitial) params.fx_initial = parseFloat(fxInitial);
      if (amortizationType === 'custom' && customSchedule.trim()) {
        params.amortization_schedule = customSchedule
          .split(',')
          .map((s) => parseFloat(s.trim()))
          .filter((n) => !Number.isNaN(n));
      }
      const res = await priceXccySwap(params);
      setResult(res);
      setPricedAt(new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (e) {
      toast.error(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  }, [notionalUsd, startDate, maturityDate, fxInitial, paymentFrequency, amortizationType, customSchedule, usdSpreadBps, copSpreadBps, payUsd]);

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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
              <h6 style={{ margin: 0 }}>Resultado</h6>
              {pricedAt && (
                <span style={{ fontSize: 11, color: '#999' }}>Valorado a las {pricedAt}</span>
              )}
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
              {result.par_basis_bps != null && (
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
                  <div
                    style={{
                      fontSize: 20,
                      fontWeight: 700,
                      fontFamily: 'monospace',
                      color: '#004085',
                    }}
                  >
                    {fmt(result.par_basis_bps, 1)} bps
                  </div>
                  <div style={{ fontSize: 10, color: '#888', marginTop: 4 }}>Spread sobre SOFR que hace NPV = 0</div>
                </div>
              )}
            </div>

            {/* P&L Decomposition */}
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
                <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>P&L por Tasas</div>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    fontFamily: 'monospace',
                    color: result.pnl_rate_usd >= 0 ? '#155724' : '#721c24',
                  }}
                >
                  {fmtMM(result.pnl_rate_usd)} USD
                </div>
                <div
                  style={{
                    fontSize: 12,
                    fontFamily: 'monospace',
                    color: '#666',
                  }}
                >
                  {fmtMM(result.pnl_rate_cop)} COP
                </div>
                <div style={{ fontSize: 10, color: '#aaa', marginTop: 4 }}>
                  Diferencial de tasas (spread contractual vs mercado)
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
                <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>P&L por FX</div>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    fontFamily: 'monospace',
                    color: result.pnl_fx_usd >= 0 ? '#155724' : '#721c24',
                  }}
                >
                  {fmtMM(result.pnl_fx_usd)} USD
                </div>
                <div
                  style={{
                    fontSize: 12,
                    fontFamily: 'monospace',
                    color: '#666',
                  }}
                >
                  {fmtMM(result.pnl_fx_cop)} COP
                </div>
                <div style={{ fontSize: 10, color: '#aaa', marginTop: 4 }}>
                  Movimiento del tipo de cambio (spot vs pactacion)
                </div>
              </div>
            </div>

            <table style={{ width: '100%', fontSize: 14, borderCollapse: 'collapse' }}>
              <tbody>
                {([
                  ['PV Intereses USD', fmtMM(result.usd_leg_pv), 'VP flujos de interes pata SOFR'],
                  ['PV Intereses COP', fmtMM(result.cop_leg_pv), 'VP flujos de interes pata IBR'],
                  ['PV Principal USD', fmtMM(result.usd_principal_pv), 'VP amortizaciones de capital USD'],
                  ['PV Principal COP', fmtMM(result.cop_principal_pv), 'VP amortizaciones de capital COP'],
                  ['', '', ''],
                  ['Nocional USD', fmt(result.notional_usd, 0), 'Monto inicial en dolares'],
                  ['Nocional COP', fmt(result.notional_cop, 0), 'Nocional USD x FX inicial'],
                  ['FX Inicial', fmt(result.fx_initial, 2), 'Tasa de cambio de pactacion'],
                  ['FX Spot', fmt(result.fx_spot, 2), 'Tasa de cambio actual del mercado'],
                  ['Spread USD', `${result.usd_spread_bps} bps`, 'Xccy basis sobre SOFR'],
                  ['Spread COP', `${result.cop_spread_bps} bps`, 'Spread adicional sobre IBR'],
                  ['Amortizacion', result.amortization_type, 'Tipo de repago del principal'],
                  ['Frecuencia', result.payment_frequency, 'Periodicidad de pagos'],
                  ['Periodos', String(result.n_periods), 'Numero total de flujos'],
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
    if (!result || !result.cashflows || result.cashflows.length === 0) {
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
          Primero valore un CCS en la pestana Pricing
        </div>
      );
    }

    const cfs = result.cashflows;

    // Chart data for net cashflows
    const chartData = cfs.map((cf) => ({
      period: cf.period,
      label: cf.end,
      net_cop: cf.net_cop,
      usd_interest: cf.usd_interest,
      cop_interest: cf.cop_interest,
    }));

    return (
      <>
        {/* Net Cashflow Chart */}
        <Row className="mb-3">
          <Col>
            <div style={{ background: '#fff', borderRadius: 8, padding: 16, border: '1px solid #dee2e6' }}>
              <h6 style={{ marginBottom: 12 }}>Flujos Netos Non-Delivery (COP)</h6>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
                  <YAxis tickFormatter={(v: number) => fmtMM(v)} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(v: number, name: string) => [fmtMM(v), name]}
                    labelFormatter={(l: string) => `Pago: ${l}`}
                  />
                  <ReferenceLine y={0} stroke="#666" />
                  <Bar
                    dataKey="net_cop"
                    name="Neto COP"
                    fill="#6c757d"
                    radius={[4, 4, 0, 0]}
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
              <h6 style={{ marginBottom: 12 }}>Detalle de Flujos</h6>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #dee2e6', background: '#f8f9fa' }}>
                    {['#', 'Inicio', 'Fin', 'Rem %', 'Noc USD', 'Noc COP', 'Tasa USD', 'Tasa COP', 'Int USD', 'Int COP', 'Princ USD', 'Princ COP', 'DF USD', 'DF COP', 'Neto COP'].map((h) => (
                      <th key={h} style={{ padding: '6px 8px', textAlign: h === '#' || h === 'Inicio' || h === 'Fin' ? 'left' : 'right', whiteSpace: 'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cfs.map((cf) => (
                    <tr key={cf.period} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '4px 8px', fontWeight: 600 }}>{cf.period}</td>
                      <td style={{ padding: '4px 8px', fontSize: 11 }}>{cf.start}</td>
                      <td style={{ padding: '4px 8px', fontSize: 11 }}>{cf.end}</td>
                      <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{cf.remaining_pct}%</td>
                      <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{fmt(cf.notional_usd, 0)}</td>
                      <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{fmtMM(cf.notional_cop)}</td>
                      <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{cf.usd_rate.toFixed(2)}%</td>
                      <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{cf.cop_rate.toFixed(2)}%</td>
                      <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{fmt(cf.usd_interest, 0)}</td>
                      <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{fmtMM(cf.cop_interest)}</td>
                      <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{fmt(cf.usd_principal, 0)}</td>
                      <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{fmtMM(cf.cop_principal)}</td>
                      <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{cf.usd_df.toFixed(4)}</td>
                      <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{cf.cop_df.toFixed(4)}</td>
                      <td
                        style={{
                          padding: '4px 8px',
                          textAlign: 'right',
                          fontFamily: 'monospace',
                          fontWeight: 600,
                          color: cf.net_cop >= 0 ? '#28a745' : '#dc3545',
                        }}
                      >
                        {fmtMM(cf.net_cop)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
