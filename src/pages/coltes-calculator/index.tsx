'use client';

import { CoreLayout } from '@layout';
import { Row, Col, Form } from 'react-bootstrap';
import React, { useState, useCallback, useEffect } from 'react';
import Container from 'react-bootstrap/Container';
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import {
  faCalculator,
  faTable,
  faLineChart,
  faPlay,
  faSyncAlt,
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
  priceTesBond,
  getTesCatalog,
  getTesYieldCurve,
  type TesBondRequest,
} from 'src/models/pricing/pricingApi';
import type {
  TesBondResult,
  TesBondCashflow,
  TesCatalogItem,
  TesYieldCurvePoint,
} from 'src/types/pricing';

const PAGE_TITLE = 'COLTES Calculator';

const TAB_ITEMS: TabItemType[] = [
  { name: 'Pricing', property: 'pricing', icon: faCalculator, active: true },
  { name: 'Cashflows', property: 'cashflows', icon: faTable, active: false },
  { name: 'Yield Curve', property: 'yieldcurve', icon: faLineChart, active: false },
];

const MOCK_CATALOG: TesCatalogItem[] = [
  { name: 'COLTES 2025', issue_date: '2014-07-24', maturity_date: '2025-07-24', coupon_rate: 7.00 },
  { name: 'COLTES 2026', issue_date: '2016-07-24', maturity_date: '2026-07-24', coupon_rate: 7.25 },
  { name: 'COLTES 2028', issue_date: '2018-07-24', maturity_date: '2028-07-24', coupon_rate: 7.50 },
  { name: 'COLTES 2030', issue_date: '2019-07-24', maturity_date: '2030-07-24', coupon_rate: 7.75 },
  { name: 'COLTES 2032', issue_date: '2021-07-24', maturity_date: '2032-07-24', coupon_rate: 8.00 },
  { name: 'COLTES 2033', issue_date: '2018-07-24', maturity_date: '2033-07-24', coupon_rate: 6.00 },
  { name: 'COLTES 2050', issue_date: '2020-07-24', maturity_date: '2050-07-24', coupon_rate: 7.25 },
];

const MOCK_YIELD_CURVE: TesYieldCurvePoint[] = [
  { tenor: '6M', tenor_years: 0.5, ytm: 10.50 },
  { tenor: '1Y', tenor_years: 1.0, ytm: 10.25 },
  { tenor: '2Y', tenor_years: 2.0, ytm: 10.00 },
  { tenor: '3Y', tenor_years: 3.0, ytm: 9.85 },
  { tenor: '5Y', tenor_years: 5.0, ytm: 9.75 },
  { tenor: '7Y', tenor_years: 7.0, ytm: 9.85 },
  { tenor: '10Y', tenor_years: 10.0, ytm: 9.95 },
  { tenor: '15Y', tenor_years: 15.0, ytm: 10.10 },
  { tenor: '20Y', tenor_years: 20.0, ytm: 10.20 },
];

const fmt = (v: number, decimals = 2) =>
  v != null ? v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : '—';

const fmtPct = (v: number, decimals = 4) =>
  v != null ? `${(v * 100).toFixed(decimals)}%` : '—';

