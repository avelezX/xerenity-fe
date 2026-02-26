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
  priceNdf,
  getNdfImpliedCurve,
  getCurveStatus,
  type NdfRequest,
} from 'src/models/pricing/pricingApi';
import type {
  NdfPricingResult,
  NdfImpliedCurvePoint,
  CurveStatus,
} from 'src/types/pricing';
import { createNdfPosition } from 'src/models/trading';

const PAGE_TITLE = 'NDF Pricer';

const TAB_ITEMS: TabItemType[] = [
  { name: 'Pricing', property: 'pricing', icon: faCalculator, active: true },
  { name: 'Curvas', property: 'curves', icon: faLineChart, active: false },
  { name: 'Curva Implícita', property: 'curve', icon: faLineChart, active: false },
];

const fmt = (v: number, decimals = 2) =>
  v != null ? v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : '—';

const fmtInput = (v: number) =>
  v ? v.toLocaleString('en-US', { maximumFractionDigits: 0 }) : '';

const parseInput = (s: string): number => {
  const cleaned = s.replace(/,/g, '');
  return parseFloat(cleaned) || 0;
};

function NdfPricer() {
  const [activeTab, setActiveTab] = useState('pricing');
  const [pageTabs, setPageTabs] = useState<TabItemType[]>(TAB_ITEMS);
  const [loading, setLoading] = useState(false);
  const [curvesReady, setCurvesReady] = useState(false);
  const [curveStatus, setCurveStatus] = useState<CurveStatus | null>(null);

  // NDF form state
  const [notionalUsd, setNotionalUsd] = useState(1_000_000);
  const [strike, setStrike] = useState(4300);
  const [maturityDate, setMaturityDate] = useState('');
  const [direction, setDirection] = useState<'buy' | 'sell'>('buy');
  const [spotOverride, setSpotOverride] = useState('');

  // Results
  const [result, setResult] = useState<NdfPricingResult | null>(null);
  const [impliedCurve, setImpliedCurve] = useState<NdfImpliedCurvePoint[]>([]);

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

  const spotRequired = curvesReady && curveStatus && !curveStatus.fx_spot;

  const handlePriceNdf = useCallback(async () => {
    if (!maturityDate) {
      toast.warn('Ingrese fecha de vencimiento');
      return;
    }
    if (spotRequired && !spotOverride) {
      toast.warn('Spot no disponible en el servidor. Ingrese un valor de Spot.');
      return;
    }
    setLoading(true);
    try {
      const params: NdfRequest = {
        notional_usd: notionalUsd,
        strike,
        maturity_date: maturityDate,
        direction,
      };
      if (spotOverride) params.spot = parseFloat(spotOverride);
      const res = await priceNdf(params);
      setResult(res);
    } catch (e) {
      toast.error(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  }, [notionalUsd, strike, maturityDate, direction, spotOverride, spotRequired]);

  const handleFetchImpliedCurve = useCallback(async () => {
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
          <span style={{ color: '#dc3545', fontWeight: 600 }}>No disponible (ingrese manualmente)</span>
        )}
        {' | IBR: '}
        <span style={{ color: curveStatus.ibr.built ? '#28a745' : '#dc3545' }}>
          {curveStatus.ibr.built ? 'OK' : 'No'}
        </span>
        {' | SOFR: '}
        <span style={{ color: curveStatus.sofr.built ? '#28a745' : '#dc3545' }}>
          {curveStatus.sofr.built ? 'OK' : 'No'}
        </span>
        {' | NDF: '}
        <span style={{ color: curveStatus.ndf?.built ? '#28a745' : '#dc3545' }}>
          {curveStatus.ndf?.built ? 'OK' : 'No'}
        </span>
      </div>
    );
  };

  const renderPricingTab = () => (
    <>
      {/* NDF Input Form */}
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
            <h6 style={{ marginBottom: 16 }}>Parámetros NDF USD/COP</h6>
            <Form>
              <Form.Group className="mb-3">
                <Form.Label style={{ fontSize: 13 }}>Notional USD</Form.Label>
                <Form.Control
                  type="text"
                  value={fmtInput(notionalUsd)}
                  onChange={(e) => setNotionalUsd(parseInput(e.target.value))}
                  style={{ fontFamily: 'monospace' }}
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label style={{ fontSize: 13 }}>Strike (USD/COP)</Form.Label>
                <Form.Control
                  type="number"
                  step="0.01"
                  value={strike}
                  onChange={(e) => setStrike(parseFloat(e.target.value) || 0)}
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label style={{ fontSize: 13 }}>Fecha Vencimiento</Form.Label>
                <Form.Control
                  type="date"
                  value={maturityDate}
                  onChange={(e) => setMaturityDate(e.target.value)}
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label style={{ fontSize: 13 }}>Dirección</Form.Label>
                <Form.Select
                  value={direction}
                  onChange={(e) => setDirection(e.target.value as 'buy' | 'sell')}
                >
                  <option value="buy">Buy USD (Long)</option>
                  <option value="sell">Sell USD (Short)</option>
                </Form.Select>
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label style={{ fontSize: 13, color: spotRequired ? '#dc3545' : undefined }}>
                  Spot USD/COP {spotRequired ? '(requerido)' : '(opcional)'}
                </Form.Label>
                <Form.Control
                  type="number"
                  step="0.01"
                  placeholder={spotRequired ? 'Ej: 4250.00' : 'Usar spot de mercado'}
                  value={spotOverride}
                  onChange={(e) => setSpotOverride(e.target.value)}
                  style={spotRequired && !spotOverride ? { borderColor: '#dc3545' } : undefined}
                />
              </Form.Group>
              <Button
                variant="primary"
                onClick={handlePriceNdf}
                disabled={loading || !curvesReady}
                style={{ width: '100%' }}
              >
                <Icon icon={faPlay} className="me-1" />
                Valorar NDF
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
                      await createNdfPosition({
                        label: '',
                        counterparty: '',
                        notional_usd: notionalUsd,
                        strike,
                        maturity_date: maturityDate,
                        direction,
                      });
                      toast.success('Posicion NDF guardada al portafolio');
                    } catch (e) {
                      toast.error(`Error: ${e instanceof Error ? e.message : String(e)}`);
                    }
                  }}
                >
                  <Icon icon={faSave} className="me-1" />
                  Guardar al Portafolio
                </Button>
              </div>
              <table style={{ width: '100%', fontSize: 14, borderCollapse: 'collapse' }}>
                <tbody>
                  {[
                    ['NPV (USD)', fmt(result.npv_usd)],
                    ['NPV (COP)', fmt(result.npv_cop, 0)],
                    ['Forward Implícito', fmt(result.forward, 2)],
                    ['Forward Points', fmt(result.forward_points, 2)],
                    ['Strike', fmt(result.strike, 2)],
                    ['DF USD', result.df_usd?.toFixed(6)],
                    ['DF COP', result.df_cop?.toFixed(6)],
                    ['Spot', fmt(result.spot, 2)],
                    ['Dirección', result.direction === 'buy' ? 'Buy USD' : 'Sell USD'],
                    ['Notional USD', fmt(result.notional_usd, 0)],
                    ['Vencimiento', result.maturity],
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
                          color: (() => {
                            if (label !== 'NPV (USD)') return undefined;
                            return result.npv_usd >= 0 ? '#28a745' : '#dc3545';
                          })(),
                          fontWeight: label === 'NPV (USD)' ? 700 : undefined,
                        }}
                      >
                        {value}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Delta */}
              {result.delta_cop != null && (
                <div
                  style={{
                    marginTop: 16,
                    padding: '8px 12px',
                    background: '#f0f7ff',
                    borderRadius: 6,
                    fontSize: 13,
                  }}
                >
                  Delta COP: <strong>{fmt(result.delta_cop, 0)}</strong> COP
                </div>
              )}
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

  const renderCurvesTab = () => {
    if (!curveStatus || (!curveStatus.ibr.built && !curveStatus.sofr.built)) {
      return (
        <Row>
          <Col>
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
              Primero construya las curvas
            </div>
          </Col>
        </Row>
      );
    }

    const ibrNodes = curveStatus.ibr.nodes || {};
    const sofrNodes = curveStatus.sofr.nodes || {};

    // Months mapping for correct sort order and proportional X-axis
    const tenorToMonths: Record<string, number> = {
      '1d': 1 / 30, '1m': 1, '3m': 3, '6m': 6, '9m': 9, '12m': 12,
      '2y': 24, '3y': 36, '5y': 60, '7y': 84, '10y': 120, '15y': 180, '20y': 240,
    };

    const ibrEntries = Object.entries(ibrNodes).sort((a, b) => {
      const aKey = a[0].replace('ibr_', '').toLowerCase();
      const bKey = b[0].replace('ibr_', '').toLowerCase();
      return (tenorToMonths[aKey] ?? 999) - (tenorToMonths[bKey] ?? 999);
    });
    const sofrEntries = Object.entries(sofrNodes).sort((a, b) => Number(a[0]) - Number(b[0]));

    // Chart data with numerical months for proportional spacing
    const ibrChartData = ibrEntries.map(([key, val]) => {
      const tenorKey = key.replace('ibr_', '').toLowerCase();
      return {
        months: tenorToMonths[tenorKey] ?? 0,
        tenor: tenorKey.toUpperCase(),
        rate: val,
      };
    });
    const sofrChartData = sofrEntries.map(([key, val]) => ({
      months: Number(key),
      tenor: Number(key) >= 12 ? `${Number(key) / 12}Y` : `${key}M`,
      rate: val,
    }));

    return (
        <Row>
          {/* IBR Curve */}
          <Col md={6}>
            <div style={{ background: '#fff', border: '1px solid #dee2e6', borderRadius: 8, padding: 16, marginBottom: 16 }}>
              <h6 style={{ marginBottom: 12, color: '#1f77b4' }}>Curva IBR ({ibrEntries.length} nodos)</h6>
              {ibrChartData.length > 0 && (
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={ibrChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      type="number"
                      dataKey="months"
                      ticks={ibrChartData.map((d) => d.months)}
                      tickFormatter={(m: number) => ibrChartData.find((d) => d.months === m)?.tenor || ''}
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis domain={['auto', 'auto']} tickFormatter={(v: number) => `${v.toFixed(1)}%`} tick={{ fontSize: 11 }} />
                    <Tooltip
                      labelFormatter={(m: number) => ibrChartData.find((d) => d.months === m)?.tenor || ''}
                      formatter={(v: number) => `${v.toFixed(4)}%`}
                    />
                    <Line type="monotone" dataKey="rate" stroke="#1f77b4" strokeWidth={2} dot={{ r: 4 }} name="IBR %" />
                  </LineChart>
                </ResponsiveContainer>
              )}
              <div style={{ overflowX: 'auto', maxHeight: 300 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #dee2e6' }}>
                      <th style={{ padding: '6px 10px', textAlign: 'left' }}>Tenor</th>
                      <th style={{ padding: '6px 10px', textAlign: 'right' }}>Tasa (%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ibrEntries.map(([key, val]) => (
                      <tr key={key} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '4px 10px', fontWeight: 600 }}>{key.replace('ibr_', '').toUpperCase()}</td>
                        <td style={{ padding: '4px 10px', textAlign: 'right', fontFamily: 'monospace' }}>{val.toFixed(4)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Col>

          {/* SOFR Curve */}
          <Col md={6}>
            <div style={{ background: '#fff', border: '1px solid #dee2e6', borderRadius: 8, padding: 16, marginBottom: 16 }}>
              <h6 style={{ marginBottom: 12, color: '#ff7f0e' }}>Curva SOFR ({sofrEntries.length} nodos)</h6>
              {sofrChartData.length > 0 && (
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={sofrChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      type="number"
                      dataKey="months"
                      ticks={sofrChartData.map((d) => d.months)}
                      tickFormatter={(m: number) => sofrChartData.find((d) => d.months === m)?.tenor || ''}
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis domain={['auto', 'auto']} tickFormatter={(v: number) => `${v.toFixed(1)}%`} tick={{ fontSize: 11 }} />
                    <Tooltip
                      labelFormatter={(m: number) => sofrChartData.find((d) => d.months === m)?.tenor || ''}
                      formatter={(v: number) => `${v.toFixed(4)}%`}
                    />
                    <Line type="monotone" dataKey="rate" stroke="#ff7f0e" strokeWidth={2} dot={{ r: 4 }} name="SOFR %" />
                  </LineChart>
                </ResponsiveContainer>
              )}
              <div style={{ overflowX: 'auto', maxHeight: 300 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #dee2e6' }}>
                      <th style={{ padding: '6px 10px', textAlign: 'left' }}>Tenor</th>
                      <th style={{ padding: '6px 10px', textAlign: 'right' }}>Tasa (%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sofrEntries.map(([key, val]) => (
                      <tr key={key} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '4px 10px', fontWeight: 600 }}>
                          {Number(key) >= 12 ? `${Number(key) / 12}Y` : `${key}M`}
                        </td>
                        <td style={{ padding: '4px 10px', textAlign: 'right', fontFamily: 'monospace' }}>{val.toFixed(4)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Col>
        </Row>
    );
  };

  const renderCurveTab = () => (
    <>
      <Row className="mb-3">
        <Col>
          <Button
            variant="outline-primary"
            onClick={handleFetchImpliedCurve}
            disabled={loading || !curvesReady}
          >
            <Icon icon={faSyncAlt} className="me-1" />
            Cargar Curva Implícita
          </Button>
        </Col>
      </Row>

      {impliedCurve.length > 0 ? (
        <>
          {/* Chart */}
          <Row>
            <Col>
              <div style={{ background: '#fff', borderRadius: 8, padding: 16, border: '1px solid #dee2e6' }}>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={impliedCurve}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      type="number"
                      dataKey="tenor_months"
                      ticks={impliedCurve.map((d) => d.tenor_months)}
                      tickFormatter={(m: number) => impliedCurve.find((d) => d.tenor_months === m)?.tenor || ''}
                    />
                    <YAxis domain={['auto', 'auto']} tickFormatter={(v: number) => fmt(v, 0)} />
                    <Tooltip
                      labelFormatter={(m: number) => impliedCurve.find((d) => d.tenor_months === m)?.tenor || ''}
                      formatter={(v: number) => fmt(v, 2)}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="forward_market"
                      name="Mercado (FXEmpire)"
                      stroke="#1f77b4"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="forward_irt_parity"
                      name="Implícito (IBR/SOFR)"
                      stroke="#ff7f0e"
                      strokeWidth={2}
                      dot={{ r: 4 }}
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
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>Meses</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right', color: '#1f77b4' }}>
                        Fwd Mercado
                      </th>
                      <th style={{ padding: '8px 12px', textAlign: 'right', color: '#ff7f0e' }}>
                        Fwd Implícito
                      </th>
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>Basis</th>
                    </tr>
                  </thead>
                  <tbody>
                    {impliedCurve.map((pt) => (
                      <tr key={pt.tenor} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '6px 12px', fontWeight: 600 }}>{pt.tenor}</td>
                        <td style={{ padding: '6px 12px', textAlign: 'right' }}>
                          {pt.tenor_months}
                        </td>
                        <td style={{ padding: '6px 12px', textAlign: 'right', color: '#1f77b4' }}>
                          {fmt(pt.forward_market, 2)}
                        </td>
                        <td style={{ padding: '6px 12px', textAlign: 'right', color: '#ff7f0e' }}>
                          {fmt(pt.forward_irt_parity, 2)}
                        </td>
                        <td
                          style={{
                            padding: '6px 12px',
                            textAlign: 'right',
                            color: pt.basis > 0 ? '#28a745' : '#dc3545',
                            fontWeight: 600,
                          }}
                        >
                          {fmt(pt.basis, 2)}
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
                ? 'Presione "Cargar Curva Implícita" para ver la comparación'
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
        {activeTab === 'curves' && renderCurvesTab()}
        {activeTab === 'curve' && renderCurveTab()}
      </Container>
    </CoreLayout>
  );
}

export default NdfPricer;
