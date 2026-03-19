'use client';

import { CoreLayout } from '@layout';
import { Row, Col, Form, Modal } from 'react-bootstrap';
import React, { useState, useCallback, useEffect } from 'react';
import Container from 'react-bootstrap/Container';
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import {
  faShieldAlt,
  faSyncAlt,
  faTable,
  faChartLine,
  faEdit,
  faChevronLeft,
  faChevronRight,
  faDollarSign,
  faBorderAll,
  faBookOpen,
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
import { fetchRiskManagement, fetchRollingVar, fetchBenchmarkFactors, fetchExposure } from 'src/models/risk/riskApi';
import type { RiskRow, RiskConfig, RollingVarResponse, BenchmarkFactorsResponse, ExposureParams, ExposureResponse, MarketPrice } from 'src/types/risk';

const PAGE_TITLE = 'Gestión de Riesgos';

const TAB_ITEMS: TabItemType[] = [
  { name: 'Resumen', property: 'resumen', icon: faTable, active: true },
  { name: 'Benchmark', property: 'benchmark', icon: faEdit, active: false },
  { name: 'Rolling VaR', property: 'rolling', icon: faChartLine, active: false },
  { name: 'Exposición', property: 'exposure', icon: faDollarSign, active: false },
  { name: 'Matrices', property: 'matrices', icon: faBorderAll, active: false },
];

const DEFAULT_ASSETS = ['MAIZ', 'AZUCAR', 'CACAO', 'USD'];

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
const MANUAL_COLUMNS = new Set(['position_gr', 'pnl_gr']);

/** Map benchmark asset → exposure commodities */
function getExposureForAsset(asset: string, result: ExposureResponse | null): number | null {
  if (!result?.commodities) return null;
  const find = (name: string) => result.commodities.find((c) => c.nombre === name)?.exposicion_usd ?? 0;
  switch (asset) {
    // Commodities: exposición natural corta (negativo)
    case 'AZUCAR': return -Math.abs(find('AZUCAR'));
    case 'MAIZ': return -Math.abs(find('MAIZ'));
    case 'CACAO': return -Math.abs(find('COCOA_POLVO') + find('MANTECA_CACAO') + find('LICOR_CACAO'));
    // USD: exposición natural larga (positivo)
    case 'USD': return Math.abs(result.exposicion_real_usd ?? 0);
    default: return null;
  }
}

const BENCHMARK_COLUMNS = [
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

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

/** Get the last day of a given month as YYYY-MM-DD */
function lastDayOfMonth(year: number, month: number): string {
  const d = new Date(year, month + 1, 0); // day 0 of next month = last day of this month
  return lastBusinessDay(d).toISOString().slice(0, 10);
}

/** Format month key like "2026-01" */
function monthKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

/** Current month/year */
function currentMonth(): { year: number; month: number } {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() };
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

function emptyBenchmarkRows(assets: string[] = DEFAULT_ASSETS): BenchmarkRow[] {
  return [
    ...assets.map((a) => {
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

/** Recalculate all derived columns for benchmark rows.
 *  @param varianceMap - daily_variance per asset from covariance matrix diagonal (optional)
 */
function recalcBenchmark(rows: BenchmarkRow[], varianceMap?: Record<string, number | null>): BenchmarkRow[] {
  const next = rows.map((r) => ({ ...r }));
  const assetRows = next.slice(0, next.length - 1); // all except Total

  const annualFactor = Math.sqrt(252 / 12); // ≈ 4.583

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

    // pnl_super = (price_end - price_start) * super / price_start
    const pnlSuper = pStart !== 0 ? ((pEnd - pStart) * superPos) / pStart : 0;
    next[i].pnl_super = pnlSuper !== 0 ? String(Math.round(pnlSuper * 1000) / 1000) : '';

    // pnl_gr = manual (editable by user)
    const pnlGr = parseDisplayValue(row.pnl_gr);

    // pnl_total = pnl_super + pnl_gr
    const pnlTotal = pnlSuper + pnlGr;
    next[i].pnl_total = pnlTotal !== 0 ? String(Math.round(pnlTotal * 1000) / 1000) : '';

    // Information Ratio = pnl_gr / tracking_error
    // tracking_error = |sqrt(252/12) * sqrt(daily_variance) * position_gr|
    const { asset } = row;
    const dailyVar = varianceMap?.[asset] ?? null;
    if (dailyVar != null && dailyVar > 0 && grPos !== 0 && pnlGr !== 0) {
      const volDaily = Math.sqrt(dailyVar);
      const trackingError = Math.abs(annualFactor * volDaily * grPos);
      const infoRatio = trackingError !== 0 ? pnlGr / trackingError : null;
      next[i].information_ratio = infoRatio != null ? String(Math.round(infoRatio * 100) / 100) : '';
    } else {
      next[i].information_ratio = '';
    }
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

  // Total info ratio = total pnl_gr / total tracking_error (weighted)
  const totalPnlGr = parseDisplayValue(next[totalIdx].pnl_gr);
  // For total, use portfolio-level tracking error if variance available
  // Simplified: sum of individual tracking errors
  let totalTrackingError = 0;
  assetRows.forEach((row) => {
    const { asset } = row;
    const grP = parseDisplayValue(row.position_gr);
    const dv = varianceMap?.[asset] ?? null;
    if (dv != null && dv > 0 && grP !== 0) {
      totalTrackingError += Math.abs(annualFactor * Math.sqrt(dv) * grP);
    }
  });
  next[totalIdx].information_ratio = totalTrackingError !== 0 && totalPnlGr !== 0
    ? String(Math.round((totalPnlGr / totalTrackingError) * 100) / 100)
    : '';

  return next;
}

/* ─── METODOLOGÍA CONTENT ─── */

const methStyle = { fontSize: '0.85rem', lineHeight: 1.6 };
const methH = { color: '#7c3aed', fontWeight: 700, fontSize: '0.95rem', marginTop: 16, marginBottom: 6 };
const methFormula = { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '8px 12px', fontFamily: 'monospace', fontSize: '0.82rem', margin: '6px 0' };

function MethodologyButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="btn btn-sm btn-outline-secondary ms-2"
      onClick={onClick}
      style={{ fontSize: '0.78rem' }}
    >
      <Icon icon={faBookOpen} className="me-1" />
      Metodología
    </button>
  );
}

const METHODOLOGY: Record<string, { title: string; content: React.ReactNode }> = {
  benchmark: {
    title: 'Metodología — Benchmark',
    content: (
      <div style={methStyle}>
        <p style={methH}>Objetivo</p>
        <p>Comparar la exposición natural de la compañía (Super/Benchmark) contra las posiciones de cobertura (Gestión de Riesgo — GR), midiendo el riesgo y desempeño de cada activo.</p>

        <p style={methH}>Columnas principales</p>
        <ul>
          <li><strong>Super USD (Posición Benchmark):</strong> Se obtiene automáticamente del cálculo de Exposición. Representa la exposición natural de la compañía en USD por commodity.</li>
          <li><strong>GR USD (Posición Cobertura):</strong> Posición nominal en USD de los instrumentos de cobertura (forwards, futuros). Se ingresa manualmente.</li>
          <li><strong>Posición Total:</strong> Super + GR. Si es cero, la cobertura es perfecta.</li>
        </ul>

        <p style={methH}>Value at Risk (VaR)</p>
        <p>Se utiliza el método paramétrico (varianza-covarianza) con una ventana rolling de 180 días hábiles.</p>
        <div style={methFormula}>
          VaR = Posición × Factor VaR Diario / 100
        </div>
        <p>El Factor VaR Diario es el producto de la volatilidad rolling de 180 días por el Z-score correspondiente al nivel de confianza seleccionado. Los retornos se calculan de forma independiente por activo.</p>
        <table className="table table-sm table-bordered" style={{ fontSize: '0.8rem', maxWidth: 300 }}>
          <thead><tr style={{ background: '#f8fafc' }}><th>Confianza</th><th>Z-score</th></tr></thead>
          <tbody>
            <tr><td>90%</td><td>1.2816</td></tr>
            <tr><td>95%</td><td>1.6449</td></tr>
            <tr style={{ background: '#dcfce7' }}><td><strong>99%</strong></td><td><strong>2.3263</strong></td></tr>
          </tbody>
        </table>

        <p style={methH}>P&amp;G (Profit &amp; Loss)</p>
        <div style={methFormula}>
          P&amp;G Super = (Precio Fin − Precio Inicio) × Posición Super / Precio Inicio
        </div>
        <p>Los precios inicio y fin corresponden al primer y último día hábil del mes seleccionado.</p>

        <p style={methH}>Information Ratio</p>
        <div style={methFormula}>
          IR = P&amp;G GR / Tracking Error
        </div>
        <div style={methFormula}>
          Tracking Error = |√(252/12) × √(Varianza Diaria) × Posición GR|
        </div>
        <p>Mide la eficiencia de la cobertura. La Varianza Diaria proviene de la diagonal de la matriz de covarianza (ver pestaña Matrices). Solo se calcula para activos con posición GR. Un valor cercano a cero indica que la cobertura no está generando valor; valores positivos indican que la cobertura beneficia al portafolio.</p>

        <p style={methH}>Manejo de Futuros y Roll</p>
        <p>Se mantiene una <strong>serie continua de precios</strong> por activo. Los precios de cierre se obtienen diariamente de los mercados de futuros correspondientes, identificando siempre el contrato (ticker) utilizado para garantizar trazabilidad.</p>

        <p><strong>Estrategia de roll:</strong> Cuando el contrato front-month se acerca a su vencimiento (~4 veces al año), se pasa al siguiente contrato disponible. La serie de precios continúa sin interrupciones bajo el nuevo contrato.</p>

        <p><strong>Impacto del roll:</strong> Al cambiar de contrato puede haber un salto en el precio (basis) que genera un retorno atípico ese día. Este efecto se acepta intencionalmente:</p>
        <ul>
          <li>Permite mantener una serie continua para calcular el Rolling VaR de 180 días sin interrupciones.</li>
          <li>El impacto es menor: ocurre ~4 veces al año y se diluye en la ventana de 180 observaciones.</li>
          <li>Es un enfoque conservador: el salto puede inflar ligeramente la volatilidad, lo cual es preferible a subestimarla.</li>
        </ul>

        <p><strong>Contratos utilizados:</strong></p>
        <table className="table table-sm table-bordered" style={{ fontSize: '0.8rem', maxWidth: 500 }}>
          <thead><tr style={{ background: '#f8fafc' }}><th>Activo</th><th>Exchange</th><th>Código</th><th>Meses de vencimiento</th></tr></thead>
          <tbody>
            <tr><td>Maíz</td><td>CBOT</td><td>ZC</td><td>H (Mar), K (May), N (Jul), U (Sep), Z (Dec)</td></tr>
            <tr><td>Azúcar</td><td>ICE</td><td>SB</td><td>H (Mar), K (May), N (Jul), V (Oct)</td></tr>
            <tr><td>Cacao</td><td>ICE</td><td>CC</td><td>H (Mar), K (May), N (Jul), U (Sep), Z (Dec)</td></tr>
            <tr><td>USD (TRM)</td><td>BanRep</td><td>TRM</td><td>Diario (no es futuro)</td></tr>
          </tbody>
        </table>
      </div>
    ),
  },

  rolling: {
    title: 'Metodología — Rolling VaR',
    content: (
      <div style={methStyle}>
        <p style={methH}>Objetivo</p>
        <p>Visualizar la evolución del Value at Risk paramétrico a lo largo del tiempo para cada activo, permitiendo identificar periodos de alta y baja volatilidad.</p>

        <p style={methH}>Cálculo del Rolling VaR</p>
        <ol>
          <li><strong>Retornos logarítmicos:</strong> Para cada activo se calcula el retorno diario como el logaritmo natural de la razón entre el precio actual y el precio del día hábil anterior, usando solo los días donde el activo cotizó realmente.</li>
          <li><strong>Volatilidad rolling:</strong> Desviación estándar de los retornos en una ventana móvil de 180 días hábiles (mínimo 30 observaciones para comenzar a mostrar valores).</li>
          <li><strong>Factor VaR:</strong> Volatilidad multiplicada por el Z-score correspondiente al nivel de confianza seleccionado.</li>
          <li><strong>VaR en USD:</strong> Factor VaR multiplicado por el precio del activo en ese día.</li>
        </ol>
        <div style={methFormula}>
          VaR diario = Z-score × Volatilidad rolling (180d) × Precio
        </div>

        <p style={methH}>Interpretación de las gráficas</p>
        <ul>
          <li><strong>Gráfica de Precio:</strong> Evolución del precio del futuro. Permite ver la tendencia del activo y detectar los momentos de roll entre contratos.</li>
          <li><strong>Gráfica de Rolling VaR:</strong> Evolución del VaR en USD. Picos indican periodos de alta volatilidad en el mercado.</li>
          <li><strong>Comparativa:</strong> Permite comparar el VaR entre activos para identificar cuál contribuye más al riesgo total del portafolio.</li>
        </ul>

        <p style={methH}>Contratos de Futuros</p>
        <p>Cada gráfica muestra el ticker del contrato actualmente utilizado. Los contratos tienen fecha de vencimiento y hacen roll aproximadamente 4 veces al año:</p>
        <table className="table table-sm table-bordered" style={{ fontSize: '0.8rem', maxWidth: 500 }}>
          <thead><tr style={{ background: '#f8fafc' }}><th>Activo</th><th>Exchange</th><th>Código</th><th>Meses de vencimiento</th></tr></thead>
          <tbody>
            <tr><td>Maíz</td><td>CBOT</td><td>ZC</td><td>H (Mar), K (May), N (Jul), U (Sep), Z (Dec)</td></tr>
            <tr><td>Azúcar</td><td>ICE</td><td>SB</td><td>H (Mar), K (May), N (Jul), V (Oct)</td></tr>
            <tr><td>Cacao</td><td>ICE</td><td>CC</td><td>H (Mar), K (May), N (Jul), U (Sep), Z (Dec)</td></tr>
            <tr><td>USD (TRM)</td><td>BanRep</td><td>TRM</td><td>Diario (no aplica)</td></tr>
          </tbody>
        </table>
        <p>Al momento del roll, puede observarse un salto en la gráfica de precios. Este salto refleja la diferencia de precio entre contratos (basis) y no un movimiento real del mercado subyacente.</p>
      </div>
    ),
  },

  exposure: {
    title: 'Metodología — Exposición',
    content: (
      <div style={methStyle}>
        <p style={methH}>Objetivo</p>
        <p>Cuantificar la exposición de la compañía a cada commodity en USD, basándose en las proyecciones anuales de consumo y los precios actuales de mercado.</p>

        <p style={methH}>Cálculo por Commodity</p>

        <p><strong>Azúcar:</strong></p>
        <div style={methFormula}>
          Exposición = Proyección anual (ton) × Precio (¢/lb) × 22.0462 (lb/ton) × Factor Crudo/Refinado / 100
        </div>

        <p><strong>Maíz (Glucosa):</strong></p>
        <div style={methFormula}>
          Precio USD/ton = (Precio ¢/bu + Base ¢/bu) × 0.01 / 0.0254 (ton/bu)<br />
          Costo Total = Precio USD/ton + Flete + Processing Fee<br />
          Exposición = Proyección anual (ton) × Costo Total × Factor Maíz/Glucosa
        </div>

        <p><strong>Cacao (Polvo, Manteca, Licor):</strong></p>
        <div style={methFormula}>
          Exposición = Proyección anual (ton) × Precio (USD/ton) × Factor de Conversión
        </div>
        <p>Cada derivado del cacao tiene su propio factor de conversión que refleja el rendimiento de procesamiento.</p>

        <p><strong>Empaque (Bolsa + Envoltura):</strong></p>
        <div style={methFormula}>
          Exposición = Costo anual empaque (COP) / TRM
        </div>

        <p style={methH}>Exposición Real USD</p>
        <div style={methFormula}>
          Exposición Real = Ventas Internacionales (USD) − Total Commodities (USD)
        </div>
        <p>Representa la exposición neta de la compañía al dólar después de restar el consumo de materias primas. Este valor alimenta la columna Super USD del activo USD en el Benchmark.</p>

        <p style={methH}>Precios de Mercado</p>
        <p>Los precios de los futuros se actualizan automáticamente. Los campos con fondo azul indican precios de mercado no editables, mostrando la fecha de cotización y el contrato utilizado. Los demás campos son editables y permiten ajustar manualmente los parámetros de cálculo.</p>
      </div>
    ),
  },

  matrices: {
    title: 'Metodología — Matrices',
    content: (
      <div style={methStyle}>
        <p style={methH}>Objetivo</p>
        <p>Presentar la estructura de riesgo entre activos: varianzas individuales, covarianzas entre pares y correlaciones. Estos valores son insumos fundamentales para el cálculo del VaR de portafolio y el Information Ratio.</p>

        <p style={methH}>Cálculo de Retornos</p>
        <p>Los retornos se calculan de forma independiente por activo, tomando solo los días donde cada uno realmente cotizó:</p>
        <ol>
          <li>Para cada activo, se calcula el retorno logarítmico diario como el logaritmo natural del precio actual dividido por el precio del día hábil anterior de ese mismo activo.</li>
          <li>Para la covarianza entre dos activos, se usan únicamente los días donde ambos tienen retorno real.</li>
        </ol>

        <p style={methH}>Varianza Diaria</p>
        <p>Corresponde a la diagonal de la matriz de covarianza. A partir de ella se derivan:</p>
        <ul>
          <li><strong>Volatilidad Diaria:</strong> Raíz cuadrada de la varianza.</li>
          <li><strong>Volatilidad Anualizada:</strong> Volatilidad diaria multiplicada por la raíz cuadrada de 252 (días hábiles al año).</li>
        </ul>
        <p>La varianza diaria se utiliza directamente en el cálculo del Tracking Error y del Information Ratio en el Benchmark.</p>

        <p style={methH}>Correlación</p>
        <p>Mide la relación lineal entre los retornos de dos activos, normalizada entre −1 y 1. Valores cercanos a 1 indican que los activos tienden a moverse en la misma dirección; cercanos a −1, en direcciones opuestas; cercanos a 0, sin relación aparente. Es un factor clave para la diversificación del riesgo del portafolio.</p>

        <p style={methH}>Observaciones por Activo</p>
        <p>Cada activo puede tener diferente número de observaciones según su calendario de cotización:</p>
        <ul>
          <li><strong>Commodities (Maíz, Azúcar, Cacao):</strong> Cotizan en CME/ICE, mercados cerrados fines de semana y feriados de Estados Unidos.</li>
          <li><strong>USD (TRM):</strong> Tasa Representativa del Mercado publicada por el Banco de la República, no disponible fines de semana ni festivos colombianos.</li>
        </ul>
      </div>
    ),
  },
};

function RiskManagement() {
  const [activeTab, setActiveTab] = useState('resumen');
  const [pageTabs, setPageTabs] = useState<TabItemType[]>(TAB_ITEMS);
  const [filterDate, setFilterDate] = useState(defaultDate());
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<RiskRow[]>([]);
  const [config, setConfig] = useState<RiskConfig | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Methodology modal
  const [methModal, setMethModal] = useState<string | null>(null);

  // Confidence level
  const [confidenceLevel, setConfidenceLevel] = useState(0.99);

  // Benchmark state
  const [assets, setAssets] = useState<string[]>(DEFAULT_ASSETS);
  const [benchmarkMonth, setBenchmarkMonth] = useState(currentMonth());
  const [benchmarkRows, setBenchmarkRows] = useState<BenchmarkRow[]>(emptyBenchmarkRows());
  const [benchmarkFactors, setBenchmarkFactors] = useState<BenchmarkFactorsResponse | null>(null);
  const [benchmarkLoading, setBenchmarkLoading] = useState(false);

  // Extract daily_variance map from benchmarkFactors for IR calculation
  const varianceMap: Record<string, number | null> = React.useMemo(() => {
    if (!benchmarkFactors?.factors) return {};
    const m: Record<string, number | null> = {};
    Object.entries(benchmarkFactors.factors).forEach(([asset, f]) => {
      m[asset] = f.daily_variance ?? null;
    });
    return m;
  }, [benchmarkFactors]);
  // Cache: positions per month so user doesn't lose data when navigating
  const [monthCache, setMonthCache] = useState<Record<string, BenchmarkRow[]>>({});

  // Rolling VaR state
  const [rollingData, setRollingData] = useState<RollingVarResponse | null>(null);
  const [rollingLoading, setRollingLoading] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState('MAIZ');

  // Exposure state
  const [exposureParams, setExposureParams] = useState<ExposureParams>({
    proyeccion_azucar: [3157, 3157, 3157, 3157, 3157, 3157, 3157, 3157, 3157, 3157, 3157, 3157],
    precio_azucar_cent_lb: 13.89,
    factor_crudo_refinado: 1.05,
    proyeccion_glucosa: [2277, 2277, 2277, 2277, 2277, 2277, 2277, 2277, 2277, 2277, 2277, 2277],
    precio_maiz_cent_bu: 442,
    base_maiz_cent_bu: 80,
    flete_usd_ton: 46,
    processing_fee_usd: 263,
    proc_fee_cop_kg: 668,
    trm: 3800,
    factor_maiz_glucosa: 1.495,
    proyeccion_cocoa_polvo: [24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24],
    factor_cocoa_polvo: 1.22,
    proyeccion_manteca: [13, 13, 13, 13, 13, 13, 13, 13, 13, 13, 13, 13],
    factor_manteca: 1.95,
    proyeccion_licor: [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
    factor_licor: 1.53,
    precio_cocoa_usd_ton: 2798,
    proyeccion_bolsa: [151, 151, 151, 151, 151, 151, 151, 151, 151, 151, 151, 151],
    proyeccion_envoltura: [138, 138, 138, 138, 138, 138, 138, 138, 138, 138, 138, 138],
    precio_empaque_fijo: 21610000,
    ventas_intl_usd: 130025826,
    ventas_co_usd: 0,
    ventas_pe_usd: 42827644,
  });
  const [exposureResult, setExposureResult] = useState<ExposureResponse | null>(null);
  const [exposureLoading, setExposureLoading] = useState(false);

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
      const data = await fetchRollingVar(filterDate, confidenceLevel);
      setRollingData(data);
    } catch (e: unknown) {
      toast.error((e as Error)?.message || 'Error obteniendo rolling VaR');
    } finally {
      setRollingLoading(false);
    }
  }, [filterDate, confidenceLevel]);

  const benchmarkDateStr = lastDayOfMonth(benchmarkMonth.year, benchmarkMonth.month);
  const benchmarkMonthKey = monthKey(benchmarkMonth.year, benchmarkMonth.month);

  const handleFetchBenchmarkFactors = useCallback(async () => {
    setBenchmarkLoading(true);
    try {
      const data = await fetchBenchmarkFactors(benchmarkDateStr, confidenceLevel);
      setBenchmarkFactors(data);

      // Use assets from backend response
      const backendAssets = data.assets || DEFAULT_ASSETS;
      setAssets(backendAssets);

      // Check if we have cached positions for this month
      const cached = monthCache[benchmarkMonthKey];

      // Build new rows from backend assets and pre-fill factors
      const newRows = emptyBenchmarkRows(backendAssets);
      backendAssets.forEach((asset, i) => {
        const f = data.factors[asset];
        if (f) {
          newRows[i].factor_var_diario = f.factor_var_diario != null ? String(f.factor_var_diario) : '';
          newRows[i].factor_unit = f.factor_unit || '';
          newRows[i].price_start = f.price_start != null ? String(f.price_start) : '';
          newRows[i].price_end = f.price_end != null ? String(f.price_end) : '';
          newRows[i].contract = f.contract || '';
        }
        // Restore cached manual values if available
        if (cached && cached[i]) {
          MANUAL_COLUMNS.forEach((col) => {
            if (cached[i][col]) newRows[i][col] = cached[i][col];
          });
        }
        // Auto-fill position_super from exposure calculation
        const expVal = getExposureForAsset(asset, exposureResult);
        if (expVal != null) {
          newRows[i].position_super = String(Math.round(expVal));
        }
      });
      // Build variance map from fresh data for IR calculation
      const freshVariance: Record<string, number | null> = {};
      Object.entries(data.factors).forEach(([a, f]) => { freshVariance[a] = f.daily_variance ?? null; });
      setBenchmarkRows(recalcBenchmark(newRows, freshVariance));

      toast.success(`${MONTH_NAMES[benchmarkMonth.month]} ${benchmarkMonth.year} (${data.period.start} → ${data.period.end})`);
    } catch (e: unknown) {
      toast.error((e as Error)?.message || 'Error obteniendo factores');
    } finally {
      setBenchmarkLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [benchmarkDateStr, benchmarkMonthKey, confidenceLevel]);

  // Save current rows to cache when they change
  const saveBenchmarkToCache = useCallback(() => {
    setMonthCache((prev) => ({ ...prev, [benchmarkMonthKey]: benchmarkRows }));
  }, [benchmarkMonthKey, benchmarkRows]);

  // Navigate months
  const goToPrevMonth = () => {
    saveBenchmarkToCache();
    setBenchmarkMonth((prev) => {
      if (prev.month === 0) return { year: prev.year - 1, month: 11 };
      return { year: prev.year, month: prev.month - 1 };
    });
    setBenchmarkFactors(null); // trigger reload
  };

  const goToNextMonth = () => {
    saveBenchmarkToCache();
    setBenchmarkMonth((prev) => {
      if (prev.month === 11) return { year: prev.year + 1, month: 0 };
      return { year: prev.year, month: prev.month + 1 };
    });
    setBenchmarkFactors(null); // trigger reload
  };

  const handleFetchExposure = useCallback(async () => {
    setExposureLoading(true);
    try {
      const data = await fetchExposure(filterDate, exposureParams);
      setExposureResult(data);

      // Update local params with DB prices
      if (data.market_prices) {
        setExposureParams((prev) => {
          const updated = { ...prev };
          Object.entries(data.market_prices || {}).forEach(([key, mp]) => {
            (updated as Record<string, unknown>)[key] = mp.value;
          });
          return updated;
        });
      }

      const priceCount = Object.keys(data.market_prices || {}).length;
      toast.success(`Exposición calculada (${priceCount} precios de mercado cargados)`);
    } catch (e: unknown) {
      toast.error((e as Error)?.message || 'Error calculando exposición');
    } finally {
      setExposureLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterDate, exposureParams]);

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
  }, [activeTab, benchmarkFactors]);

  // When exposure results change, update benchmark position_super
  useEffect(() => {
    if (!exposureResult) return;
    setBenchmarkRows((prev) => {
      const next = prev.map((r) => ({ ...r }));
      const assetRows = next.slice(0, next.length - 1);
      let changed = false;
      assetRows.forEach((row, i) => {
        const expVal = getExposureForAsset(row.asset, exposureResult);
        if (expVal != null) {
          next[i].position_super = String(Math.round(expVal));
          changed = true;
        }
      });
      return changed ? recalcBenchmark(next, varianceMap) : prev;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exposureResult, varianceMap]);

  const handleBenchmarkChange = (rowIdx: number, colKey: string, rawValue: string) => {
    setBenchmarkRows((prev) => {
      const next = prev.map((r) => ({ ...r }));
      next[rowIdx][colKey] = rawValue.replace(/[$,]/g, '');
      return recalcBenchmark(next, varianceMap);
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
            <Row className="mb-3 align-items-center">
              <Col xs="auto" className="d-flex align-items-center gap-2">
                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={goToPrevMonth}
                  disabled={benchmarkLoading}
                  style={{ padding: '4px 10px' }}
                >
                  <Icon icon={faChevronLeft} />
                </Button>
                <div className="text-center" style={{ minWidth: 160 }}>
                  <strong style={{ fontSize: '1.1rem', color: '#7c3aed' }}>
                    {MONTH_NAMES[benchmarkMonth.month]} {benchmarkMonth.year}
                  </strong>
                </div>
                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={goToNextMonth}
                  disabled={benchmarkLoading}
                  style={{ padding: '4px 10px' }}
                >
                  <Icon icon={faChevronRight} />
                </Button>
              </Col>
              <Col xs="auto">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleFetchBenchmarkFactors}
                  disabled={benchmarkLoading}
                >
                  <Icon icon={faSyncAlt} spin={benchmarkLoading} className="me-1" />
                  {benchmarkLoading ? 'Cargando...' : 'Actualizar'}
                </Button>
                <MethodologyButton onClick={() => setMethModal('benchmark')} />
              </Col>
              <Col xs="auto">
                <Form.Group>
                  <Form.Label className="small text-muted mb-0">Confianza</Form.Label>
                  <Form.Select
                    size="sm"
                    value={confidenceLevel}
                    onChange={(e) => setConfidenceLevel(parseFloat(e.target.value))}
                    style={{ width: 90 }}
                  >
                    <option value={0.90}>90%</option>
                    <option value={0.95}>95%</option>
                    <option value={0.99}>99%</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              {benchmarkFactors && (
                <Col className="d-flex align-items-center gap-2 small text-muted">
                  <span>
                    Periodo: <strong>{benchmarkFactors.period.start}</strong> → <strong>{benchmarkFactors.period.end}</strong>
                    {benchmarkFactors.z_score && (
                      <> | Z-score: <strong>{benchmarkFactors.z_score}</strong></>
                    )}
                  </span>
                </Col>
              )}
            </Row>

            <p className="small text-muted mb-3">
              <span style={{ background: '#dbeafe', padding: '1px 6px', border: '1px solid #93c5fd', borderRadius: 3 }}>Super USD</span> se llena automáticamente desde Exposición.
              Ingresa <strong>Portafolio GR</strong> y <strong>P&G GR</strong> manualmente. Los demás campos se calculan automáticamente.
            </p>

            {benchmarkLoading && <p className="text-muted">Cargando factores...</p>}

            <div className="table-responsive">
              <table className="table table-sm table-bordered align-middle" style={{ fontSize: '0.82rem' }}>
                <thead className="table-dark text-center">
                  <tr>
                    <th rowSpan={2}>Activo</th>
                    <th colSpan={3}>Posiciones</th>
                    <th colSpan={3}>VaR Diario</th>
                    <th colSpan={2}>Factor VaR</th>
                    <th rowSpan={2}>Portafolio</th>
                    <th colSpan={2}>Precios</th>
                    <th colSpan={3}>P&amp;G</th>
                    <th rowSpan={2}>Info Ratio</th>
                  </tr>
                  <tr>
                    <th>Super USD</th><th>Portafolio GR</th><th>Total</th>
                    <th>Super</th><th>GR</th><th>Total</th>
                    <th>Diario %</th><th>Unidad</th>
                    <th>Inicio</th><th>Fin</th>
                    <th>Super</th><th>GR</th><th>Total</th>
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
                                {row.contract && !isTotal && (
                                  <span className="ms-1" style={{ fontSize: '0.68rem', color: '#6b7280', fontWeight: 400 }}>
                                    ({row.contract})
                                  </span>
                                )}
                              </td>
                            );
                          }

                          // position_super: auto-filled from exposure (read-only, blue bg)
                          if (col.key === 'position_super' && !isTotal) {
                            return (
                              <td key={col.key} className="text-end" style={{ background: '#dbeafe', fontSize: '0.82rem' }}>
                                {isUsd && rawNum !== 0 ? fmtUsd(rawNum) : (row[col.key] || '—')}
                              </td>
                            );
                          }

                          // Manual editable cells (position_gr, pnl_gr)
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
                    {assets.map((a) => (
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
                <Form.Group>
                  <Form.Label className="small text-muted">Confianza</Form.Label>
                  <Form.Select
                    size="sm"
                    value={confidenceLevel}
                    onChange={(e) => setConfidenceLevel(parseFloat(e.target.value))}
                    style={{ width: 90 }}
                  >
                    <option value={0.90}>90%</option>
                    <option value={0.95}>95%</option>
                    <option value={0.99}>99%</option>
                  </Form.Select>
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
                <MethodologyButton onClick={() => setMethModal('rolling')} />
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
                          {rollingData.contracts?.[selectedAsset] && (
                            <span className="ms-1" style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: 400 }}>
                              ({rollingData.contracts[selectedAsset]})
                            </span>
                          )}
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
                          {rollingData.contracts?.[selectedAsset] && (
                            <span className="ms-1" style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: 400 }}>
                              ({rollingData.contracts[selectedAsset]})
                            </span>
                          )}
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
                    {assets.map((asset) => (
                      <div key={asset} className="mb-4">
                        <h6 className="mb-2" style={{ color: CHART_COLORS[asset], fontWeight: 600 }}>
                          {asset}
                          {rollingData.contracts?.[asset] && (
                            <span className="ms-1" style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: 400 }}>
                              ({rollingData.contracts[asset]})
                            </span>
                          )}
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
                            assets.forEach((a) => {
                              const vals = rollingData.rolling_var[a];
                              point[a] = vals ? vals[i] : null;
                            });
                            return point;
                          }).filter((d) => assets.some((a) => d[a] != null))}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d: string) => d.slice(5)} />
                          <YAxis tick={{ fontSize: 10 }} domain={['auto', 'auto']} tickFormatter={(v: number) => `$${v.toLocaleString()}`} />
                          <Tooltip labelFormatter={(d: string) => d} formatter={(v: number, name: string) => [`$${v?.toFixed(2)}`, name]} />
                          <Legend />
                          {assets.map((a) => (
                            <Line key={a} type="monotone" dataKey={a} name={rollingData.contracts?.[a] ? `${a} (${rollingData.contracts[a]})` : a} stroke={CHART_COLORS[a]} dot={false} strokeWidth={1.5} />
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

        {/* ─── EXPOSICIÓN TAB ─── */}
        {activeTab === 'exposure' && (() => {
          const inputStyle = { background: '#fffbeb', fontSize: '0.78rem' };
          const calcStyle = { fontSize: '0.78rem' };
          const headerStyle = { background: '#1e293b', color: '#fff', fontSize: '0.82rem', fontWeight: 700, padding: '6px 10px' };
          const labelTd = { fontSize: '0.78rem', padding: '3px 8px' };
          const valTd = { fontSize: '0.78rem', padding: '3px 8px', textAlign: 'right' as const };
          const inputTd = { ...valTd, background: '#fffbeb', padding: 0 };
          const resultTd = { ...valTd, background: '#dcfce7', fontWeight: 700 };

          const numInput = (key: keyof ExposureParams, step = '1') => (
            <Form.Control
              type="number"
              size="sm"
              step={step}
              style={{ ...inputStyle, border: 'none', textAlign: 'right', padding: '3px 6px' }}
              value={exposureParams[key] as number}
              onChange={(e) => setExposureParams((p) => ({ ...p, [key]: parseFloat(e.target.value) || 0 }))}
            />
          );

          const projTotal = (key: keyof ExposureParams) =>
            (exposureParams[key] as number[]).reduce((a, b) => a + b, 0);

          const projInput = (key: keyof ExposureParams) => (
            <Form.Control
              type="number"
              size="sm"
              style={{ ...inputStyle, border: 'none', textAlign: 'right', padding: '3px 6px' }}
              value={projTotal(key)}
              onChange={(e) => {
                const total = parseFloat(e.target.value) || 0;
                const monthly = Math.round(total / 12);
                const arr = Array(12).fill(monthly);
                arr[11] = total - monthly * 11;
                setExposureParams((p) => ({ ...p, [key]: arr }));
              }}
            />
          );

          const n = (v: number | undefined | null, dec = 2) =>
            v != null ? v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }) : '—';

          const mp = exposureResult?.market_prices || {};

          // Price field: shows value from DB with date, or manual input
          const priceField = (paramKey: keyof ExposureParams, label: string, step = '1') => {
            const dbPrice: MarketPrice | undefined = mp[paramKey];
            if (dbPrice) {
              return (
                <>
                  <tr>
                    <td style={labelTd}>{label}</td>
                    <td style={{ ...valTd, background: '#dbeafe', fontWeight: 600 }}>
                      {n(dbPrice.value, step === '0.01' ? 2 : 0)}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ ...labelTd, fontSize: '0.7rem', color: '#6b7280' }}>
                      Fecha precio ({dbPrice.source})
                      {dbPrice.contract && (
                        <span className="ms-1" style={{ color: '#7c3aed', fontWeight: 600 }}>
                          [{dbPrice.contract}]
                        </span>
                      )}
                    </td>
                    <td style={{ ...valTd, fontSize: '0.7rem', color: '#3b82f6' }}>{dbPrice.date}</td>
                  </tr>
                </>
              );
            }
            return (
              <tr>
                <td style={labelTd}>{label}</td>
                <td style={inputTd}>{numInput(paramKey, step)}</td>
              </tr>
            );
          };

          // Get commodity result by name
          const getComm = (name: string) => exposureResult?.commodities.find((c) => c.nombre === name);
          const az = getComm('AZUCAR');
          const mz = getComm('MAIZ');
          const cp = getComm('COCOA_POLVO');
          const mc = getComm('MANTECA_CACAO');
          const lc = getComm('LICOR_CACAO');
          const emp = getComm('EMPAQUE');

          return (
            <>
              <Row className="mb-3 align-items-center">
                <Col xs="auto">
                  <Form.Group>
                    <Form.Label className="small text-muted mb-0">Fecha precios</Form.Label>
                    <Form.Control
                      type="date"
                      size="sm"
                      value={filterDate}
                      onChange={(e) => setFilterDate(e.target.value)}
                    />
                  </Form.Group>
                </Col>
                <Col xs="auto">
                  <Form.Label className="small text-muted mb-0">&nbsp;</Form.Label>
                  <div>
                    <Button variant="primary" size="sm" onClick={handleFetchExposure} disabled={exposureLoading}>
                      <Icon icon={faSyncAlt} spin={exposureLoading} className="me-1" />
                      {exposureLoading ? 'Calculando...' : 'Calcular Exposición'}
                    </Button>
                    <MethodologyButton onClick={() => setMethModal('exposure')} />
                  </div>
                </Col>
                <Col className="d-flex align-items-end gap-3">
                  <span className="small text-muted">
                    <span style={{ background: '#fffbeb', padding: '1px 6px', border: '1px solid #fbbf24', borderRadius: 3 }}>Amarillo</span> = input manual
                  </span>
                  <span className="small text-muted">
                    <span style={{ background: '#dbeafe', padding: '1px 6px', border: '1px solid #93c5fd', borderRadius: 3 }}>Azul</span> = precio de mercado (DB)
                  </span>
                </Col>
              </Row>

              {/* Ventas Proyectadas - shared params */}
              <div className="bg-white rounded mb-3 p-3" style={{ border: '1px solid #e2e8f0' }}>
                <h6 style={{ color: '#7c3aed', fontWeight: 600, marginBottom: 10 }}>Ventas Proyectadas & Parámetros Globales</h6>
                <Row className="g-2">
                  {([
                    { key: 'ventas_intl_usd', label: 'Ventas Intl. (USD)' },
                    { key: 'ventas_co_usd', label: 'Ventas Colombia (USD)' },
                    { key: 'ventas_pe_usd', label: 'Ventas Perú (USD)' },
                    { key: 'trm', label: 'TRM (COP/USD)' },
                  ] as { key: keyof ExposureParams; label: string }[]).map(({ key, label }) => (
                    <Col xs={6} md={3} key={key}>
                      <Form.Label className="small text-muted mb-0">{label}</Form.Label>
                      <Form.Control type="number" size="sm" style={inputStyle}
                        value={exposureParams[key] as number}
                        onChange={(e) => setExposureParams((p) => ({ ...p, [key]: parseFloat(e.target.value) || 0 }))}
                      />
                    </Col>
                  ))}
                </Row>
              </div>

              {/* Commodity Cards */}
              <Row className="g-3 mb-4">
                {/* AZUCAR */}
                <Col md={6} lg={4}>
                  <div className="rounded h-100" style={{ border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                    <div style={headerStyle}>AZÚCAR <span className="fw-normal ms-2" style={{ fontSize: '0.7rem' }}>ICE - SB (Sugar #11)</span></div>
                    <table className="table table-sm mb-0" style={{ fontSize: '0.78rem' }}>
                      <tbody>
                        <tr><td style={labelTd}>TON Azúcar (proyección)</td><td style={inputTd}>{projInput('proyeccion_azucar')}</td></tr>
                        <tr><td style={labelTd}>Factor Crudo→Refinado</td><td style={inputTd}>{numInput('factor_crudo_refinado', '0.01')}</td></tr>
                        {priceField('precio_azucar_cent_lb', 'Precio Futuro (¢/lb)', '0.01')}
                        <tr><td style={labelTd}>TON Contrato</td><td style={{ ...valTd, ...calcStyle }}>{az ? n(az.ton_contrato as number) : '—'}</td></tr>
                        <tr><td style={labelTd}>TON Reales</td><td style={{ ...valTd, ...calcStyle }}>{az ? n(az.ton_reales as number) : '—'}</td></tr>
                        <tr><td style={labelTd}># Contratos</td><td style={{ ...valTd, ...calcStyle }}>{az ? n(az.num_contratos as number) : '—'}</td></tr>
                        <tr><td style={labelTd}>Libras x Contrato</td><td style={{ ...valTd, ...calcStyle }}>{az ? n(az.libras_x_contrato as number, 0) : '—'}</td></tr>
                        <tr><td style={labelTd}>Precio x Libra (USD)</td><td style={{ ...valTd, ...calcStyle }}>{az ? n(az.precio_x_libra as number, 4) : '—'}</td></tr>
                        <tr><td style={labelTd}>Precio x Contrato (USD)</td><td style={{ ...valTd, ...calcStyle }}>{az ? n(az.precio_x_contrato as number) : '—'}</td></tr>
                        <tr><td style={{ ...labelTd, fontWeight: 700 }}>Exposición USD</td><td style={resultTd}>{az ? fmtUsd(az.exposicion_usd) : '—'}</td></tr>
                        <tr><td style={labelTd}>Precio por TON</td><td style={valTd}>{az ? n(az.precio_por_ton) : '—'}</td></tr>
                      </tbody>
                    </table>
                  </div>
                </Col>

                {/* MAIZ / GLUCOSA */}
                <Col md={6} lg={4}>
                  <div className="rounded h-100" style={{ border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                    <div style={headerStyle}>MAÍZ / GLUCOSA <span className="fw-normal ms-2" style={{ fontSize: '0.7rem' }}>CME - ZC (Corn)</span></div>
                    <table className="table table-sm mb-0" style={{ fontSize: '0.78rem' }}>
                      <tbody>
                        <tr><td style={labelTd}>TON Glucosa (proyección)</td><td style={inputTd}>{projInput('proyeccion_glucosa')}</td></tr>
                        {priceField('precio_maiz_cent_bu', 'Precio Maíz (¢/bu)')}
                        <tr><td style={labelTd}>Base (¢/bu)</td><td style={inputTd}>{numInput('base_maiz_cent_bu')}</td></tr>
                        <tr><td style={labelTd}>Conversión bu/ton</td><td style={{ ...valTd, ...calcStyle }}>0.3937</td></tr>
                        <tr><td style={labelTd}>Precio Maíz (¢/ton)</td><td style={{ ...valTd, ...calcStyle, fontWeight: 600 }}>{mz ? n(mz.precio_cent_ton as number) : '—'}</td></tr>
                        <tr><td style={labelTd}>Precio Maíz (USD/ton)</td><td style={{ ...valTd, ...calcStyle, fontWeight: 600 }}>{mz ? n(mz.precio_usd_ton as number, 4) : '—'}</td></tr>
                        <tr><td style={labelTd}>Flete Oceánico (USD/ton)</td><td style={inputTd}>{numInput('flete_usd_ton')}</td></tr>
                        <tr><td style={labelTd}>Crédito Subproductos</td><td style={{ ...valTd, ...calcStyle }}>{mz ? n(mz.credito_subproductos as number) : '—'}</td></tr>
                        <tr><td style={labelTd}>Factor Maíz→Glucosa</td><td style={inputTd}>{numInput('factor_maiz_glucosa', '0.001')}</td></tr>
                        <tr><td style={labelTd}>Glucosa Materia (USD/ton)</td><td style={{ ...valTd, ...calcStyle, fontWeight: 600 }}>{mz ? n(mz.glucosa_materia as number) : '—'}</td></tr>
                        <tr><td style={labelTd}>Processing Fee (USD/ton)</td><td style={inputTd}>{numInput('processing_fee_usd')}</td></tr>
                        <tr><td style={labelTd}>Processing Fee (COP/kg)</td><td style={inputTd}>{numInput('proc_fee_cop_kg')}</td></tr>
                        <tr><td style={labelTd}>Precio Glucosa (USD/ton)</td><td style={{ ...valTd, ...calcStyle, fontWeight: 600 }}>{mz ? n(mz.precio_glucosa as number) : '—'}</td></tr>
                        <tr><td style={{ ...labelTd, fontWeight: 700 }}>Exposición USD</td><td style={resultTd}>{mz ? fmtUsd(mz.exposicion_usd) : '—'}</td></tr>
                      </tbody>
                    </table>
                  </div>
                </Col>

                {/* COCOA EN POLVO */}
                <Col md={6} lg={4}>
                  <div className="rounded h-100" style={{ border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                    <div style={headerStyle}>COCOA EN POLVO <span className="fw-normal ms-2" style={{ fontSize: '0.7rem' }}>ICE - CC</span></div>
                    <table className="table table-sm mb-0" style={{ fontSize: '0.78rem' }}>
                      <tbody>
                        <tr><td style={labelTd}>TON Necesarias</td><td style={inputTd}>{projInput('proyeccion_cocoa_polvo')}</td></tr>
                        <tr><td style={labelTd}>Factor Conversión</td><td style={inputTd}>{numInput('factor_cocoa_polvo', '0.01')}</td></tr>
                        {priceField('precio_cocoa_usd_ton', 'Precio Futuro (USD/ton)')}
                        <tr><td style={labelTd}>TON Contrato</td><td style={{ ...valTd, ...calcStyle }}>10</td></tr>
                        <tr><td style={labelTd}>Kg Necesarias</td><td style={{ ...valTd, ...calcStyle }}>{cp ? n(cp.kg_reales as number, 0) : '—'}</td></tr>
                        <tr><td style={labelTd}>TON Reales</td><td style={{ ...valTd, ...calcStyle }}>{cp ? n(cp.ton_reales as number) : '—'}</td></tr>
                        <tr><td style={labelTd}># Contratos</td><td style={{ ...valTd, ...calcStyle }}>{cp ? n(cp.num_contratos as number) : '—'}</td></tr>
                        <tr><td style={labelTd}>Precio x Contrato (USD)</td><td style={{ ...valTd, ...calcStyle }}>{cp ? n(cp.precio_x_contrato as number) : '—'}</td></tr>
                        <tr><td style={{ ...labelTd, fontWeight: 700 }}>Exposición USD</td><td style={resultTd}>{cp ? fmtUsd(cp.exposicion_usd) : '—'}</td></tr>
                        <tr><td style={labelTd}>Precio por TON</td><td style={valTd}>{cp ? n(cp.precio_por_ton) : '—'}</td></tr>
                      </tbody>
                    </table>
                  </div>
                </Col>

                {/* MANTECA DE CACAO */}
                <Col md={6} lg={4}>
                  <div className="rounded h-100" style={{ border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                    <div style={headerStyle}>MANTECA DE CACAO <span className="fw-normal ms-2" style={{ fontSize: '0.7rem' }}>ICE - CC</span></div>
                    <table className="table table-sm mb-0" style={{ fontSize: '0.78rem' }}>
                      <tbody>
                        <tr><td style={labelTd}>TON Necesarias</td><td style={inputTd}>{projInput('proyeccion_manteca')}</td></tr>
                        <tr><td style={labelTd}>Factor Conversión</td><td style={inputTd}>{numInput('factor_manteca', '0.01')}</td></tr>
                        <tr><td style={labelTd}>Precio Futuro (USD/ton)</td><td style={{ ...valTd, ...calcStyle }}>{n(exposureParams.precio_cocoa_usd_ton, 0)}</td></tr>
                        <tr><td style={labelTd}>TON Contrato</td><td style={{ ...valTd, ...calcStyle }}>10</td></tr>
                        <tr><td style={labelTd}>Kg Reales</td><td style={{ ...valTd, ...calcStyle }}>{mc ? n(mc.kg_reales as number, 0) : '—'}</td></tr>
                        <tr><td style={labelTd}>TON Reales</td><td style={{ ...valTd, ...calcStyle }}>{mc ? n(mc.ton_reales as number) : '—'}</td></tr>
                        <tr><td style={labelTd}># Contratos</td><td style={{ ...valTd, ...calcStyle }}>{mc ? n(mc.num_contratos as number) : '—'}</td></tr>
                        <tr><td style={{ ...labelTd, fontWeight: 700 }}>Exposición USD</td><td style={resultTd}>{mc ? fmtUsd(mc.exposicion_usd) : '—'}</td></tr>
                        <tr><td style={labelTd}>Precio por TON</td><td style={valTd}>{mc ? n(mc.precio_por_ton) : '—'}</td></tr>
                      </tbody>
                    </table>
                  </div>
                </Col>

                {/* LICOR DE CACAO */}
                <Col md={6} lg={4}>
                  <div className="rounded h-100" style={{ border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                    <div style={headerStyle}>LICOR DE CACAO <span className="fw-normal ms-2" style={{ fontSize: '0.7rem' }}>ICE - CC</span></div>
                    <table className="table table-sm mb-0" style={{ fontSize: '0.78rem' }}>
                      <tbody>
                        <tr><td style={labelTd}>TON Necesarias</td><td style={inputTd}>{projInput('proyeccion_licor')}</td></tr>
                        <tr><td style={labelTd}>Factor Conversión</td><td style={inputTd}>{numInput('factor_licor', '0.01')}</td></tr>
                        <tr><td style={labelTd}>Precio Futuro (USD/ton)</td><td style={{ ...valTd, ...calcStyle }}>{n(exposureParams.precio_cocoa_usd_ton, 0)}</td></tr>
                        <tr><td style={labelTd}>TON Contrato</td><td style={{ ...valTd, ...calcStyle }}>10</td></tr>
                        <tr><td style={labelTd}>Kg Reales</td><td style={{ ...valTd, ...calcStyle }}>{lc ? n(lc.kg_reales as number, 0) : '—'}</td></tr>
                        <tr><td style={labelTd}>TON Reales</td><td style={{ ...valTd, ...calcStyle }}>{lc ? n(lc.ton_reales as number) : '—'}</td></tr>
                        <tr><td style={labelTd}># Contratos</td><td style={{ ...valTd, ...calcStyle }}>{lc ? n(lc.num_contratos as number) : '—'}</td></tr>
                        <tr><td style={{ ...labelTd, fontWeight: 700 }}>Exposición USD</td><td style={resultTd}>{lc ? fmtUsd(lc.exposicion_usd) : '—'}</td></tr>
                        <tr><td style={labelTd}>Precio por TON</td><td style={valTd}>{lc ? n(lc.precio_por_ton) : '—'}</td></tr>
                      </tbody>
                    </table>
                  </div>
                </Col>

                {/* EMPAQUE */}
                <Col md={6} lg={4}>
                  <div className="rounded h-100" style={{ border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                    <div style={headerStyle}>BOLSA ROLLO + ENVOLTURA <span className="fw-normal ms-2" style={{ fontSize: '0.7rem' }}>Precio fijo</span></div>
                    <table className="table table-sm mb-0" style={{ fontSize: '0.78rem' }}>
                      <tbody>
                        <tr><td style={labelTd}>TON Bolsa Rollo</td><td style={inputTd}>{projInput('proyeccion_bolsa')}</td></tr>
                        <tr><td style={labelTd}>TON Envoltura</td><td style={inputTd}>{projInput('proyeccion_envoltura')}</td></tr>
                        <tr><td style={labelTd}>Precio Total Fijo (USD)</td><td style={inputTd}>{numInput('precio_empaque_fijo')}</td></tr>
                        <tr><td style={labelTd}>TRM</td><td style={{ ...valTd, ...calcStyle }}>{n(exposureParams.trm, 0)}</td></tr>
                        <tr><td style={{ ...labelTd, fontWeight: 700 }}>Exposición USD</td><td style={resultTd}>{emp ? fmtUsd(emp.exposicion_usd) : '—'}</td></tr>
                      </tbody>
                    </table>
                  </div>
                </Col>
              </Row>

              {/* Summary tables */}
              {exposureResult && (
                <>
                  <h6 style={{ color: '#7c3aed', fontWeight: 600 }}>Exposición por Commodity</h6>
                  <div className="table-responsive mb-3">
                    <table className="table table-sm table-bordered align-middle" style={{ fontSize: '0.82rem' }}>
                      <thead className="table-dark text-center">
                        <tr>
                          <th>Commodity</th>
                          <th>Exchange</th>
                          <th>Unidad</th>
                          <th>Precio Futuro</th>
                          <th>TON Total</th>
                          <th>Exposición USD</th>
                          <th>Precio/TON</th>
                        </tr>
                      </thead>
                      <tbody>
                        {exposureResult.commodities.map((c) => (
                          <tr key={c.nombre}>
                            <td style={{ color: '#7c3aed', fontWeight: 600 }}>{c.nombre}</td>
                            <td className="text-center">{c.exchange}</td>
                            <td className="text-center small">{c.unidad_cotizacion}</td>
                            <td className="text-end">{c.precio_futuro != null ? c.precio_futuro.toLocaleString('en-US') : '—'}</td>
                            <td className="text-end">{c.ton_total != null ? c.ton_total.toLocaleString('en-US') : '—'}</td>
                            <td className="text-end fw-bold">{fmtUsd(c.exposicion_usd)}</td>
                            <td className="text-end">{c.precio_por_ton != null ? fmtUsd(c.precio_por_ton) : '—'}</td>
                          </tr>
                        ))}
                        <tr className="fw-bold table-light" style={{ borderTop: '2px solid #7c3aed' }}>
                          <td colSpan={5} className="text-end">Total Commodities</td>
                          <td className="text-end">{fmtUsd(exposureResult.total_commodities_usd)}</td>
                          <td>{' '}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <h6 style={{ color: '#7c3aed', fontWeight: 600 }}>Resumen Exposición Compañía</h6>
                  <div className="table-responsive" style={{ maxWidth: 500 }}>
                    <table className="table table-sm table-bordered" style={{ fontSize: '0.85rem' }}>
                      <tbody>
                        <tr>
                          <td>Total Commodities</td>
                          <td className="text-end fw-bold">{fmtUsd(exposureResult.total_commodities_usd)}</td>
                        </tr>
                        <tr>
                          <td>Exposición Ventas Intl.</td>
                          <td className="text-end fw-bold">{fmtUsd(exposureResult.exposicion_ventas_intl)}</td>
                        </tr>
                        <tr style={{ background: '#dcfce7' }}>
                          <td className="fw-bold">Exposición Real USD</td>
                          <td className="text-end fw-bold">{fmtUsd(exposureResult.exposicion_real_usd)}</td>
                        </tr>
                        <tr>
                          <td>Exposición PEN (Perú)</td>
                          <td className="text-end">{fmtUsd(exposureResult.exposicion_pen)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          );
        })()}

        {/* ─── MATRICES TAB ─── */}
        {activeTab === 'matrices' && (() => {
          const matCell = { fontSize: '0.78rem', padding: '4px 8px', textAlign: 'right' as const };
          const matHeader = { fontSize: '0.78rem', padding: '4px 8px', fontWeight: 700, background: '#1e293b', color: '#fff' };
          const matRowHeader = { fontSize: '0.78rem', padding: '4px 8px', fontWeight: 600, background: '#f8fafc' };

          const contractLabel = (asset: string) => {
            const c = benchmarkFactors?.factors[asset]?.contract || benchmarkFactors?.contracts?.[asset];
            return c ? `${asset} (${c})` : asset;
          };

          const renderMatrix = (
            title: string,
            matrix: Record<string, Record<string, number | null>> | undefined,
            assetList: string[],
            decimals: number,
          ) => {
            if (!matrix || assetList.length === 0) return null;
            return (
              <div className="mb-4">
                <h6 style={{ color: '#7c3aed', fontWeight: 600 }}>{title}</h6>
                <div className="table-responsive">
                  <table className="table table-sm table-bordered mb-0" style={{ maxWidth: assetList.length * 160 + 140 }}>
                    <thead>
                      <tr>
                        <th style={matHeader} aria-label="Asset">{' '}</th>
                        {assetList.map((a) => (
                          <th key={a} style={{ ...matHeader, textAlign: 'center' }}>{contractLabel(a)}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {assetList.map((rowAsset) => (
                        <tr key={rowAsset}>
                          <td style={matRowHeader}>{contractLabel(rowAsset)}</td>
                          {assetList.map((colAsset) => {
                            const val = matrix[rowAsset]?.[colAsset];
                            const isDiag = rowAsset === colAsset;
                            return (
                              <td
                                key={colAsset}
                                style={{
                                  ...matCell,
                                  background: isDiag ? '#dbeafe' : undefined,
                                  fontWeight: isDiag ? 600 : undefined,
                                }}
                              >
                                {val != null ? val.toFixed(decimals) : '—'}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          };

          const bfAssets = benchmarkFactors?.assets || [];

          return (
            <>
              <Row className="align-items-end mb-3 g-2">
                <Col md={3}>
                  <Form.Label className="small mb-1">Fecha de referencia</Form.Label>
                  <Form.Control
                    type="date"
                    size="sm"
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                  />
                </Col>
                <Col md="auto">
                  <Button
                    size="sm"
                    onClick={handleFetchBenchmarkFactors}
                    disabled={benchmarkLoading}
                  >
                    <Icon icon={faSyncAlt} className="me-1" spin={benchmarkLoading} />
                    {benchmarkLoading ? 'Calculando...' : 'Calcular Matrices'}
                  </Button>
                  <MethodologyButton onClick={() => setMethModal('matrices')} />
                </Col>
              </Row>

              {!benchmarkFactors && !benchmarkLoading && (
                <p className="text-muted">Presione &quot;Calcular Matrices&quot; para generar las matrices de covarianza y correlación.</p>
              )}

              {benchmarkFactors && (
                <>
                  <div className="mb-3 p-2 rounded" style={{ background: '#f0fdf4', border: '1px solid #86efac', fontSize: '0.85rem' }}>
                    <div>
                      Periodo Precios (P&amp;L): <strong>{benchmarkFactors.period.start}</strong> → <strong>{benchmarkFactors.period.end}</strong>
                    </div>
                    {benchmarkFactors.covariance_period && (
                      <div>
                        Periodo Covarianza: <strong>{benchmarkFactors.covariance_period.start}</strong> → <strong>{benchmarkFactors.covariance_period.end}</strong>
                      </div>
                    )}
                    <div>Activos: <strong>{bfAssets.join(', ')}</strong></div>
                  </div>

                  {/* Varianza diaria (diagonal) */}
                  <div className="mb-4">
                    <h6 style={{ color: '#7c3aed', fontWeight: 600 }}>Varianza Diaria por Activo (diagonal de covarianza)</h6>
                    <div className="table-responsive">
                      <table className="table table-sm table-bordered mb-0" style={{ maxWidth: 620 }}>
                        <thead>
                          <tr>
                            <th style={matHeader}>Activo</th>
                            <th style={{ ...matHeader, textAlign: 'center' }}>Contrato</th>
                            <th style={{ ...matHeader, textAlign: 'center' }}>Obs.</th>
                            <th style={{ ...matHeader, textAlign: 'center' }}>Varianza Diaria</th>
                            <th style={{ ...matHeader, textAlign: 'center' }}>Volatilidad Diaria</th>
                            <th style={{ ...matHeader, textAlign: 'center' }}>Vol. Anualizada</th>
                          </tr>
                        </thead>
                        <tbody>
                          {bfAssets.map((asset) => {
                            const f = benchmarkFactors.factors[asset];
                            const dv = f?.daily_variance;
                            const contract = f?.contract || benchmarkFactors.contracts?.[asset] || '—';
                            const obs = benchmarkFactors.covariance_period?.observations?.[asset];
                            const vol = dv != null && dv > 0 ? Math.sqrt(dv) : null;
                            const volAnnual = vol != null ? vol * Math.sqrt(252) : null;
                            return (
                              <tr key={asset}>
                                <td style={matRowHeader}>{asset}</td>
                                <td style={{ ...matCell, textAlign: 'center', color: '#7c3aed', fontWeight: 600 }}>{contract}</td>
                                <td style={{ ...matCell, textAlign: 'center' }}>{obs ?? '—'}</td>
                                <td style={matCell}>{dv != null ? dv.toFixed(10) : '—'}</td>
                                <td style={matCell}>{vol != null ? `${(vol * 100).toFixed(4)}%` : '—'}</td>
                                <td style={matCell}>{volAnnual != null ? `${(volAnnual * 100).toFixed(2)}%` : '—'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {renderMatrix('Matriz de Covarianza', benchmarkFactors.covariance_matrix, bfAssets, 10)}
                  {renderMatrix('Matriz de Correlación', benchmarkFactors.correlation_matrix, bfAssets, 4)}
                </>
              )}
            </>
          );
        })()}
      </Container>

      {/* Methodology Modal */}
      <Modal show={methModal != null} onHide={() => setMethModal(null)} size="lg" scrollable>
        <Modal.Header closeButton style={{ background: '#1e293b' }}>
          <Modal.Title style={{ color: '#fff', fontSize: '1rem' }}>
            <Icon icon={faBookOpen} className="me-2" />
            {methModal && METHODOLOGY[methModal]?.title}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {methModal && METHODOLOGY[methModal]?.content}
        </Modal.Body>
      </Modal>
    </CoreLayout>
  );
}

export default RiskManagement;