const fmtMM = (v: number) => {
  if (Math.abs(v) >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (Math.abs(v) >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return fmt(v, 2);
};

// Fallback local: TES colombianos pagan cupón ANUAL (ACT/365.25)
// Solo se usa si el backend no retorna cashflows
function generateCashflowsFallback(
  maturityDate: string,
  couponRatePct: number,
  faceValue: number,
  ytmDecimal: number,
): TesBondCashflow[] {
  const mat = new Date(`${maturityDate}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Cupón ANUAL — retroceder de un año en un año desde el vencimiento
  const paymentDates: Date[] = [];
  const d = new Date(mat);
  while (d > today) {
    paymentDates.unshift(new Date(d));
    d.setFullYear(d.getFullYear() - 1);
  }

  const n = paymentDates.length;

  return paymentDates.map((payDate, i) => {
    const isLast = i === n - 1;
    const days = Math.round((payDate.getTime() - today.getTime()) / 86400000);
    const yf = days / 365.25;                            // ACT/365.25
    const coupon = faceValue * (couponRatePct / 100);    // cupón anual
    const principal = isLast ? faceValue : 0;
    const cashflow = coupon + principal;
    const discountFactor = ytmDecimal > 0
      ? 1 / (1 + ytmDecimal) ** yf
      : 1;
    const pv = cashflow * discountFactor;
    const dateStr = payDate.toISOString().slice(0, 10);

    return {
      date: dateStr,
      date_str: dateStr,
      period: i + 1,
      coupon: parseFloat(coupon.toFixed(6)),
      principal,
      cashflow: parseFloat(cashflow.toFixed(6)),
      discount_factor: parseFloat(discountFactor.toFixed(8)),
      pv: parseFloat(pv.toFixed(6)),
      accrual_start: '',
      accrual_end: dateStr,
      accrual_days: 365,
      year_fraction: parseFloat(yf.toFixed(8)),
    };
  });
}

function ColTesCalculator() {
  const [activeTab, setActiveTab] = useState('pricing');
  const [pageTabs, setPageTabs] = useState<TabItemType[]>(TAB_ITEMS);
  const [loading, setLoading] = useState(false);

  // Catalog
  const [catalog, setCatalog] = useState<TesCatalogItem[]>([]);
  const [catalogMode, setCatalogMode] = useState(true);
  const [selectedBond, setSelectedBond] = useState<string>('');

  // Manual params
  const [issueDate, setIssueDate] = useState('');
  const [maturityDate, setMaturityDate] = useState('');
  const [couponRate, setCouponRate] = useState(7.5);
  const [faceValue, setFaceValue] = useState(100);

  // Input mode: price or yield
  const [inputMode, setInputMode] = useState<'price' | 'yield'>('price');
  const [cleanPrice, setCleanPrice] = useState(95.0);
  const [yieldInput, setYieldInput] = useState(9.5);

  // Operational fields (collapsible)
  const [showOperational, setShowOperational] = useState(false);
  const [idOperacion, setIdOperacion] = useState('');
  const [tradeDate, setTradeDate] = useState('');
  const [sociedad, setSociedad] = useState('');
  const [idBanco, setIdBanco] = useState('');
  const [settlementDate, setSettlementDate] = useState('');
  const [estado, setEstado] = useState('Activo');
  const [docSap, setDocSap] = useState('');

  // Results
  const [result, setResult] = useState<TesBondResult | null>(null);
  const [cashflows, setCashflows] = useState<TesBondCashflow[]>([]);
  const [yieldCurve, setYieldCurve] = useState<TesYieldCurvePoint[]>([]);

  // Load catalog on mount
  useEffect(() => {
    getTesCatalog()
      .then((data) => setCatalog(data?.length ? data : MOCK_CATALOG))
      .catch(() => setCatalog(MOCK_CATALOG));
  }, []);

  // When a bond is selected from catalog, prefill params
  useEffect(() => {
    if (!catalogMode || !selectedBond) return;
    const bond = catalog.find((b) => b.name === selectedBond);
    if (bond) {
      setIssueDate(bond.issue_date);
      setMaturityDate(bond.maturity_date);
      setCouponRate(bond.coupon_rate);
      setFaceValue(100); // TES colombianos: valor nominal siempre 100
    }
  }, [selectedBond, catalog, catalogMode]);

  const handleTabChange = (tabProp: string) => {
    setActiveTab(tabProp);
    setPageTabs((prev) =>
      prev.map((tab) => ({ ...tab, active: tab.property === tabProp }))
    );
  };

  const handleCalculate = useCallback(async () => {
    if (!issueDate || !maturityDate) {
      toast.warn('Ingrese fecha de emisión y vencimiento');
      return;
    }
    setLoading(true);
    try {
      const params: TesBondRequest = {
        issue_date: issueDate,
        maturity_date: maturityDate,
        coupon_rate: couponRate / 100,
        face_value: faceValue,
      };
      if (inputMode === 'price') {
        params.market_clean_price = cleanPrice;
      } else {
        params.market_ytm = yieldInput / 100;
      }

      const res = await priceTesBond(params);
      setResult(res);

      // Usar cashflows del backend (QuantLib, cupón anual ACT/365.25)
      // Si no vienen (curva TES no construida), usar fallback local
      const flows = generateCashflowsFallback(maturityDate, couponRate, faceValue, res.ytm);
      setCashflows(res.cashflows ?? flows);

      toast.success('Bono valorado correctamente');
    } catch (e) {
      toast.error(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  }, [issueDate, maturityDate, couponRate, faceValue, inputMode, cleanPrice, yieldInput]);

  const handleLoadYieldCurve = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getTesYieldCurve();
      setYieldCurve(data?.length ? data : MOCK_YIELD_CURVE);
    } catch (e) {
      console.error('TES yield curve API unavailable, using reference data', e);
      setYieldCurve(MOCK_YIELD_CURVE);
      toast.info('Usando datos de curva de referencia (API no disponible)');
    } finally {
      setLoading(false);
    }
  }, []);

  const renderPricingTab = () => (
    <Row>
      {/* Left: Form */}
      <Col md={5}>
        <div
          style={{
            background: '#fff',
            border: '1px solid #dee2e6',
            borderRadius: 8,
            padding: 20,
          }}
        >
          <h6 style={{ marginBottom: 16 }}>Parámetros del Bono</h6>

          {/* Catalog / Manual toggle */}
          <Form.Group className="mb-3">
            <div className="d-flex gap-3">
              <Form.Check
                type="radio"
                id="mode-catalog"
                label="Bono del Catálogo"
                checked={catalogMode}
                onChange={() => setCatalogMode(true)}
              />
              <Form.Check
                type="radio"
                id="mode-manual"
                label="Parámetros Manuales"
                checked={!catalogMode}
                onChange={() => setCatalogMode(false)}
              />
            </div>
          </Form.Group>

          {catalogMode ? (
            <Form.Group className="mb-3">
              <Form.Label style={{ fontSize: 13 }}>COLTES</Form.Label>
              <Form.Select
                value={selectedBond}
                onChange={(e) => setSelectedBond(e.target.value)}
              >
                <option value="">— Seleccionar bono —</option>
                {catalog.map((b) => (
                  <option key={b.name} value={b.name}>
                    {b.name} — {b.coupon_rate.toFixed(2)}% — Vence {b.maturity_date}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
          ) : null}

          <Row>
            <Col>
              <Form.Group className="mb-3">
                <Form.Label style={{ fontSize: 13 }}>Fecha Emisión</Form.Label>
                <Form.Control
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  readOnly={catalogMode && !!selectedBond}
                />
              </Form.Group>
            </Col>
            <Col>
              <Form.Group className="mb-3">
                <Form.Label style={{ fontSize: 13 }}>Fecha Vencimiento</Form.Label>
                <Form.Control
                  type="date"
                  value={maturityDate}
                  onChange={(e) => setMaturityDate(e.target.value)}
                  readOnly={catalogMode && !!selectedBond}
                />
              </Form.Group>
            </Col>
          </Row>

          <Row>
            <Col>
              <Form.Group className="mb-3">
                <Form.Label style={{ fontSize: 13 }}>Cupón (%)</Form.Label>
                <Form.Control
                  type="number"
                  step="0.01"
                  value={couponRate}
                  onChange={(e) => setCouponRate(parseFloat(e.target.value) || 0)}
                  readOnly={catalogMode && !!selectedBond}
                />
              </Form.Group>
            </Col>
            <Col>
              <Form.Group className="mb-3">
                <Form.Label style={{ fontSize: 13 }}>Valor Nominal</Form.Label>
                <Form.Control
                  type="number"
                  step="1"
                  value={faceValue}
                  onChange={(e) => setFaceValue(parseFloat(e.target.value) || 100)}
                />
                <Form.Text className="text-muted" style={{ fontSize: 11 }}>
                  Base 100
                </Form.Text>
              </Form.Group>
            </Col>
          </Row>

          {/* Input mode */}
          <Form.Group className="mb-3">
            <Form.Label style={{ fontSize: 13 }}>Ingresar por</Form.Label>
            <div className="d-flex gap-3">
              <Form.Check
                type="radio"
                id="input-price"
                label="Precio Limpio"
                checked={inputMode === 'price'}
                onChange={() => setInputMode('price')}
              />
              <Form.Check
                type="radio"
                id="input-yield"
                label="Yield (TIR %)"
                checked={inputMode === 'yield'}
                onChange={() => setInputMode('yield')}
              />
            </div>
          </Form.Group>

          {inputMode === 'price' ? (
            <Form.Group className="mb-3">
              <Form.Label style={{ fontSize: 13 }}>Precio Limpio</Form.Label>
              <Form.Control
                type="number"
                step="0.001"
                value={cleanPrice}
                onChange={(e) => setCleanPrice(parseFloat(e.target.value) || 0)}
              />
              <Form.Text className="text-muted" style={{ fontSize: 11 }}>
                Ej: 95.25 (% del valor nominal)
              </Form.Text>
            </Form.Group>
          ) : (
            <Form.Group className="mb-3">
              <Form.Label style={{ fontSize: 13 }}>Yield / TIR (%)</Form.Label>
              <Form.Control
                type="number"
                step="0.01"
                value={yieldInput}
                onChange={(e) => setYieldInput(parseFloat(e.target.value) || 0)}
              />
              <Form.Text className="text-muted" style={{ fontSize: 11 }}>
                Tasa interna de retorno anual
              </Form.Text>
            </Form.Group>
          )}

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
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') setShowOperational(!showOperational);
              }}
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
                      <Form.Control
                        size="sm"
                        value={idOperacion}
                        onChange={(e) => setIdOperacion(e.target.value)}
                        placeholder="Ej: COLTES-01"
                      />
                    </Form.Group>
                  </Col>
                  <Col>
                    <Form.Group className="mb-2">
                      <Form.Label style={{ fontSize: 12 }}>Fecha Celebración</Form.Label>
                      <Form.Control
                        size="sm"
                        type="date"
                        value={tradeDate}
                        onChange={(e) => setTradeDate(e.target.value)}
                      />
                    </Form.Group>
                  </Col>
                </Row>
                <Row>
                  <Col>
                    <Form.Group className="mb-2">
                      <Form.Label style={{ fontSize: 12 }}>Sociedad</Form.Label>
                      <Form.Control
                        size="sm"
                        value={sociedad}
                        onChange={(e) => setSociedad(e.target.value)}
                        placeholder="Ej: BP01"
                      />
                    </Form.Group>
                  </Col>
                  <Col>
                    <Form.Group className="mb-2">
                      <Form.Label style={{ fontSize: 12 }}>ID Banco</Form.Label>
                      <Form.Control
                        size="sm"
                        value={idBanco}
                        onChange={(e) => setIdBanco(e.target.value)}
                      />
                    </Form.Group>
                  </Col>
                </Row>
                <Row>
                  <Col>
                    <Form.Group className="mb-2">
                      <Form.Label style={{ fontSize: 12 }}>Fecha Cumplimiento</Form.Label>
                      <Form.Control
                        size="sm"
                        type="date"
                        value={settlementDate}
                        onChange={(e) => setSettlementDate(e.target.value)}
                      />
                    </Form.Group>
                  </Col>
                  <Col>
                    <Form.Group className="mb-2">
                      <Form.Label style={{ fontSize: 12 }}>Estado</Form.Label>
                      <Form.Select
                        size="sm"
                        value={estado}
                        onChange={(e) => setEstado(e.target.value)}
                      >
                        <option value="Activo">Activo</option>
                        <option value="Vencido">Vencido</option>
                        <option value="Cancelado">Cancelado</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                </Row>
                <Form.Group className="mb-2">
                  <Form.Label style={{ fontSize: 12 }}>Doc. SAP</Form.Label>
                  <Form.Control
                    size="sm"
                    value={docSap}
                    onChange={(e) => setDocSap(e.target.value)}
                  />
                </Form.Group>
              </div>
            )}
          </div>

          <Button
            variant="primary"
            onClick={handleCalculate}
            disabled={loading}
            style={{ width: '100%' }}
          >
            <Icon icon={faPlay} className="me-1" />
            Calcular
          </Button>
        </div>
      </Col>

      {/* Right: Results */}
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
            <h6 style={{ marginBottom: 16 }}>Resultados</h6>

            {/* Clean Price highlight */}
            <div
              style={{
                background: '#e3f2fd',
                borderRadius: 8,
                padding: '16px 20px',
                marginBottom: 16,
                display: 'flex',
                justifyContent: 'space-around',
                alignItems: 'center',
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: '#666' }}>Precio Limpio</div>
                <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'monospace', color: '#1565c0' }}>
                  {fmt(result.clean_price, 4)}
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: '#666' }}>Precio Sucio</div>
                <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'monospace', color: '#1565c0' }}>
                  {fmt(result.dirty_price, 4)}
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: '#666' }}>YTM</div>
                <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'monospace', color: '#1565c0' }}>
                  {fmtPct(result.ytm, 4)}
                </div>
              </div>
            </div>

            {/* Analytics metrics table */}
            <table style={{ width: '100%', fontSize: 14, borderCollapse: 'collapse', marginBottom: 20 }}>
              <tbody>
                {[
                  ['Interés Corrido', fmt(result.accrued_interest, 6)],
                  ['NPV', fmtMM(result.npv)],
                  ['Duration Macaulay', `${fmt(result.macaulay_duration, 4)} años`],
                  ['Duration Modificada', fmt(result.modified_duration, 4)],
                  ['Convexidad', fmt(result.convexity, 4)],
                  ['DV01', fmt(result.dv01, 6)],
                  ['BPV', fmt(result.bpv, 6)],
                  ['Valor Nominal', fmt(result.face_value, 2)],
                  ['Cupón', fmtPct(result.coupon_rate, 2)],
                  ['Vencimiento', result.maturity],
                ].map(([label, value]) => (
                  <tr key={label as string} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '7px 12px', fontWeight: 600, color: '#555', width: '45%' }}>
                      {label}
                    </td>
                    <td style={{ padding: '7px 12px', textAlign: 'right', fontFamily: 'monospace', fontSize: 14 }}>
                      {value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Carry / Roll-down — datos del backend (pysdk TesBondPricer.carry_rolldown) */}
            <div
              style={{
                background: '#f9fbe7',
                borderRadius: 8,
                padding: '14px 16px',
                border: '1px solid #e6ee9c',
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10, color: '#558b2f' }}>
                Carry & Roll-down {result.carry ? '(30d)' : '(estimado)'}
              </div>
              <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                <tbody>
                  {result.carry ? (
                    <>
                      <tr>
                        <td style={{ padding: '5px 8px', color: '#555' }}>Carry Cupón (30d)</td>
                        <td style={{ padding: '5px 8px', textAlign: 'right', fontFamily: 'monospace' }}>
                          {fmt(result.carry.coupon_carry, 6)}
                        </td>
                      </tr>
                      <tr>
                        <td style={{ padding: '5px 8px', color: '#555' }}>Roll-down (30d)</td>
                        <td style={{ padding: '5px 8px', textAlign: 'right', fontFamily: 'monospace' }}>
                          {fmt(result.carry.rolldown, 6)}
                        </td>
                      </tr>
                      <tr>
                        <td style={{ padding: '5px 8px', color: '#555' }}>Total Carry (30d)</td>
                        <td style={{ padding: '5px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>
                          {fmt(result.carry.total_carry, 6)}
                        </td>
                      </tr>
                      <tr>
                        <td style={{ padding: '5px 8px', color: '#555' }}>Carry anualizado</td>
                        <td style={{ padding: '5px 8px', textAlign: 'right', fontFamily: 'monospace' }}>
                          {fmt(result.carry.total_carry_bps_annualized, 1)} bps
                        </td>
                      </tr>
                      {result.z_spread_bps != null && (
                        <tr>
                          <td style={{ padding: '5px 8px', color: '#555' }}>Z-Spread</td>
                          <td style={{ padding: '5px 8px', textAlign: 'right', fontFamily: 'monospace' }}>
                            {fmt(result.z_spread_bps, 1)} bps
                          </td>
                        </tr>
                      )}
                    </>
                  ) : (
                    <>
                      <tr>
                        <td style={{ padding: '5px 8px', color: '#555' }}>Carry Diario (accrual)</td>
                        <td style={{ padding: '5px 8px', textAlign: 'right', fontFamily: 'monospace' }}>
                          {fmt((result.coupon_rate * result.face_value) / 365.25, 6)}
                        </td>
                      </tr>
                      <tr>
                        <td style={{ padding: '5px 8px', color: '#555' }}>Carry / YTM spread</td>
                        <td style={{ padding: '5px 8px', textAlign: 'right', fontFamily: 'monospace' }}>
                          {fmt((result.coupon_rate - result.ytm) * 10000, 1)} bps
                        </td>
                      </tr>
                      <tr>
                        <td style={{ padding: '5px 8px', color: '#aaa' }}>Roll-down</td>
                        <td style={{ padding: '5px 8px', textAlign: 'right', fontFamily: 'monospace', color: '#aaa' }}>
                          — (requiere curva TES)
                        </td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div
            style={{
              height: 400,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#999',
              border: '1px dashed #dee2e6',
              borderRadius: 8,
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <Icon icon={faCalculator} size="2x" style={{ opacity: 0.3 }} />
            <span>Seleccione un bono y presione Calcular</span>
          </div>
        )}
      </Col>
    </Row>
  );

  const renderCashflowsTab = () =>
    cashflows.length === 0 ? (
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
          Valorar un bono para ver los flujos de caja
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 8, padding: 16, border: '1px solid #dee2e6' }}>
          <h6 style={{ marginBottom: 12 }}>
            Tabla de Flujos de Caja
            <span style={{ fontSize: 12, color: '#888', marginLeft: 8, fontWeight: 400 }}>
              ({cashflows.length} pagos)
            </span>
          </h6>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #dee2e6', background: '#f8f9fa' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left' }}>#</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left' }}>Fecha Pago</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>Días</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>Cupón</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>Principal</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>Total</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>DF</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>PV</th>
                </tr>
              </thead>
              <tbody>
                {cashflows.map((cf, i) => (
                  <tr
                    key={cf.date}
                    style={{
                      borderBottom: '1px solid #eee',
                      background: cf.principal > 0 ? '#fff8e1' : 'transparent',
                    }}
                  >
                    <td style={{ padding: '6px 12px', color: '#888' }}>{i + 1}</td>
                    <td style={{ padding: '6px 12px', fontFamily: 'monospace' }}>{cf.date_str || cf.date}</td>
                    <td style={{ padding: '6px 12px', textAlign: 'right', fontFamily: 'monospace' }}>
                      {cf.accrual_days || '—'}
                    </td>
                    <td style={{ padding: '6px 12px', textAlign: 'right', fontFamily: 'monospace' }}>
                      {fmt(cf.coupon, 4)}
                    </td>
                    <td style={{ padding: '6px 12px', textAlign: 'right', fontFamily: 'monospace' }}>
                      {cf.principal > 0 ? fmt(cf.principal, 2) : '—'}
                    </td>
                    <td style={{ padding: '6px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: cf.principal > 0 ? 600 : 400 }}>
                      {fmt(cf.cashflow, 4)}
                    </td>
                    <td style={{ padding: '6px 12px', textAlign: 'right', fontFamily: 'monospace', color: '#666' }}>
                      {cf.discount_factor.toFixed(6)}
                    </td>
                    <td style={{ padding: '6px 12px', textAlign: 'right', fontFamily: 'monospace' }}>
                      {fmt(cf.pv, 4)}
                    </td>
                  </tr>
                ))}
                {/* Totals row */}
                <tr style={{ borderTop: '2px solid #dee2e6', fontWeight: 600, background: '#f8f9fa' }}>
                  <td colSpan={3} style={{ padding: '8px 12px' }}>Total</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace' }}>
                    {fmt(cashflows.reduce((s, cf) => s + cf.coupon, 0), 4)}
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace' }}>
                    {fmt(cashflows.reduce((s, cf) => s + cf.principal, 0), 2)}
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace' }}>
                    {fmt(cashflows.reduce((s, cf) => s + cf.cashflow, 0), 4)}
                  </td>
                  <td aria-label="DF" />
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace' }}>
                    {fmt(cashflows.reduce((s, cf) => s + cf.pv, 0), 4)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      );

  const renderYieldCurveTab = () => {
    const chartData = yieldCurve.map((p) => ({
      ...p,
      ytm_pct: typeof p.ytm === 'number' && p.ytm > 1 ? p.ytm : p.ytm * 100,
    }));

    return (
      <>
        <Row className="mb-3">
          <Col>
            <Button
              variant="outline-primary"
              onClick={handleLoadYieldCurve}
              disabled={loading}
            >
              <Icon icon={faSyncAlt} className="me-1" />
              Cargar Curva TES
            </Button>
          </Col>
        </Row>

        {chartData.length > 0 ? (
          <>
            <Row>
              <Col>
                <div style={{ background: '#fff', borderRadius: 8, padding: 16, border: '1px solid #dee2e6' }}>
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="tenor" />
                      <YAxis
                        domain={['auto', 'auto']}
                        tickFormatter={(v: number) => `${v.toFixed(2)}%`}
                      />
                      <Tooltip formatter={(v: number) => `${v.toFixed(4)}%`} />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="ytm_pct"
                        name="Yield TES (%)"
                        stroke="#1565c0"
                        strokeWidth={2}
                        dot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Col>
            </Row>

            <Row className="mt-3">
              <Col>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #dee2e6' }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left' }}>Tenor</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>Años</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>Yield TES</th>
                        {yieldCurve[0]?.maturity_date && (
                          <th style={{ padding: '8px 12px', textAlign: 'right' }}>Vencimiento</th>
                        )}
                        {yieldCurve[0]?.name && (
                          <th style={{ padding: '8px 12px', textAlign: 'left' }}>Bono</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {yieldCurve.map((pt) => (
                        <tr key={pt.tenor} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={{ padding: '6px 12px', fontWeight: 600 }}>{pt.tenor}</td>
                          <td style={{ padding: '6px 12px', textAlign: 'right' }}>
                            {fmt(pt.tenor_years, 1)}
                          </td>
                          <td style={{ padding: '6px 12px', textAlign: 'right', fontFamily: 'monospace' }}>
                            {typeof pt.ytm === 'number' && pt.ytm > 1
                              ? `${pt.ytm.toFixed(4)}%`
                              : fmtPct(pt.ytm, 4)}
                          </td>
                          {pt.maturity_date && (
                            <td style={{ padding: '6px 12px', textAlign: 'right', fontFamily: 'monospace' }}>
                              {pt.maturity_date}
                            </td>
                          )}
                          {pt.name && (
                            <td style={{ padding: '6px 12px' }}>{pt.name}</td>
                          )}
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
                Presione &quot;Cargar Curva TES&quot; para ver las tasas
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
        {activeTab === 'cashflows' && renderCashflowsTab()}
        {activeTab === 'yieldcurve' && renderYieldCurveTab()}
      </Container>
    </CoreLayout>
  );
}

export default ColTesCalculator;
