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
      };
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
  }, [notional, fixedRate, tenorYears, payFixed, spread, useMaturity, maturityDate]);

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
                      const today = new Date().toISOString().slice(0, 10);
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
                        payment_frequency: '3M',
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

              <table style={{ width: '100%', fontSize: 14, borderCollapse: 'collapse' }}>
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
                      <td
                        style={{
                          padding: '8px 12px',
                          fontWeight: 600,
                          color: '#555',
                          width: '45%',
                        }}
                      >
                        {label}
                      </td>
                      <td
                        style={{
                          padding: '8px 12px',
                          textAlign: 'right',
                          fontFamily: 'monospace',
                          fontSize: 14,
                        }}
                      >
                        {value}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
