'use client';

import { CoreLayout } from '@layout';
import { Row, Col, Form } from 'react-bootstrap';
import React, { useState, useCallback, useEffect } from 'react';
import Container from 'react-bootstrap/Container';
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import {
  faShieldAlt,
  faSyncAlt,
  faTable,
  faChartLine,
  faEdit,
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
import { fetchRiskManagement, fetchRollingVar, fetchBenchmarkFactors } from 'src/models/risk/riskApi';
import type { RiskRow, RiskConfig, RollingVarResponse, BenchmarkFactorsResponse } from 'src/types/risk';

const PAGE_TITLE = 'Gestión de Riesgos';

const TAB_ITEMS: TabItemType[] = [
  { name: 'Resumen', property: 'resumen', icon: faTable, active: true },
  { name: 'Benchmark', property: 'benchmark', icon: faEdit, active: false },
  { name: 'Rolling VaR', property: 'rolling', icon: faChartLine, active: false },
];

const ASSETS = ['MAIZ', 'AZUCAR', 'CACAO', 'USD'];

// Columns that hold USD values (formatted with $ and thousands)
const USD_COLUMNS = new Set([
  'position_super', 'position_gr', 'position_total',
  'var_super', 'var_gr', 'var_total', 'var_portfolio',
  'pnl_super', 'pnl_gr', 'pnl_total',
]);

// Columns auto-calculated as sum in Total row
const SUM_COLUMNS = new Set([
  'position_super', 'position_gr', 'position_total',
  'var_super', 'var_gr', 'var_total', 'var_portfolio',
  'pnl_super', 'pnl_gr', 'pnl_total',
]);

// Columns the user can manually type into (per asset row)
const MANUAL_COLUMNS = new Set(['position_super', 'position_gr', 'weight']);

// P&G GR hardcoded por activo
const HARDCODED_PNL_GR: Record<string, number> = {
  MAIZ: 0,
  AZUCAR: 0,
  CACAO: 0,
  USD: -190000,
};

// Information Ratio hardcoded por activo
const HARDCODED_INFO_RATIO: Record<string, number | null> = {
  MAIZ: null,
  AZUCAR: null,
  CACAO: null,
  USD: 0.37,
};

const BENCHMARK_COLUMNS = [
  { key: 'weight', label: 'Peso', suffix: '%' },
  { key: 'asset', label: 'Activo' },
  { key: 'position_super', label: 'Super USD' },
  { key: 'position_gr', label: 'Portafolio GR' },
  { key: 'position_total', label: 'Total' },
  { key: 'var_super', label: 'VaR Super' },
  { key: 'var_gr', label: 'VaR GR' },
  { key: 'var_total', label: 'VaR Total' },
  { key: 'factor_var_diario', label: 'Factor VaR Diario' },
  { key: 'factor_unit', label: 'Unidad' },
  { key: 'var_portfolio', label: 'Portafolio' },
  { key: 'price_start', label: 'Precio Inicio' },
  { key: 'price_end', label: 'Precio Fin' },
  { key: 'pnl_super', label: 'P&G Super' },
  { key: 'pnl_gr', label: 'P&G GR' },
  { key: 'pnl_total', label: 'P&G Total' },
  { key: 'information_ratio', label: 'Info Ratio' },
];

/** Parse a display string like "$-12,585.456" or "1,234" to a number */
const parseDisplayValue = (s: string): number => {
  const cleaned = s.replace(/[$,\s]/g, '');
  const num = parseFloat(cleaned);
  return Number.isNaN(num) ? 0 : num;
};

/** Format a number as USD with thousands: $1,000,000 or $12,585.46 */
const fmtUsd = (v: number): string => {
  if (v === 0) return '';
  const prefix = v < 0 ? '-$' : '$';
  const abs = Math.abs(v);
  // Use up to 2 decimals, no forced trailing zeros
  return prefix + abs.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
};

const CHART_COLORS: Record<string, string> = {
  MAIZ: '#f59e0b',
  AZUCAR: '#10b981',
  CACAO: '#8b5cf6',
  USD: '#3b82f6',
};

function lastBusinessDay(d: Date): Date {
  const day = d.getDay();
  if (day === 0) d.setDate(d.getDate() - 2);
  else if (day === 6) d.setDate(d.getDate() - 1);
  return d;
}

function defaultDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return lastBusinessDay(d).toISOString().slice(0, 10);
}

const fmt = (v: number | null, decimals = 2): string => {
  if (v == null) return '—';
  return v.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

const pnlClass = (v: number | null): string => {
  if (v == null) return '';
  if (v > 0) return 'text-success';
  if (v < 0) return 'text-danger';
  return '';
};

type BenchmarkRow = Record<string, string>;

function emptyBenchmarkRows(): BenchmarkRow[] {
  return [
    ...ASSETS.map((a) => {
      const row: BenchmarkRow = {};
      BENCHMARK_COLUMNS.forEach((col) => {
        row[col.key] = col.key === 'asset' ? a : '';
      });
      return row;
    }),
    (() => {
      const row: BenchmarkRow = {};
      BENCHMARK_COLUMNS.forEach((col) => {
        row[col.key] = col.key === 'asset' ? 'Total' : '';
      });
      return row;
    })(),
  ];
}

/** Recalculate all derived columns for benchmark rows */
function recalcBenchmark(rows: BenchmarkRow[]): BenchmarkRow[] {
  const next = rows.map((r) => ({ ...r }));
  const assetRows = next.slice(0, ASSETS.length);

  assetRows.forEach((row, i) => {
    const superPos = parseDisplayValue(row.position_super);
    const grPos = parseDisplayValue(row.position_gr);
    const factor = parseFloat(row.factor_var_diario) || 0;
    const pStart = parseFloat(row.price_start) || 0;
    const pEnd = parseFloat(row.price_end) || 0;

    // position_total = super + gr
    const posTotal = superPos + grPos;
    next[i].position_total = posTotal !== 0 ? String(posTotal) : '';

    // var_super = super * factor / 100 (con signo)
    const varSuper = superPos * (factor / 100);
    next[i].var_super = varSuper !== 0 ? String(Math.round(varSuper * 1000) / 1000) : '';

    // var_gr = gr * factor / 100 (con signo)
    const varGr = grPos * (factor / 100);
    next[i].var_gr = varGr !== 0 ? String(Math.round(varGr * 1000) / 1000) : '';

    // var_total = total * factor / 100 (con signo)
    const varTotal = posTotal * (factor / 100);
    next[i].var_total = varTotal !== 0 ? String(Math.round(varTotal * 1000) / 1000) : '';

    // var_portfolio = super * factor / 100 (con signo)
    const varPortfolio = superPos * (factor / 100);
    next[i].var_portfolio = varPortfolio !== 0 ? String(Math.round(varPortfolio * 1000) / 1000) : '';

    // pnl_super: USD divide por price_end, commodities por price_start
    const isUsdAsset = row.asset === 'USD';
    const pnlDivisor = isUsdAsset ? pEnd : pStart;
    const pnlSuper = pnlDivisor !== 0 ? ((pEnd - pStart) * superPos) / pnlDivisor : 0;
    next[i].pnl_super = pnlSuper !== 0 ? String(Math.round(pnlSuper * 1000) / 1000) : '';

    // pnl_gr = hardcoded
    const pnlGr = HARDCODED_PNL_GR[row.asset] ?? 0;
    next[i].pnl_gr = pnlGr !== 0 ? String(pnlGr) : '';

    // pnl_total = pnl_super + pnl_gr
    const pnlTotal = pnlSuper + pnlGr;
    next[i].pnl_total = pnlTotal !== 0 ? String(Math.round(pnlTotal * 1000) / 1000) : '';

    // information_ratio = hardcoded
    const infoRatio = HARDCODED_INFO_RATIO[row.asset];
    next[i].information_ratio = infoRatio != null ? String(infoRatio) : '';
  });

  // Total row = sum of each column
  const totalIdx = next.length - 1;
  SUM_COLUMNS.forEach((col) => {
    let sum = 0;
    assetRows.forEach((_, i) => {
      sum += parseDisplayValue(next[i][col]);
    });
    next[totalIdx][col] = sum !== 0 ? String(Math.round(sum * 1000) / 1000) : '';
  });

  // Total info ratio: no se totaliza por el momento
  next[totalIdx].information_ratio = '';

  return next;
}

function RiskManagement() {
  const [activeTab, setActiveTab] = useState('resumen');
  const [pageTabs, setPageTabs] = useState<TabItemType[]>(TAB_ITEMS);
  const [filterDate, setFilterDate] = useState(defaultDate());
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<RiskRow[]>([]);
  const [config, setConfig] = useState<RiskConfig | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Benchmark state
  const [benchmarkRows, setBenchmarkRows] = useState<BenchmarkRow[]>(emptyBenchmarkRows());
  const [benchmarkFactors, setBenchmarkFactors] = useState<BenchmarkFactorsResponse | null>(null);
  const [benchmarkLoading, setBenchmarkLoading] = useState(false);

  // Rolling VaR state
  const [rollingData, setRollingData] = useState<RollingVarResponse | null>(null);
  const [rollingLoading, setRollingLoading] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState('MAIZ');

  const handleTabChange = (tabProp: string) => {
    setActiveTab(tabProp);
    setPageTabs((prev) =>
      prev.map((tab) => ({ ...tab, active: tab.property === tabProp }))
    );
  };

  const handleCalculate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchRiskManagement(filterDate);
      setRows(data.risk_table);
      setConfig(data.config);
      toast.success('Cálculo completado');
    } catch (e: unknown) {
      const msg = (e as Error)?.message || 'Error calculando riesgos';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [filterDate]);

  const handleFetchRolling = useCallback(async () => {
    setRollingLoading(true);
    try {
      const data = await fetchRollingVar(filterDate);
      setRollingData(data);
    } catch (e: unknown) {
      toast.error((e as Error)?.message || 'Error obteniendo rolling VaR');
    } finally {
      setRollingLoading(false);
    }
  }, [filterDate]);

  const handleFetchBenchmarkFactors = useCallback(async () => {
    setBenchmarkLoading(true);
    try {
      const data = await fetchBenchmarkFactors(filterDate);
      setBenchmarkFactors(data);

      // Pre-fill factor_var_diario, prices, factor_unit into benchmark rows
      setBenchmarkRows((prev) => {
        const next = prev.map((r) => ({ ...r }));
        ASSETS.forEach((asset, i) => {
          const f = data.factors[asset];
          if (f) {
            next[i].factor_var_diario = f.factor_var_diario != null ? String(f.factor_var_diario) : '';
            next[i].factor_unit = f.factor_unit || '';
            next[i].price_start = f.price_start != null ? String(f.price_start) : '';
            next[i].price_end = f.price_end != null ? String(f.price_end) : '';
          }
        });
        return recalcBenchmark(next);
      });

      toast.success(`Factores cargados (${data.period.start} → ${data.period.end})`);
    } catch (e: unknown) {
      toast.error((e as Error)?.message || 'Error obteniendo factores');
    } finally {
      setBenchmarkLoading(false);
    }
  }, [filterDate]);

  useEffect(() => {
    handleCalculate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeTab === 'rolling' && !rollingData) {
      handleFetchRolling();
    }
    if (activeTab === 'benchmark' && !benchmarkFactors) {
      handleFetchBenchmarkFactors();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const handleBenchmarkChange = (rowIdx: number, colKey: string, rawValue: string) => {
    setBenchmarkRows((prev) => {
      const next = prev.map((r) => ({ ...r }));
      next[rowIdx][colKey] = rawValue.replace(/[$,]/g, '');
      return recalcBenchmark(next);
    });
  };

  // Build chart data for rolling var
  const buildChartData = (asset: string, field: 'prices' | 'rolling_var') => {
    if (!rollingData) return [];
    const values = rollingData[field][asset];
    if (!values) return [];
    return rollingData.dates.map((date, i) => ({
      date,
      value: values[i],
    })).filter((d) => d.value != null);
  };

  return (
    <CoreLayout>
      <Container fluid className="p-4">
        <PageTitle>
          <Icon icon={faShieldAlt} />
          <h4>{PAGE_TITLE}</h4>
        </PageTitle>

        {/* Tabs */}
        <Tabs outlined className="mb-3">
          {pageTabs.map((tab) => (
            <Tab
              key={tab.property}
              active={tab.active}
              onClick={() => handleTabChange(tab.property)}
            >
              {tab.icon && <Icon icon={tab.icon} />}
              {tab.name}
            </Tab>
          ))}
        </Tabs>

        {/* ─── RESUMEN TAB ─── */}
        {activeTab === 'resumen' && (
          <>
            <Row className="mb-3 align-items-end">
              <Col xs="auto">
                <Form.Group>
                  <Form.Label className="small text-muted">Fecha filtro</Form.Label>
                  <Form.Control
                    type="date"
                    size="sm"
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                  />
                </Form.Group>
              </Col>
              <Col xs="auto">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleCalculate}
                  disabled={loading}
                >
                  <Icon icon={faSyncAlt} spin={loading} className="me-1" />
                  {loading ? 'Calculando...' : 'Calcular'}
                </Button>
              </Col>
              {config && (
                <Col className="d-flex align-items-center gap-3 small text-muted">
                  <span>
                    Precios: <strong>{config.price_date_start}</strong> → <strong>{config.price_date_end}</strong>
                  </span>
                  <span>Ventana: <strong>{config.rolling_window}d</strong></span>
                  <span>Confianza: <strong>{Math.round(config.confidence_level * 100)}%</strong></span>
                </Col>
              )}
            </Row>

            {error && <div className="alert alert-danger py-2 small">{error}</div>}

            {rows.length > 0 && (
              <div className="table-responsive">
                <table className="table table-sm table-bordered table-hover align-middle" style={{ fontSize: '0.82rem' }}>
                  <thead className="table-dark text-center">
                    <tr>
                      <th rowSpan={2}>Peso</th>
                      <th rowSpan={2}>Activo</th>
                      <th colSpan={3}>Posiciones</th>
                      <th colSpan={3}>VaR Diario</th>
                      <th colSpan={2}>Factor VaR</th>
                      <th rowSpan={2}>VaR Port.</th>
                      <th colSpan={2}>Precios</th>
                      <th colSpan={3}>P&G</th>
                      <th rowSpan={2}>Info Ratio</th>
                    </tr>
                    <tr>
                      <th>Super</th><th>GR</th><th>Total</th>
                      <th>Super</th><th>GR</th><th>Total</th>
                      <th>Diario</th><th>Unidad</th>
                      <th>Inicio</th><th>Fin</th>
                      <th>Super</th><th>GR</th><th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const isTotal = r.asset === 'Total';
                      return (
                        <tr
                          key={r.asset}
                          className={isTotal ? 'fw-bold table-light' : ''}
                          style={isTotal ? { borderTop: '2px solid #7c3aed' } : {}}
                        >
                          <td className="text-center">
                            {r.weight != null ? `${fmt(r.weight, 0)}%` : '—'}
                          </td>
                          <td style={{ color: '#7c3aed', fontWeight: 600 }}>{r.asset}</td>
                          <td className="text-end">{fmt(r.position_super, 3)}</td>
                          <td className="text-end">{fmt(r.position_gr, 3)}</td>
                          <td className="text-end fw-bold">{fmt(r.position_total, 3)}</td>
                          <td className="text-end">{fmt(r.var_super, 3)}</td>
                          <td className="text-end">{fmt(r.var_gr, 3)}</td>
                          <td className="text-end fw-bold">{fmt(r.var_total, 3)}</td>
                          <td className="text-end">
                            {r.factor_var_diario != null ? `${fmt(r.factor_var_diario)}%` : '—'}
                          </td>
                          <td className="text-center">{r.factor_unit ?? '—'}</td>
                          <td className="text-end">{fmt(r.var_portfolio, 3)}</td>
                          <td className="text-end">{fmt(r.price_start, 4)}</td>
                          <td className="text-end">{fmt(r.price_end, 4)}</td>
                          <td className={`text-end ${pnlClass(r.pnl_super)}`}>{fmt(r.pnl_super, 3)}</td>
                          <td className={`text-end ${pnlClass(r.pnl_gr)}`}>{fmt(r.pnl_gr, 3)}</td>
                          <td className={`text-end fw-bold ${pnlClass(r.pnl_total)}`}>{fmt(r.pnl_total, 3)}</td>
                          <td className="text-end">{fmt(r.information_ratio)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {!loading && rows.length === 0 && !error && (
              <p className="text-muted">No hay datos. Haz clic en Calcular.</p>
            )}
          </>
        )}

        {/* ─── BENCHMARK TAB ─── */}
        {activeTab === 'benchmark' && (
          <>
            <Row className="mb-3 align-items-end">
              <Col xs="auto">
                <Form.Group>
                  <Form.Label className="small text-muted">Fecha filtro</Form.Label>
                  <Form.Control
                    type="date"
                    size="sm"
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                  />
                </Form.Group>
              </Col>
              <Col xs="auto">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleFetchBenchmarkFactors}
                  disabled={benchmarkLoading}
                >
                  <Icon icon={faSyncAlt} spin={benchmarkLoading} className="me-1" />
                  {benchmarkLoading ? 'Cargando...' : 'Cargar Factores'}
                </Button>
              </Col>
              {benchmarkFactors && (
                <Col className="d-flex align-items-center gap-2 small text-muted">
                  <span>
                    Periodo: <strong>{benchmarkFactors.period.start}</strong> → <strong>{benchmarkFactors.period.end}</strong>
                  </span>
                </Col>
              )}
            </Row>

            <p className="small text-muted mb-3">
              Ingresa <strong>Super USD</strong> y <strong>Portafolio GR</strong> manualmente. Los demás campos se calculan automáticamente.
            </p>

            {benchmarkLoading && <p className="text-muted">Cargando factores...</p>}

            <div className="table-responsive">
              <table className="table table-sm table-bordered align-middle" style={{ fontSize: '0.82rem' }}>
                <thead className="table-dark text-center">
                  <tr>
                    <th>Peso</th>
                    <th>Activo</th>
                    <th colSpan={3}>Posiciones</th>
                    <th colSpan={3}>VaR Diario</th>
                    <th colSpan={2}>Factor VaR</th>
                    <th>Portafolio</th>
                    <th colSpan={2}>Precios</th>
                    <th colSpan={3}>P&G</th>
                    <th>Info Ratio</th>
                  </tr>
                  <tr>
                    <th aria-label="Activo" />
                    <th aria-label="Exposición" />
                    <th>Super USD</th><th>Portafolio GR</th><th>Total</th>
                    <th>VaR Super</th><th>VaR GR</th><th>VaR Total</th>
                    <th>Diario %</th><th>Unidad</th>
                    <th aria-label="Portafolio" />
                    <th>Inicio</th><th>Fin</th>
                    <th>P&G Super</th><th>P&G GR</th><th>Total</th>
                    <th aria-label="Info Ratio valor" />
                  </tr>
                </thead>
                <tbody>
                  {benchmarkRows.map((row, rowIdx) => {
                    const isTotal = row.asset === 'Total';
                    return (
                      <tr
                        key={row.asset}
                        className={isTotal ? 'fw-bold table-light' : ''}
                        style={isTotal ? { borderTop: '2px solid #7c3aed' } : {}}
                      >
                        {BENCHMARK_COLUMNS.map((col) => {
                          const isManual = MANUAL_COLUMNS.has(col.key) && !isTotal;
                          const isUsd = USD_COLUMNS.has(col.key);
                          const rawNum = parseDisplayValue(row[col.key]);

                          if (col.key === 'asset') {
                            return (
                              <td key={col.key} style={{ color: '#7c3aed', fontWeight: 600 }}>
                                {row.asset}
                              </td>
                            );
                          }

                          // Manual editable cells (position_super, position_gr, weight)
                          if (isManual) {
                            return (
                              <td key={col.key} className="p-0" style={{ background: '#fffbeb' }}>
                                <Form.Control
                                  type="text"
                                  size="sm"
                                  className="border-0 text-end"
                                  style={{ fontSize: '0.82rem', background: 'transparent' }}
                                  placeholder="—"
                                  value={row[col.key]}
                                  onChange={(e) =>
                                    handleBenchmarkChange(rowIdx, col.key, e.target.value)
                                  }
                                  onBlur={() => {
                                    if (isUsd && row[col.key]) {
                                      const num = parseDisplayValue(row[col.key]);
                                      if (num !== 0) {
                                        setBenchmarkRows((prev) => {
                                          const updated = prev.map((r) => ({ ...r }));
                                          updated[rowIdx][col.key] = fmtUsd(num);
                                          return updated;
                                        });
                                      }
                                    }
                                  }}
                                  onFocus={() => {
                                    if (isUsd && row[col.key]) {
                                      const num = parseDisplayValue(row[col.key]);
                                      setBenchmarkRows((prev) => {
                                        const updated = prev.map((r) => ({ ...r }));
                                        updated[rowIdx][col.key] = num !== 0 ? String(num) : '';
                                        return updated;
                                      });
                                    }
                                  }}
                                />
                              </td>
                            );
                          }

                          // Read-only cells (all computed + factor/prices from backend)
                          let displayVal = row[col.key] || '—';
                          if (isUsd && rawNum !== 0) {
                            displayVal = fmtUsd(rawNum);
                          } else if (col.key === 'factor_var_diario' && row[col.key]) {
                            displayVal = `${parseFloat(row[col.key]).toFixed(2)}%`;
                          }

                          return (
                            <td key={col.key} className={`text-end ${isTotal ? '' : 'text-muted'}`}>
                              {displayVal}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ─── ROLLING VAR TAB ─── */}
        {activeTab === 'rolling' && (
          <>
            <Row className="mb-3 align-items-end">
              <Col xs="auto">
                <Form.Group>
                  <Form.Label className="small text-muted">Activo</Form.Label>
                  <Form.Select
                    size="sm"
                    value={selectedAsset}
                    onChange={(e) => setSelectedAsset(e.target.value)}
                  >
                    {ASSETS.map((a) => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                    <option value="TODOS">Todos</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col xs="auto">
                <Form.Group>
                  <Form.Label className="small text-muted">Fecha filtro</Form.Label>
                  <Form.Control
                    type="date"
                    size="sm"
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                  />
                </Form.Group>
              </Col>
              <Col xs="auto">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleFetchRolling}
                  disabled={rollingLoading}
                >
                  <Icon icon={faSyncAlt} spin={rollingLoading} className="me-1" />
                  {rollingLoading ? 'Cargando...' : 'Actualizar'}
                </Button>
              </Col>
            </Row>

            {rollingLoading && <p className="text-muted">Cargando datos...</p>}

            {rollingData && !rollingLoading && (
              <>
                {/* Single asset view */}
                {selectedAsset !== 'TODOS' && (
                  <Row className="g-3">
                    <Col md={6}>
                      <div className="bg-white rounded p-3 h-100" style={{ border: '1px solid #e2e8f0' }}>
                        <h6 className="mb-3" style={{ color: CHART_COLORS[selectedAsset] || '#7c3aed' }}>
                          Precio — {selectedAsset}
                        </h6>
                        <ResponsiveContainer width="100%" height={280}>
                          <LineChart data={buildChartData(selectedAsset, 'prices')}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d: string) => d.slice(5)} />
                            <YAxis tick={{ fontSize: 10 }} domain={['auto', 'auto']} />
                            <Tooltip labelFormatter={(d: string) => d} formatter={(v: number) => [v?.toFixed(4), 'Precio']} />
                            <Line type="monotone" dataKey="value" stroke={CHART_COLORS[selectedAsset] || '#7c3aed'} dot={false} strokeWidth={2} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </Col>
                    <Col md={6}>
                      <div className="bg-white rounded p-3 h-100" style={{ border: '1px solid #e2e8f0' }}>
                        <h6 className="mb-3" style={{ color: '#dc2626' }}>
                          Rolling VaR 180d (USD) — {selectedAsset}
                        </h6>
                        <ResponsiveContainer width="100%" height={280}>
                          <LineChart data={buildChartData(selectedAsset, 'rolling_var')}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d: string) => d.slice(5)} />
                            <YAxis tick={{ fontSize: 10 }} domain={['auto', 'auto']} tickFormatter={(v: number) => `$${v.toLocaleString()}`} />
                            <Tooltip labelFormatter={(d: string) => d} formatter={(v: number) => [`$${v?.toFixed(2)}`, 'VaR']} />
                            <Line type="monotone" dataKey="value" stroke="#dc2626" dot={false} strokeWidth={2} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </Col>
                  </Row>
                )}

                {/* All assets view */}
                {selectedAsset === 'TODOS' && (
                  <>
                    {ASSETS.map((asset) => (
                      <div key={asset} className="mb-4">
                        <h6 className="mb-2" style={{ color: CHART_COLORS[asset], fontWeight: 600 }}>
                          {asset}
                        </h6>
                        <Row className="g-3">
                          <Col md={6}>
                            <div className="bg-white rounded p-3" style={{ border: '1px solid #e2e8f0' }}>
                              <div className="small text-muted mb-2">Precio</div>
                              <ResponsiveContainer width="100%" height={220}>
                                <LineChart data={buildChartData(asset, 'prices')}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                  <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={(d: string) => d.slice(5)} />
                                  <YAxis tick={{ fontSize: 9 }} domain={['auto', 'auto']} />
                                  <Tooltip labelFormatter={(d: string) => d} formatter={(v: number) => [v?.toFixed(4), 'Precio']} />
                                  <Line type="monotone" dataKey="value" stroke={CHART_COLORS[asset]} dot={false} strokeWidth={2} />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          </Col>
                          <Col md={6}>
                            <div className="bg-white rounded p-3" style={{ border: '1px solid #e2e8f0' }}>
                              <div className="small text-muted mb-2">Rolling VaR 180d (USD)</div>
                              <ResponsiveContainer width="100%" height={220}>
                                <LineChart data={buildChartData(asset, 'rolling_var')}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                  <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={(d: string) => d.slice(5)} />
                                  <YAxis tick={{ fontSize: 9 }} domain={['auto', 'auto']} tickFormatter={(v: number) => `$${v.toLocaleString()}`} />
                                  <Tooltip labelFormatter={(d: string) => d} formatter={(v: number) => [`$${v?.toFixed(2)}`, 'VaR']} />
                                  <Line type="monotone" dataKey="value" stroke="#dc2626" dot={false} strokeWidth={2} />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          </Col>
                        </Row>
                      </div>
                    ))}

                    {/* Comparativa Rolling VaR todos */}
                    <div className="bg-white rounded p-3 mt-2" style={{ border: '1px solid #e2e8f0' }}>
                      <h6 className="mb-3" style={{ color: '#7c3aed' }}>
                        Comparativa Rolling VaR 180d (USD)
                      </h6>
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart
                          data={rollingData.dates.map((date, i) => {
                            const point: Record<string, number | string | null> = { date };
                            ASSETS.forEach((a) => {
                              const vals = rollingData.rolling_var[a];
                              point[a] = vals ? vals[i] : null;
                            });
                            return point;
                          }).filter((d) => ASSETS.some((a) => d[a] != null))}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d: string) => d.slice(5)} />
                          <YAxis tick={{ fontSize: 10 }} domain={['auto', 'auto']} tickFormatter={(v: number) => `$${v.toLocaleString()}`} />
                          <Tooltip labelFormatter={(d: string) => d} formatter={(v: number, name: string) => [`$${v?.toFixed(2)}`, name]} />
                          <Legend />
                          {ASSETS.map((a) => (
                            <Line key={a} type="monotone" dataKey={a} stroke={CHART_COLORS[a]} dot={false} strokeWidth={1.5} />
                          ))}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </>
                )}
              </>
            )}
          </>
        )}
      </Container>
    </CoreLayout>
  );
}

export default RiskManagement;
