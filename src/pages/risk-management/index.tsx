'use client';

import { CoreLayout } from '@layout';
import { Row, Col, Form, Modal } from 'react-bootstrap';
import React, { useState, useCallback, useEffect } from 'react';
import Container from 'react-bootstrap/Container';
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import {
  faShieldAlt,
  faSyncAlt,
  faChartLine,
  faEdit,
  faChevronLeft,
  faChevronRight,
  faDollarSign,
  faBorderAll,
  faBookOpen,
  faFilePdf,
  faFileCsv,
  faBriefcase,
  faMugHot,
  faCalculator,
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
  ResponsiveContainer,
  Legend,
  ComposedChart,
  Area,
} from 'recharts';
import { fetchRollingVar, fetchBenchmarkFactors, fetchExposure, fetchFuturesPortfolio, upsertFuturesPositions, rollFuturesPosition, closeFuturesPosition, deleteFuturesPosition, editFuturesPosition } from 'src/models/risk/riskApi';
import { fetchCoffeePrices } from 'src/lib/risk/supabaseRisk';
import type { CoffeePriceRow } from 'src/lib/risk/supabaseRisk';
import { fetchUsdCopCalculator } from 'src/models/risk/usdcopCalculator';
import type { UsdCopData } from 'src/models/risk/usdcopCalculator';
import { calcularAkomelCop, calcularCebesMc35, calcularAlmidon, buildSuperFormulaCommodities, calcularCoberturaCafe } from 'src/lib/risk/exposureCalculator';
import type { RollingVarResponse, BenchmarkFactorsResponse, ExposureParams, ExposureResponse, MarketPrice, FuturesPosition, NewFuturesPosition } from 'src/types/risk';
import useAppStore from 'src/store';
// Company type no longer needed — global selector in CoreLayout
import RoleGuard from 'src/components/RoleGuard';
import { fetchCompanyRiskConfig, getAssetsWithCurrency, getChartColors, saveCompanyRiskConfig, COMMODITY_TEMPLATES, DEFAULT_EXPOSURE_PARAMS } from 'src/lib/risk/companyConfig';
import type { RiskCompanyConfig } from 'src/lib/risk/companyConfig';
import { parseContractMaturity } from 'src/lib/risk/futuresCalculator';

const PAGE_TITLE = 'Gestión de Riesgos';

const TAB_ITEMS: TabItemType[] = [
  { name: 'Benchmark', property: 'benchmark', icon: faEdit, active: true },
  { name: 'Rolling VaR', property: 'rolling', icon: faChartLine, active: false },
  { name: 'Exposición', property: 'exposure', icon: faDollarSign, active: false },
  { name: 'Matrices', property: 'matrices', icon: faBorderAll, active: false },
  { name: 'Portafolio GR', property: 'futures', icon: faBriefcase, active: false },
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

// VaR columns must be summed as absolute values (VaR is always a positive risk measure)
const ABS_SUM_COLUMNS = new Set(['var_super', 'var_gr', 'var_total', 'var_portfolio']);

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
  { key: 'position_super', label: 'Exposición Natural' },
  { key: 'position_gr', label: 'Portafolio GR' },
  { key: 'position_total', label: 'Total' },
  { key: 'var_super', label: 'VaR Exp. Natural' },
  { key: 'var_gr', label: 'VaR GR' },
  { key: 'var_total', label: 'VaR Total' },
  { key: 'factor_var_diario', label: 'Factor VaR Diario' },
  { key: 'factor_unit', label: 'Unidad' },
  { key: 'var_portfolio', label: 'Portafolio' },
  { key: 'price_start', label: 'Precio Inicio' },
  { key: 'price_end', label: 'Precio Fin' },
  { key: 'pnl_super', label: 'P&G Exp. Natural' },
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

/** Format a number as USD with thousands, no decimals: $1,000,000 */
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

/** Row style helper for futures table — total/subtotal/normal rows */
function getRowStyle(isTotal: boolean, isSubtotal: boolean): React.CSSProperties {
  if (isTotal) return { borderTop: '2px solid #1e293b' };
  if (isSubtotal) return { borderTop: '1px solid #cbd5e1', background: '#f8fafc' };
  return { borderBottom: '1px solid #f1f5f9' };
}

const fmtUsd = (v: number): string => {
  if (v === 0) return '';
  const prefix = v < 0 ? '-$' : '$';
  const abs = Math.abs(v);
  return prefix + abs.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
};

// Columns that should keep decimals in benchmark table
const DECIMAL_COLUMNS = new Set(['factor_var_diario', 'price_start', 'price_end']);

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
    if (dailyVar != null && dailyVar > 0 && grPos !== 0) {
      const volDaily = Math.sqrt(dailyVar);
      const trackingError = Math.abs(annualFactor * volDaily * grPos);
      if (trackingError !== 0) {
        const infoRatio = pnlGr / trackingError;
        next[i].information_ratio = infoRatio.toFixed(2);
      } else {
        next[i].information_ratio = '';
      }
    } else {
      next[i].information_ratio = '';
    }
  });

  // Total row = sum of each column
  const totalIdx = next.length - 1;
  SUM_COLUMNS.forEach((col) => {
    let sum = 0;
    assetRows.forEach((_, i) => {
      const val = parseDisplayValue(next[i][col]);
      sum += ABS_SUM_COLUMNS.has(col) ? Math.abs(val) : val;
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
  next[totalIdx].information_ratio = totalTrackingError !== 0
    ? (totalPnlGr / totalTrackingError).toFixed(2)
    : '';

  return next;
}

/* ─── PDF EXPORT ─── */

async function exportTabToPdf(elementId: string, fileName: string) {
  const { default: html2canvas } = await import('html2canvas');
  const { default: jsPDF } = await import('jspdf');

  const element = document.getElementById(elementId);
  if (!element) return;

  const buttons = element.querySelectorAll('button, .btn, select, input[type="date"]');
  const origDisplay: string[] = [];
  buttons.forEach((el, i) => {
    const htmlEl = el as HTMLElement;
    origDisplay[i] = htmlEl.style.display;
    htmlEl.style.display = 'none';
  });

  // scale 1.5 (vs 2) — ~44% pixel count, lectura sigue siendo crisp en A4
  const canvas = await html2canvas(element, {
    scale: 1.5,
    useCORS: true,
    backgroundColor: '#ffffff',
  });

  buttons.forEach((node, i) => {
    const htmlEl = node as HTMLElement;
    htmlEl.style.display = origDisplay[i];
  });

  // JPEG quality 0.82 — visualmente equivalente a PNG para texto/grafico, 5-10x mas chico
  const imgData = canvas.toDataURL('image/jpeg', 0.82);

  const margin = 10;
  // eslint-disable-next-line new-cap
  const pdf = new jsPDF({ orientation: 'l', unit: 'mm', format: 'a4', compress: true });
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();
  const contentWidth = pdfWidth - margin * 2;
  const contentHeight = pdfHeight - margin * 2;

  const imgAspect = canvas.height / canvas.width;
  const scaledHeight = contentWidth * imgAspect;

  if (scaledHeight <= contentHeight) {
    pdf.addImage(imgData, 'JPEG', margin, margin, contentWidth, scaledHeight, undefined, 'FAST');
  } else {
    let yOffset = 0;
    let page = 0;
    while (yOffset < scaledHeight) {
      if (page > 0) pdf.addPage();
      pdf.addImage(imgData, 'JPEG', margin, margin - yOffset, contentWidth, scaledHeight, undefined, 'FAST');
      yOffset += contentHeight;
      page += 1;
    }
  }

  pdf.save(fileName);
}

/* ─── CSV EXPORT ─── */

function tablesToCsv(element: HTMLElement): string {
  const escape = (s: string): string => {
    const trimmed = s.replace(/\s+/g, ' ').trim();
    if (/[",\n]/.test(trimmed)) return `"${trimmed.replace(/"/g, '""')}"`;
    return trimmed;
  };

  const sections: string[] = [];
  const tables = element.querySelectorAll('table');

  tables.forEach((table, tIdx) => {
    const rows: string[] = [];
    // Section title from preceding heading (h5/h6) if available
    let title = `Tabla ${tIdx + 1}`;
    const card = table.closest('.rounded, .table-responsive');
    const heading = card?.parentElement?.querySelector('h5, h6');
    if (heading?.textContent) title = heading.textContent.replace(/\s+/g, ' ').trim();
    rows.push(escape(title));

    table.querySelectorAll('tr').forEach((tr) => {
      const cells: string[] = [];
      tr.querySelectorAll('th, td').forEach((cell) => {
        // Skip action cells (buttons-only)
        const onlyButtons = cell.querySelector('button') && !cell.textContent?.replace(/\s/g, '').trim();
        if (onlyButtons) return;
        cells.push(escape(cell.textContent ?? ''));
      });
      if (cells.some((c) => c.length > 0)) rows.push(cells.join(','));
    });
    sections.push(rows.join('\n'));
  });

  return sections.join('\n\n');
}

async function exportTabToCsv(elementId: string, fileName: string) {
  const element = document.getElementById(elementId);
  if (!element) return;

  const csv = tablesToCsv(element);
  if (!csv.trim()) return;

  // BOM (U+FEFF) para que Excel detecte UTF-8
  const bom = String.fromCharCode(0xFEFF);
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function PdfButton({ elementId, fileName }: { elementId: string; fileName: string }) {
  return (
    <button
      type="button"
      className="btn btn-sm btn-outline-danger ms-2"
      onClick={() => exportTabToPdf(elementId, fileName)}
      title="Exportar a PDF"
    >
      <Icon icon={faFilePdf} className="me-1" />
      PDF
    </button>
  );
}

function CsvButton({ elementId, fileName }: { elementId: string; fileName: string }) {
  return (
    <button
      type="button"
      className="btn btn-sm btn-outline-success ms-2"
      onClick={() => exportTabToCsv(elementId, fileName)}
      title="Exportar a CSV"
    >
      <Icon icon={faFileCsv} className="me-1" />
      CSV
    </button>
  );
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
          <li><strong>Exposición Natural (Posición Benchmark):</strong> Se obtiene automáticamente del cálculo de Exposición. Representa la exposición natural de la compañía en USD por commodity.</li>
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
        <p>Representa la exposición neta de la compañía al dólar después de restar el consumo de materias primas. Este valor alimenta la columna Exposición Natural del activo USD en el Benchmark.</p>

        <p style={methH}>Precios de Mercado</p>
        <p>Los precios de los futuros se actualizan automáticamente. Los campos con fondo azul indican precios de mercado no editables, mostrando la fecha de cotización y el contrato utilizado. Los demás campos son editables y permiten ajustar manualmente los parámetros de cálculo.</p>

        <p style={methH}>Formulaciones Super de Alimentos (AKOMEL, CEBES, ALMIDÓN)</p>
        <p>Las 3 tarjetas adicionales calculan el precio unitario de cada materia prima transformada partiendo del mercado internacional (FOB/CIF + flete + arancel + TRM) y aplicando rendimientos de proceso y costos operativos. La TRM en cada tarjeta es no editable y se sincroniza con la TRM global de Xerenity (BanRep).</p>

        <p><strong>AKOMEL NH (aceite de palma Malasia → 3 productos):</strong></p>
        <div style={methFormula}>
          Paso 1 = Materia Prima (COP/KG) ÷ Rend. Impurezas+Humedad<br />
          Paso 2 = Paso 1 ÷ Rend. Acidez AAK<br />
          Precio Granel = Paso 2 + Costos Transf.<br />
          Precio SL / Sab = Paso 2 + Costos Transf. + Material Empaque
        </div>

        <p><strong>CEBES MC 35 (palmiste):</strong></p>
        <div style={methFormula}>
          Precio MP Planta = Materia Prima + (Prima Abast. / 1000) + Flete Extractora→Fábrica<br />
          Paso 1 = Precio MP Planta ÷ Rend. Impurezas+Humedad<br />
          Paso 2 = Paso 1 ÷ Rend. Acidez AAK<br />
          Precio CEBES = Paso 2 + Costos Transf. + Empaque + Financiamiento
        </div>

        <p><strong>ALMIDÓN (maíz CBOT ZC → almidón):</strong></p>
        <div style={methFormula}>
          Precio FOB (¢/bu) = Precio Futuro + Base<br />
          Precio FOB (USD/TON) = Precio FOB (¢/bu) × 0.01 ÷ 0.3937<br />
          Precio Maíz = Precio FOB + Flete Marítimo<br />
          Precio Neto Maíz = Precio Maíz × (1 − 26%) {/* crédito subproductos */}<br />
          Precio Almidón = Precio Neto Maíz × 1.60 {/* factor conversión */}
        </div>

        <p style={methH}>Exposición Natural USD (3 tarjetas nuevas)</p>
        <p>Cada tarjeta incluye un campo <strong>KG anual (compra)</strong> — el volumen que la compañía planea adquirir durante el año. La Exposición USD se calcula así:</p>
        <div style={methFormula}>
          AKOMEL / CEBES: Exp. USD = KG anual × Precio (COP/KG) ÷ TRM<br />
          ALMIDÓN:       Exp. USD = KG anual × Precio (USD/TON) ÷ 1000
        </div>
        <p>Para AKOMEL se muestra una fila <strong>Total Exposición AKOMEL USD</strong> que suma los 3 sub-productos (Granel + Sin Lecitina + Saborizado).</p>

        <p style={methH}>Conexión con la tabla &ldquo;Exposición por Commodity&rdquo;</p>
        <p>Los valores calculados dentro de cada tarjeta alimentan la tabla de resumen en tiempo real:</p>
        <ul>
          <li><strong>AKOMEL</strong> → una sola fila con el total de los 3 sub-productos.</li>
          <li><strong>CEBES_MC35</strong> → fila con la exposición del único producto.</li>
          <li><strong>ALMIDON</strong> → fila con la exposición del único producto.</li>
        </ul>
        <p>Estas 3 filas se suman al <strong>Total Commodities</strong> junto con AZÚCAR, MAÍZ, CACAO y EMPAQUE. Al editar cualquier KG o parámetro de las formulaciones, la tabla se actualiza inmediatamente sin necesidad de hacer clic en &ldquo;Actualizar&rdquo;.</p>
        <p>La <strong>Exposición Real USD</strong> también se recalcula en vivo: <code>Ventas Intl. − Total Commodities</code>.</p>
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

// ── Setup screen for companies without risk config ──
function CommoditySetup({ companyId, onSaved }: { companyId: string; onSaved: (cfg: RiskCompanyConfig) => void }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const toggleAsset = (asset: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(asset)) next.delete(asset);
      else next.add(asset);
      return next;
    });
  };

  const handleSave = async () => {
    // USD siempre se incluye por defecto via currency_asset. No forzamos la
    // seleccion de un commodity adicional — puede haber empresas que solo
    // gestionen FX (TRM/USDCOP) sin materias primas.
    setSaving(true);
    try {
      const commodities = COMMODITY_TEMPLATES.filter((c) => selected.has(c.asset));
      const cfg = await saveCompanyRiskConfig(companyId, commodities);
      toast.success('Configuración guardada');
      onSaved(cfg);
    } catch (e: unknown) {
      const msg = (e as Error)?.message || 'Error guardando configuración';
      // Log detallado para diagnostico (e.g. FK violation a trading.company)
      // eslint-disable-next-line no-console
      console.error('saveCompanyRiskConfig failed:', e);
      toast.error(msg, { autoClose: 8000 });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Container fluid className="p-4">
      <div className="text-center py-5">
        <Icon icon={faShieldAlt} size="3x" className="text-muted mb-3" />
        <h4>Configurar Gestión de Riesgos</h4>
        <p className="text-muted mb-4">
          Selecciona los commodities que tu empresa desea gestionar.
          Podrás modificar esta selección más adelante.
        </p>
        <Row className="justify-content-center mb-2">
          {/* Fixed USD card — always included as currency_asset */}
          <Col xs="auto" className="mb-2">
            <div
              title="USD se incluye automáticamente en todas las empresas como activo de divisa (TRM)"
              style={{
                padding: '12px 24px',
                borderRadius: 8,
                border: '2px solid #3b82f6',
                background: '#3b82f615',
                minWidth: 120,
                textAlign: 'center' as const,
                opacity: 0.9,
              }}
            >
              <div style={{ fontWeight: 600, color: '#3b82f6' }}>
                USD
                <span style={{ fontSize: '0.65rem', color: '#94a3b8', marginLeft: 4 }}>(fijo)</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                BanRep — TRM
              </div>
            </div>
          </Col>
          {COMMODITY_TEMPLATES.map((c) => (
            <Col key={c.asset} xs="auto" className="mb-2">
              <div
                role="button"
                tabIndex={0}
                onClick={() => toggleAsset(c.asset)}
                onKeyDown={(e) => e.key === 'Enter' && toggleAsset(c.asset)}
                style={{
                  padding: '12px 24px',
                  borderRadius: 8,
                  border: selected.has(c.asset) ? `2px solid ${c.chart_color}` : '2px solid #e2e8f0',
                  background: selected.has(c.asset) ? `${c.chart_color}15` : '#fff',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  minWidth: 120,
                  textAlign: 'center' as const,
                }}
              >
                <div style={{ fontWeight: 600, color: selected.has(c.asset) ? c.chart_color : '#64748b' }}>
                  {c.asset}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                  {c.exchange} — {c.symbol}
                </div>
              </div>
            </Col>
          ))}
        </Row>
        <p className="text-muted mb-4" style={{ fontSize: '0.8rem' }}>
          USD/COP (TRM) se incluye automáticamente. Puedes continuar sin commodities
          si tu empresa solo gestiona FX.
        </p>
        {/* Button con display:flex (del styled wrapper) no se centra con text-align,
            asi que lo envolvemos en un flex container centrado. */}
        <div className="d-flex justify-content-center">
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={saving}
          >
            {(() => {
              if (saving) return 'Guardando...';
              if (selected.size === 0) return 'Continuar solo con USD';
              return `Configurar ${selected.size} commodity${selected.size !== 1 ? 's' : ''} + USD`;
            })()}
          </Button>
        </div>
      </div>
    </Container>
  );
}

function RiskManagement() {
  const { userProfile, isSuperAdmin, selectedCompanyId, setSelectedCompanyId } = useAppStore();

  // Set default company to user's own company (if not already selected by global selector)
  useEffect(() => {
    if (userProfile?.company_id && !selectedCompanyId) {
      setSelectedCompanyId(userProfile.company_id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile?.company_id]);

  // Company risk configuration (commodities, multipliers, exposure params)
  const [companyConfig, setCompanyConfig] = useState<RiskCompanyConfig | null>(null);
  const [, setConfigLoading] = useState(false);

  useEffect(() => {
    if (!selectedCompanyId) return;
    setConfigLoading(true);
    fetchCompanyRiskConfig(selectedCompanyId)
      .then((cfg) => setCompanyConfig(cfg))
      .catch(() => setCompanyConfig(null))
      .finally(() => setConfigLoading(false));
  }, [selectedCompanyId]);

  // Dynamic assets and colors from config (fallback to defaults)
  const dynamicAssets = companyConfig ? getAssetsWithCurrency(companyConfig) : DEFAULT_ASSETS;
  const dynamicColors = companyConfig ? getChartColors(companyConfig) : CHART_COLORS;

  // Check if this company has CAFE in its commodities (for conditional tabs)
  const hasCafe = companyConfig?.commodities?.some((c) => c.asset === 'CAFE') ?? false;

  const [activeTab, setActiveTab] = useState('benchmark');
  // Build tabs dynamically: add "Precios Locales" if CAFE, + "Calculadora USDCOP" always
  const [pageTabs, setPageTabs] = useState<TabItemType[]>(TAB_ITEMS);
  useEffect(() => {
    const baseTabs = [...TAB_ITEMS];
    if (hasCafe) {
      baseTabs.push({ name: 'Precios Locales', property: 'coffee', icon: faMugHot, active: false });
    }
    // Calculadora USDCOP disponible para TODAS las empresas (depende del USD, no de un commodity)
    baseTabs.push({ name: 'Calculadora USDCOP', property: 'usdcop', icon: faCalculator, active: false });
    setPageTabs(baseTabs.map((t) => ({ ...t, active: t.property === activeTab })));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasCafe]);

  // Coffee prices state (only used when hasCafe)
  const [coffeePrices, setCoffeePrices] = useState<CoffeePriceRow[]>([]);
  const [coffeeLoading, setCoffeeLoading] = useState(false);
  const [fncDateFrom, setFncDateFrom] = useState('');
  const [fncDateTo, setFncDateTo] = useState('');

  // USDCOP calculator state
  const [usdcopData, setUsdcopData] = useState<UsdCopData | null>(null);
  const [usdcopLoading, setUsdcopLoading] = useState(false);
  const [usdcopDays, setUsdcopDays] = useState(30);
  const [usdcopSigma, setUsdcopSigma] = useState(2.0);
  const [filterDate, setFilterDate] = useState(defaultDate());

  // OTC store handles — used by Benchmark USD row auto-fill
  const otcSummary = useAppStore((s) => s.summary) as { total_npv_cop: number; total_npv_usd: number } | undefined;
  const pricedXccyStore = useAppStore((s) => s.pricedXccy);
  const pricedNdfStore = useAppStore((s) => s.pricedNdf);
  const refPricesStore = useAppStore((s) => s.refPrices);

  // OTC store actions: needed to populate USD row dinamicamente per mes.
  // Sin esto, los stores empiezan vacios y la fila USD quedaba en 0/0 a
  // menos que el usuario hubiera visitado primero el tab Portafolio OTC.
  const loadOtcPositions = useAppStore((s) => s.loadPositions);
  const repriceWithMark = useAppStore((s) => s.repriceAllWithMark);
  const loadOtcRefPrices = useAppStore((s) => s.loadReferencePrices);

  // Methodology modal
  const [methModal, setMethModal] = useState<string | null>(null);

  // Confidence level
  const [confidenceLevel, setConfidenceLevel] = useState(0.99);

  // Benchmark state
  const [assets, setAssets] = useState<string[]>(dynamicAssets);
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
  // selectedAsset arranca vacio; se auto-selecciona el primer commodity del
  // config via useEffect abajo. Asi empresas que NO tienen MAIZ (e.g. El
  // Embrujo con CAFE, Los Coches con solo USD) no muestran el placeholder
  // "MAIZ" vacio por defecto.
  const [selectedAsset, setSelectedAsset] = useState('');

  // Auto-seleccionar el primer asset disponible cuando cambian los assets
  // de la empresa o cuando el asset actual ya no esta en la lista.
  useEffect(() => {
    if (assets.length === 0) {
      if (selectedAsset) setSelectedAsset('');
      return;
    }
    if (!selectedAsset || !assets.includes(selectedAsset)) {
      setSelectedAsset(assets[0]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assets]);

  // Exposure state — defaults extraidos a companyConfig.ts para que /risk-resumen
  // pueda usar los mismos parametros sin duplicar el hardcode.
  const [exposureParams, setExposureParams] = useState<ExposureParams>(DEFAULT_EXPOSURE_PARAMS);
  const [exposureResult, setExposureResult] = useState<ExposureResponse | null>(null);
  const [exposureLoading, setExposureLoading] = useState(false);

  // Futures Portfolio state
  const [futuresPortfolio, setFuturesPortfolio] = useState<FuturesPosition[]>([]);
  const [futuresLoading, setFuturesLoading] = useState(false);
  const [futuresShowClosed, setFuturesShowClosed] = useState(false);
  const [futuresShowAddForm, setFuturesShowAddForm] = useState(false);
  const [expandedSpreads, setExpandedSpreads] = useState<Set<string>>(new Set());
  const [futuresMonth, setFuturesMonth] = useState(currentMonth());
  const [newPosition, setNewPosition] = useState<NewFuturesPosition>({
    asset: 'MAIZ', contract: '', direction: 'SHORT', nominal: 1, entry_price: 0, entry_date: defaultDate(),
  });
  // Roll modal
  const [rollModal, setRollModal] = useState<FuturesPosition | null>(null);
  const [rollContract, setRollContract] = useState('');
  const [rollPrice, setRollPrice] = useState('');
  const [rollEntryPrice, setRollEntryPrice] = useState('');
  // Close modal
  const [closeModal, setCloseModal] = useState<FuturesPosition | null>(null);
  const [closePrice, setClosePrice] = useState('');
  // Edit modal
  const [editModal, setEditModal] = useState<FuturesPosition | null>(null);
  const [editFields, setEditFields] = useState<Partial<NewFuturesPosition>>({});

  const handleTabChange = (tabProp: string) => {
    setActiveTab(tabProp);
    setPageTabs((prev) =>
      prev.map((tab) => ({ ...tab, active: tab.property === tabProp }))
    );
  };

  const handleFetchRolling = useCallback(async () => {
    setRollingLoading(true);
    try {
      const data = await fetchRollingVar(filterDate, confidenceLevel, companyConfig);
      setRollingData(data);
    } catch (e: unknown) {
      toast.error((e as Error)?.message || 'Error obteniendo rolling VaR');
    } finally {
      setRollingLoading(false);
    }
  }, [filterDate, confidenceLevel, companyConfig]);

  const benchmarkDateStr = lastDayOfMonth(benchmarkMonth.year, benchmarkMonth.month);
  const benchmarkMonthKey = monthKey(benchmarkMonth.year, benchmarkMonth.month);

  const handleFetchBenchmarkFactors = useCallback(async () => {
    setBenchmarkLoading(true);
    try {
      const data = await fetchBenchmarkFactors(benchmarkDateStr, confidenceLevel, companyConfig);
      setBenchmarkFactors(data);

      // Use assets filtrados por la empresa (companyConfig). Fallback al
      // dynamicAssets que viene del config (no a DEFAULT_ASSETS, que son los
      // de Super de Alimentos).
      const backendAssets = data.assets && data.assets.length > 0 ? data.assets : dynamicAssets;
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

      if (data.assets.length > 0) {
        toast.success(`${MONTH_NAMES[benchmarkMonth.month]} ${benchmarkMonth.year} (${data.period.start} → ${data.period.end})`);
      } else {
        toast.info(`Sin datos de mercado para los commodities de esta empresa`);
      }
    } catch (e: unknown) {
      toast.error((e as Error)?.message || 'Error obteniendo factores');
    } finally {
      setBenchmarkLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [benchmarkDateStr, benchmarkMonthKey, confidenceLevel, companyConfig, dynamicAssets]);

  // Auto-load OTC data cuando cambia el mes o la empresa, para que la fila
  // USD del Benchmark se llene dinamicamente (FX Delta + P&L MTD USD).
  // Mismo patron que /risk-resumen:
  //   1) loadPositions(company) si el store esta vacio
  //   2) repriceAllWithMark(benchmarkDateStr) — valor con curvas EOD
  //   3) loadReferencePrices(benchmarkDateStr) — MTD ref para P&L
  // Cuando el store se actualiza, el useEffect que rellena position_gr/pnl_gr
  // (mas abajo, dependency: pricedXccyStore/pricedNdfStore/refPricesStore)
  // se re-ejecuta automaticamente y rellena USD.
  useEffect(() => {
    if (!selectedCompanyId) return;
    let cancelled = false;
    (async () => {
      try {
        const hasOtc = (pricedXccyStore?.length ?? 0) + (pricedNdfStore?.length ?? 0) > 0;
        if (!hasOtc) {
          await loadOtcPositions(selectedCompanyId);
        }
        if (cancelled) return;
        await repriceWithMark(benchmarkDateStr);
        if (cancelled) return;
        await loadOtcRefPrices(benchmarkDateStr);
      } catch (e) {
        // Silent fail — la fila USD quedara en 0/0 pero el resto del
        // benchmark sigue mostrandose normalmente.
        // eslint-disable-next-line no-console
        console.warn('Benchmark: error cargando OTC para USD row', e);
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [benchmarkDateStr, selectedCompanyId]);

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

  const handleFetchExposure = useCallback(async (overrideDate?: string) => {
    // Si la empresa no tiene parametros de proyeccion configurados, NO calculamos
    // exposicion. Los DEFAULT_EXPOSURE_PARAMS son hardcodeados con valores
    // especificos de Super de Alimentos (toneladas, fletes, processing fees, etc),
    // y aplicarlos a cualquier otra empresa = mostrar datos incorrectos / data leak.
    //
    // Para empresas nuevas que aun no tienen exposure_defaults poblados en
    // risk_company_config, dejamos exposureResult = null. position_super queda
    // en blanco en el Benchmark hasta que se implemente un formulario generico
    // de exposicion por empresa.
    const hasExposureConfig = companyConfig?.exposure_defaults
      && Object.keys(companyConfig.exposure_defaults).length > 0;
    if (!hasExposureConfig) {
      setExposureResult(null);
      return;
    }

    setExposureLoading(true);
    try {
      const dateToUse = overrideDate ?? filterDate;
      // Super de Alimentos: incluir las 3 formulaciones (AKOMEL, CEBES, ALMIDON)
      // en el calculo total. Para otras empresas no se incluyen (exposicion_usd = 0).
      const SUPER_ID = 'e8516f19-7286-4e04-a63e-24ca9364d807';
      const isSuper = selectedCompanyId === SUPER_ID;
      const data = await fetchExposure(dateToUse, exposureParams, { includeSuperFormulas: isSuper });
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
  }, [filterDate, exposureParams, companyConfig]);

  // Solo cargar datos cuando el companyConfig este listo (para filtrar por
  // los commodities de la empresa). Si se dispara con companyConfig=null,
  // fetchBenchmarkFactors trae TODOS los assets de risk_prices (data leak).
  useEffect(() => {
    if (!companyConfig) return;
    handleFetchBenchmarkFactors();
    handleFetchExposure(benchmarkDateStr);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyConfig]);

  // ── Futures Portfolio handlers ──
  const futuresFilterDate = lastDayOfMonth(futuresMonth.year, futuresMonth.month);

  const handleFetchFutures = useCallback(async () => {
    setFuturesLoading(true);
    try {
      const data = await fetchFuturesPortfolio(futuresFilterDate, !futuresShowClosed, selectedCompanyId, companyConfig?.commodities);
      setFuturesPortfolio(data.portfolio);
    } catch (e: unknown) {
      toast.error((e as Error)?.message || 'Error cargando portafolio de futuros');
    } finally {
      setFuturesLoading(false);
    }
  }, [futuresFilterDate, futuresShowClosed, selectedCompanyId, companyConfig]);

  const handleAddPosition = useCallback(async () => {
    if (!newPosition.contract || !newPosition.entry_price) {
      toast.error('Contrato y precio de compra son requeridos');
      return;
    }
    try {
      await upsertFuturesPositions(futuresFilterDate, [newPosition], selectedCompanyId);
      toast.success('Posición creada');
      setFuturesShowAddForm(false);
      setNewPosition({ asset: 'MAIZ', contract: '', direction: 'SHORT', nominal: 1, entry_price: 0, entry_date: defaultDate() });
      handleFetchFutures();
    } catch (e: unknown) {
      toast.error((e as Error)?.message || 'Error creando posición');
    }
  }, [filterDate, newPosition, handleFetchFutures]);

  const handleRoll = useCallback(async () => {
    if (!rollModal?.id || !rollContract || !rollPrice) return;
    try {
      await rollFuturesPosition(futuresFilterDate, {
        position_id: rollModal.id,
        new_contract: rollContract,
        roll_price: parseFloat(rollPrice),
        new_entry_price: rollEntryPrice ? parseFloat(rollEntryPrice) : undefined,
        roll_date: futuresFilterDate,
      });
      toast.success(`Roll completado: ${rollModal.contract} → ${rollContract}`);
      setRollModal(null);
      setRollContract('');
      setRollPrice('');
      setRollEntryPrice('');
      handleFetchFutures();
    } catch (e: unknown) {
      toast.error((e as Error)?.message || 'Error en roll');
    }
  }, [filterDate, rollModal, rollContract, rollPrice, rollEntryPrice, handleFetchFutures]);

  const handleClose = useCallback(async () => {
    if (!closeModal?.id || !closePrice) return;
    try {
      await closeFuturesPosition(futuresFilterDate, {
        position_id: closeModal.id,
        closed_price: parseFloat(closePrice),
        closed_date: futuresFilterDate,
      });
      toast.success('Posición cerrada');
      setCloseModal(null);
      setClosePrice('');
      handleFetchFutures();
    } catch (e: unknown) {
      toast.error((e as Error)?.message || 'Error cerrando posición');
    }
  }, [filterDate, closeModal, closePrice, handleFetchFutures]);

  const handleDelete = useCallback(async (pos: FuturesPosition) => {
    if (!pos.id) return;
    if (!window.confirm(`Eliminar posición ${pos.asset} ${pos.contract} ${pos.direction} x${pos.nominal}?`)) return;
    try {
      await deleteFuturesPosition(futuresFilterDate, pos.id);
      toast.success('Posición eliminada');
      handleFetchFutures();
    } catch (e: unknown) {
      toast.error((e as Error)?.message || 'Error eliminando posición');
    }
  }, [filterDate, handleFetchFutures]);

  const handleEdit = useCallback(async () => {
    if (!editModal?.id || Object.keys(editFields).length === 0) return;
    try {
      await editFuturesPosition(futuresFilterDate, { position_id: editModal.id, updates: editFields });
      toast.success('Posición actualizada');
      setEditModal(null);
      setEditFields({});
      handleFetchFutures();
    } catch (e: unknown) {
      toast.error((e as Error)?.message || 'Error editando posición');
    }
  }, [filterDate, editModal, editFields, handleFetchFutures]);

  const handleFetchCoffeePrices = useCallback(async () => {
    setCoffeeLoading(true);
    try {
      const data = await fetchCoffeePrices();
      setCoffeePrices(data);
    } catch (e: unknown) {
      toast.error((e as Error)?.message || 'Error cargando precios de café');
    } finally {
      setCoffeeLoading(false);
    }
  }, []);

  const handleFetchUsdcop = useCallback(async () => {
    setUsdcopLoading(true);
    try {
      const data = await fetchUsdCopCalculator();
      setUsdcopData(data);
    } catch (e: unknown) {
      toast.error((e as Error)?.message || 'Error cargando calculadora USDCOP');
    } finally {
      setUsdcopLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!companyConfig) return; // guard: esperar a que config cargue
    if (activeTab === 'rolling') handleFetchRolling();
    if (activeTab === 'benchmark') {
      handleFetchBenchmarkFactors();
      handleFetchFutures();
      handleFetchExposure(benchmarkDateStr);
    }
    if (activeTab === 'futures') handleFetchFutures();
    if (activeTab === 'coffee') handleFetchCoffeePrices();
    if (activeTab === 'usdcop' && !usdcopData) handleFetchUsdcop();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, futuresMonth, benchmarkDateStr, companyConfig]);

  // Sync futuresMonth with benchmarkMonth (both views show the same period)
  useEffect(() => {
    setFuturesMonth(benchmarkMonth);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [benchmarkMonth]);

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

  // When futures portfolio or benchmark month changes, auto-fill position_gr and pnl_gr
  // Solo se incluyen posiciones con entry_date <= benchmarkDateStr (filtro que
  // ya hizo calculateFuturesPortfolio antes de poblar futuresPortfolio).
  useEffect(() => {
    setBenchmarkRows((prev) => {
      const next = prev.map((r) => ({ ...r }));

      next.forEach((row, i) => {
        if (row.asset === 'Total') return;

        // ── USD row: fed dinamicamente del OTC store (FX Delta + P&L MTD USD) ──
        // El useEffect de mas arriba dispara loadOtcPositions + repriceWithMark
        // + loadOtcRefPrices cuando cambia benchmarkDateStr o selectedCompanyId,
        // poblando los stores. Aqui simplemente se leen.
        //   position_gr = sum(fx_delta) de XCCY + NDF al benchmarkDateStr
        //   pnl_gr      = total_npv_usd - refPrices.mtd.summary.total_npv_usd
        if (row.asset === 'USD') {
          const fxDeltaTotal = (pricedXccyStore ?? []).reduce((s, p) => s + (p.fx_delta ?? 0), 0)
            + (pricedNdfStore ?? []).reduce((s, p) => s + (p.fx_delta ?? 0), 0);
          const mtdRef = refPricesStore?.mtd;
          const pnlMtdUsd = (otcSummary && mtdRef)
            ? otcSummary.total_npv_usd - mtdRef.summary.total_npv_usd
            : 0;
          next[i].position_gr = String(Math.round(fxDeltaTotal));
          next[i].pnl_gr = String(Math.round(pnlMtdUsd));
          return;
        }

        // Lookup el subtotal row del Portafolio GR tab para este activo.
        // Single source of truth: las dos pestañas (Benchmark y Portafolio GR)
        // deben mostrar los mismos numeros para Valor Compra y P&L Mes.
        //
        // Antes: aqui se recalculaba con el FRONT contract price para todos los
        // contratos del activo (lineas 1380-1404 del codigo anterior). Esto
        // producia errores de hasta $20K en el P&G GR para AZUCAR/MAIZ porque
        // contratos lejanos (SBH27, SBV27, ZCK27, ZCN27) tienen precios muy
        // distintos al front (SBN26, ZCN26).
        //
        // Ahora: leer directo del subtotal del Portafolio GR (que usa precios
        // per-contract de risk_prices_all_contracts).
        const subtotalRow = (futuresPortfolio ?? []).find((p) => p.asset === `Total ${row.asset}`);
        if (subtotalRow) {
          next[i].position_gr = String(subtotalRow.valor_compra ?? 0);
          next[i].pnl_gr = String(subtotalRow.pnl_month ?? 0);
        } else {
          next[i].position_gr = '0';
          next[i].pnl_gr = '0';
        }
      });

      return recalcBenchmark(next, varianceMap);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [futuresPortfolio, varianceMap, benchmarkDateStr, otcSummary, pricedXccyStore, pricedNdfStore, refPricesStore]);

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
      <RoleGuard requiredRole="corp_admin" fallback={
        <Container fluid className="p-4">
          <p className="text-muted">No tienes acceso a esta sección. Contacta a tu administrador.</p>
        </Container>
      }>
      {/* No company assigned — non-admin users see message */}
      {!selectedCompanyId && userProfile && !isSuperAdmin() && (
        <Container fluid className="p-4 text-center py-5">
          <Icon icon={faShieldAlt} size="3x" className="text-muted mb-3" />
          <h5>Sin empresa asignada</h5>
          <p className="text-muted">Tu cuenta no tiene una empresa asociada. Contacta a tu administrador para configurar el acceso al módulo de riesgos.</p>
        </Container>
      )}
      {/* Super admin without company — prompt to use global selector */}
      {!selectedCompanyId && isSuperAdmin() && (
        <Container fluid className="p-4 text-center py-5">
          <Icon icon={faShieldAlt} size="3x" className="text-muted mb-3" />
          <h5>Selecciona una empresa</h5>
          <p className="text-muted">Usa el selector de empresa en la barra superior para ver la gestión de riesgos.</p>
        </Container>
      )}
      {/* Show setup screen if company has no risk config */}
      {!companyConfig && selectedCompanyId && (
        <CommoditySetup companyId={selectedCompanyId} onSaved={(cfg) => setCompanyConfig(cfg)} />
      )}
      {/* Show main content only when company has config */}
      {companyConfig && (
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


        {/* ─── BENCHMARK TAB ─── */}
        {activeTab === 'benchmark' && (
          <div id="pdf-benchmark">
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
                <PdfButton elementId="pdf-benchmark" fileName="benchmark.pdf" />
                <CsvButton elementId="pdf-benchmark" fileName="benchmark.csv" />
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
                <Col className="d-flex align-items-center gap-3 small text-muted">
                  <span>
                    Precio Inicio: <strong>{benchmarkFactors.period.start}</strong>
                  </span>
                  <span>
                    Precio Fin: <strong>{benchmarkFactors.period.end}</strong>
                  </span>
                  {benchmarkFactors.z_score && (
                    <span>Z-score: <strong>{benchmarkFactors.z_score}</strong></span>
                  )}
                </Col>
              )}
            </Row>

            <p className="small text-muted mb-3">
              <span style={{ background: '#dbeafe', padding: '1px 6px', borderRadius: 3, color: '#1e40af' }}>Exposición Natural</span> desde Exposición ·
              <span style={{ background: '#fefce8', padding: '1px 6px', borderRadius: 3, color: '#854d0e', marginLeft: 4 }}>Portafolio GR</span> y P&G GR desde Portafolio GR.
              Los demás campos se calculan automáticamente.
            </p>

            {benchmarkLoading && <p className="text-muted">Cargando factores...</p>}

            <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
            <div className="table-responsive">
              <table className="table table-sm align-middle mb-0" style={{ fontSize: '0.78rem', borderCollapse: 'separate', borderSpacing: 0 }}>
                <thead style={{ fontSize: '0.7rem', color: '#64748b' }}>
                  <tr>
                    <th rowSpan={2} style={{ verticalAlign: 'middle', borderBottom: '2px solid #e2e8f0', padding: '8px 6px' }}>Activo</th>
                    <th colSpan={3} className="text-center" style={{ borderBottom: '1px solid #e2e8f0', padding: '6px', color: '#1e293b', fontWeight: 700 }}>Posiciones</th>
                    <th colSpan={3} className="text-center" style={{ borderBottom: '1px solid #e2e8f0', padding: '6px', color: '#1e293b', fontWeight: 700 }}>VaR Diario</th>
                    <th colSpan={2} className="text-center" style={{ borderBottom: '1px solid #e2e8f0', padding: '6px', color: '#1e293b', fontWeight: 700 }}>Factor VaR</th>
                    <th rowSpan={2} className="text-end" style={{ verticalAlign: 'middle', borderBottom: '2px solid #e2e8f0', padding: '8px 6px' }}>Portafolio</th>
                    <th colSpan={2} className="text-center" style={{ borderBottom: '1px solid #e2e8f0', padding: '6px', color: '#1e293b', fontWeight: 700 }}>Precios</th>
                    <th colSpan={3} className="text-center" style={{ borderBottom: '1px solid #e2e8f0', padding: '6px', color: '#1e293b', fontWeight: 700 }}>P&amp;G</th>
                    <th rowSpan={2} className="text-end" style={{ verticalAlign: 'middle', borderBottom: '2px solid #e2e8f0', padding: '8px 6px' }}>Info Ratio</th>
                  </tr>
                  <tr>
                    <th className="text-end" style={{ borderBottom: '2px solid #e2e8f0', padding: '6px 4px', color: '#1e40af' }}>Exp. Natural</th>
                    <th className="text-end" style={{ borderBottom: '2px solid #e2e8f0', padding: '6px 4px', color: '#854d0e' }}>Portafolio GR</th>
                    <th className="text-end" style={{ borderBottom: '2px solid #e2e8f0', padding: '6px 4px' }}>Total</th>
                    <th className="text-end" style={{ borderBottom: '2px solid #e2e8f0', padding: '6px 4px' }}>Super</th>
                    <th className="text-end" style={{ borderBottom: '2px solid #e2e8f0', padding: '6px 4px', color: '#854d0e' }}>GR</th>
                    <th className="text-end" style={{ borderBottom: '2px solid #e2e8f0', padding: '6px 4px' }}>Total</th>
                    <th className="text-end" style={{ borderBottom: '2px solid #e2e8f0', padding: '6px 4px' }}>Diario %</th>
                    <th className="text-center" style={{ borderBottom: '2px solid #e2e8f0', padding: '6px 4px' }}>Unidad</th>
                    <th className="text-end" style={{ borderBottom: '2px solid #e2e8f0', padding: '6px 4px' }}>Inicio</th>
                    <th className="text-end" style={{ borderBottom: '2px solid #e2e8f0', padding: '6px 4px' }}>Fin</th>
                    <th className="text-end" style={{ borderBottom: '2px solid #e2e8f0', padding: '6px 4px' }}>Super</th>
                    <th className="text-end" style={{ borderBottom: '2px solid #e2e8f0', padding: '6px 4px', color: '#854d0e' }}>GR</th>
                    <th className="text-end" style={{ borderBottom: '2px solid #e2e8f0', padding: '6px 4px' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {benchmarkRows.map((row) => {
                    const isTotal = row.asset === 'Total';
                    return (
                      <tr
                        key={row.asset}
                        style={isTotal ? { borderTop: '2px solid #1e293b', fontWeight: 700 } : { borderBottom: '1px solid #f1f5f9' }}
                      >
                        {BENCHMARK_COLUMNS.map((col) => {
                          const isManual = MANUAL_COLUMNS.has(col.key) && !isTotal;
                          const isUsd = USD_COLUMNS.has(col.key);
                          const rawNum = parseDisplayValue(row[col.key]);

                          if (col.key === 'asset') {
                            return (
                              <td key={col.key} style={{ color: isTotal ? '#1e293b' : '#7c3aed', fontWeight: 600, padding: '8px 6px' }}>
                                {row.asset}
                                {row.contract && !isTotal && (
                                  <span className="ms-1" style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 400 }}>
                                    ({row.contract})
                                  </span>
                                )}
                              </td>
                            );
                          }

                          // position_super: auto-filled from exposure (read-only, blue accent)
                          if (col.key === 'position_super' && !isTotal) {
                            return (
                              <td key={col.key} className="text-end" style={{ padding: '6px 4px', color: '#1e40af', fontWeight: 500 }}>
                                {isUsd && rawNum !== 0 ? fmtUsd(rawNum) : (row[col.key] || '—')}
                              </td>
                            );
                          }

                          // GR cells (position_gr, pnl_gr) — auto-filled from Portafolio GR (read-only)
                          if (isManual) {
                            return (
                              <td key={col.key} className="text-end" style={{ padding: '6px 4px', color: '#854d0e', fontWeight: 500 }}>
                                {isUsd && rawNum !== 0 ? fmtUsd(rawNum) : (row[col.key] || '—')}
                              </td>
                            );
                          }

                          // Read-only cells (all computed + factor/prices from backend)
                          let displayVal = row[col.key] || '—';
                          if (col.key === 'factor_var_diario' && row[col.key]) {
                            displayVal = `${parseFloat(row[col.key]).toFixed(2)}%`;
                          } else if (col.key === 'information_ratio' && row[col.key]) {
                            displayVal = parseFloat(row[col.key]).toFixed(2);
                          } else if (DECIMAL_COLUMNS.has(col.key) && rawNum !== 0) {
                            // Prices keep decimals
                            displayVal = rawNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                          } else if (isUsd && rawNum !== 0) {
                            displayVal = fmtUsd(rawNum);
                          } else if (!DECIMAL_COLUMNS.has(col.key) && rawNum !== 0 && row[col.key]) {
                            // Non-decimal columns: round to integer
                            displayVal = Math.round(rawNum).toLocaleString('en-US');
                          }

                          return (
                            <td key={col.key} className={`text-end ${isTotal ? '' : 'text-muted'}`} style={{ padding: '6px 4px' }}>
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
            </div>
          </div>
        )}

        {/* ─── ROLLING VAR TAB ─── */}
        {activeTab === 'rolling' && (
          <div id="pdf-rolling">
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
                <PdfButton elementId="pdf-rolling" fileName="rolling_var.pdf" />
                <CsvButton elementId="pdf-rolling" fileName="rolling_var.csv" />
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
                        <h6 className="mb-3" style={{ color: dynamicColors[selectedAsset] || '#7c3aed' }}>
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
                            <Line type="monotone" dataKey="value" stroke={dynamicColors[selectedAsset] || '#7c3aed'} dot={false} strokeWidth={2} />
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
                        <h6 className="mb-2" style={{ color: dynamicColors[asset], fontWeight: 600 }}>
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
                                  <Line type="monotone" dataKey="value" stroke={dynamicColors[asset]} dot={false} strokeWidth={2} />
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

                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* ─── EXPOSICIÓN TAB ─── */}
        {activeTab === 'exposure' && (!companyConfig?.exposure_defaults || Object.keys(companyConfig.exposure_defaults).length === 0) && !hasCafe && (
          <div className="text-center py-5">
            <Icon icon={faShieldAlt} size="2x" className="text-muted mb-3" />
            <h5 className="text-muted">Exposición no configurada</h5>
            <p className="text-muted" style={{ maxWidth: 500, margin: '0 auto' }}>
              Esta empresa aún no tiene parámetros de proyección de exposición configurados.
              Los cuadros de conversión (toneladas, fletes, processing fees, etc.) se configuran
              por empresa según sus materias primas específicas.
            </p>
          </div>
        )}
        {activeTab === 'exposure' && (((companyConfig?.exposure_defaults && Object.keys(companyConfig.exposure_defaults).length > 0)) || hasCafe) && (() => {
          const hasExposureDefaults = !!(companyConfig?.exposure_defaults && Object.keys(companyConfig.exposure_defaults).length > 0);
          const inputStyle = { fontSize: '0.78rem' };
          const calcStyle = { fontSize: '0.78rem', color: '#475569' };
          const headerStyle = { color: '#7c3aed', fontSize: '0.85rem', fontWeight: 700, padding: '12px 14px', borderBottom: '1px solid #e2e8f0' };
          const labelTd = { fontSize: '0.75rem', padding: '5px 10px', color: '#64748b', borderTop: '1px solid #f1f5f9' };
          const valTd = { fontSize: '0.78rem', padding: '5px 10px', textAlign: 'right' as const, borderTop: '1px solid #f1f5f9' };
          const inputTd = { ...valTd, padding: 0, background: '#f8fafc' };
          const resultTd = { ...valTd, color: '#16a34a', fontWeight: 700, borderTop: '2px solid #e2e8f0', background: '#f0fdf4' };

          const numInput = (key: keyof ExposureParams, step = '1') => (
            <Form.Control
              type="number"
              size="sm"
              step={step}
              style={{ ...inputStyle, border: 'none', textAlign: 'right', padding: '5px 8px', background: 'transparent' }}
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
              style={{ ...inputStyle, border: 'none', textAlign: 'right', padding: '5px 8px', background: 'transparent' }}
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
                <tr>
                  <td style={labelTd}>
                    {label}
                    <div style={{ fontSize: '0.62rem', color: '#94a3b8', marginTop: 1 }}>
                      {dbPrice.date}{dbPrice.contract ? ` · ${dbPrice.contract}` : ''}
                    </div>
                  </td>
                  <td style={{ ...valTd, color: '#1e40af', fontWeight: 600 }}>
                    {n(dbPrice.value, step === '0.01' ? 2 : 0)}
                  </td>
                </tr>
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

          // ── Super de Alimentos: tablas especificas (AKOMEL, CEBES MC35, Almidon) ──
          // Se calculan inline en el render porque NO dependen del fetch a Supabase,
          // solo de los inputs locales de exposureParams.
          const SUPER_ALIMENTOS_ID = 'e8516f19-7286-4e04-a63e-24ca9364d807';
          const isSuperAlimentos = selectedCompanyId === SUPER_ALIMENTOS_ID;
          const akomel = isSuperAlimentos ? calcularAkomelCop(exposureParams) : null;
          const cebes = isSuperAlimentos ? calcularCebesMc35(exposureParams) : null;
          const almidon = isSuperAlimentos ? calcularAlmidon(exposureParams) : null;

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
                    <PdfButton elementId="pdf-exposure" fileName="exposicion.pdf" />
                    <CsvButton elementId="pdf-exposure" fileName="exposicion.csv" />
                  </div>
                </Col>
                <Col className="d-flex align-items-end gap-3">
                  <span className="small" style={{ color: '#94a3b8', fontSize: '0.7rem' }}>
                    Los campos editables tienen fondo gris claro · <span style={{ color: '#1e40af', fontWeight: 600 }}>azul</span> = precio de mercado
                  </span>
                </Col>
              </Row>

              <div id="pdf-exposure">
              {hasExposureDefaults && (<>
              {/* Ventas Proyectadas - shared params */}
              <div className="rounded mb-3" style={{ background: '#fff', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0' }}>
                  <h6 style={{ color: '#7c3aed', fontWeight: 700, marginBottom: 0, fontSize: '0.85rem' }}>Ventas Proyectadas &amp; Parámetros Globales</h6>
                </div>
                <div style={{ padding: '14px 16px' }}>
                  <Row className="g-3">
                    {([
                      { key: 'ventas_intl_usd', label: 'Ventas Intl. (USD)' },
                      { key: 'ventas_co_usd', label: 'Ventas Colombia (USD)' },
                      { key: 'ventas_pe_usd', label: 'Ventas Perú (USD)' },
                      { key: 'trm', label: 'TRM (COP/USD)' },
                    ] as { key: keyof ExposureParams; label: string }[]).map(({ key, label }) => (
                      <Col xs={6} md={3} key={key}>
                        <Form.Label className="small mb-1" style={{ color: '#94a3b8', fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 600 }}>{label}</Form.Label>
                        <Form.Control type="number" size="sm" style={{ fontSize: '0.85rem', background: '#f8fafc', border: '1px solid #e2e8f0' }}
                          value={exposureParams[key] as number}
                          onChange={(e) => setExposureParams((p) => ({ ...p, [key]: parseFloat(e.target.value) || 0 }))}
                        />
                      </Col>
                    ))}
                  </Row>
                </div>
              </div>

              {/* Commodity Cards */}
              <Row className="g-3 mb-4">
                {/* AZUCAR */}
                <Col md={6} lg={4}>
                  <div className="rounded h-100" style={{ border: '1px solid #e2e8f0', overflow: 'hidden', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
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
                  <div className="rounded h-100" style={{ border: '1px solid #e2e8f0', overflow: 'hidden', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <div style={headerStyle}>MAÍZ / GLUCOSA <span className="fw-normal ms-2" style={{ fontSize: '0.7rem' }}>CME - ZC (Corn)</span></div>
                    <table className="table table-sm mb-0" style={{ fontSize: '0.78rem' }}>
                      <tbody>
                        <tr><td style={labelTd}>TON Glucosa (proyección)</td><td style={inputTd}>{projInput('proyeccion_glucosa')}</td></tr>
                        {priceField('precio_maiz_cent_bu', 'Precio Maíz (¢/bu)')}
                        <tr><td style={labelTd}>Base (¢/bu)</td><td style={inputTd}>{numInput('base_maiz_cent_bu')}</td></tr>
                        <tr><td style={labelTd}>Conversión bu/ton</td><td style={{ ...valTd, ...calcStyle }}>0.3937</td></tr>
                        <tr><td style={labelTd}>Precio Maíz (¢/ton)</td><td style={{ ...valTd, ...calcStyle, fontWeight: 600 }}>{mz ? n((mz.detalle as Record<string, number>).precio_cent_ton) : '—'}</td></tr>
                        <tr><td style={labelTd}>Precio Maíz (USD/ton)</td><td style={{ ...valTd, ...calcStyle, fontWeight: 600 }}>{mz ? n((mz.detalle as Record<string, number>).precio_usd_ton, 4) : '—'}</td></tr>
                        <tr><td style={labelTd}>Flete Oceánico (USD/ton)</td><td style={inputTd}>{numInput('flete_usd_ton')}</td></tr>
                        <tr><td style={labelTd}>Crédito Subproductos</td><td style={{ ...valTd, ...calcStyle }}>{mz ? n((mz.detalle as Record<string, number>).credito_subproductos) : '—'}</td></tr>
                        <tr><td style={labelTd}>Factor Maíz→Glucosa</td><td style={inputTd}>{numInput('factor_maiz_glucosa', '0.001')}</td></tr>
                        <tr><td style={labelTd}>Glucosa Materia (USD/ton)</td><td style={{ ...valTd, ...calcStyle, fontWeight: 600 }}>{mz ? n((mz.detalle as Record<string, number>).glucosa_materia) : '—'}</td></tr>
                        <tr><td style={labelTd}>Processing Fee (USD/ton)</td><td style={inputTd}>{numInput('processing_fee_usd')}</td></tr>
                        <tr><td style={labelTd}>Processing Fee (COP/kg)</td><td style={inputTd}>{numInput('proc_fee_cop_kg')}</td></tr>
                        <tr><td style={labelTd}>Precio Glucosa (USD/ton)</td><td style={{ ...valTd, ...calcStyle, fontWeight: 600 }}>{mz ? n((mz.detalle as Record<string, number>).precio_glucosa) : '—'}</td></tr>
                        {/* ── Contratos de maiz CBOT ZC ── */}
                        <tr><td style={labelTd}>TON Contrato (CBOT ZC)</td><td style={{ ...valTd, ...calcStyle }}>{mz ? n((mz.detalle as Record<string, number>).ton_contrato, 0) : '—'}</td></tr>
                        <tr><td style={labelTd}>TON Maíz reales</td><td style={{ ...valTd, ...calcStyle }}>{mz ? n(mz.tons_reales as number, 0) : '—'}</td></tr>
                        <tr><td style={labelTd}># Contratos</td><td style={{ ...valTd, ...calcStyle, fontWeight: 600 }}>{mz ? n(mz.num_contratos as number, 2) : '—'}</td></tr>
                        <tr><td style={{ ...labelTd, fontWeight: 700 }}>Exposición USD</td><td style={resultTd}>{mz ? fmtUsd(mz.exposicion_usd) : '—'}</td></tr>
                      </tbody>
                    </table>
                  </div>
                </Col>

                {/* COCOA EN POLVO */}
                <Col md={6} lg={4}>
                  <div className="rounded h-100" style={{ border: '1px solid #e2e8f0', overflow: 'hidden', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
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
                  <div className="rounded h-100" style={{ border: '1px solid #e2e8f0', overflow: 'hidden', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
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
                  <div className="rounded h-100" style={{ border: '1px solid #e2e8f0', overflow: 'hidden', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
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
                  <div className="rounded h-100" style={{ border: '1px solid #e2e8f0', overflow: 'hidden', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
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

              {/* ═════════ TABLAS ADICIONALES — SOLO SUPER DE ALIMENTOS ═════════ */}
              {isSuperAlimentos && (
                <Row className="g-3 mb-4 mt-1">
                    {/* ── AKOMEL COP ── */}
                    <Col md={6} lg={4}>
                      <div className="rounded h-100" style={{ border: '1px solid #e2e8f0', overflow: 'hidden', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                        <div style={headerStyle}>AKOMEL COP <span className="fw-normal ms-2" style={{ fontSize: '0.7rem' }}>Aceite de palma — Malasia</span></div>
                        <table className="table table-sm mb-0" style={{ fontSize: '0.78rem' }}>
                          <tbody>
                            {/* Inputs — precio crudo puesto puerto */}
                            <tr><td style={labelTd}>FOB Malasia (USD/TON)</td><td style={inputTd}>{numInput('akomel_fob_malasya', '0.01')}</td></tr>
                            <tr><td style={labelTd}>International Freight (USD/TON)</td><td style={inputTd}>{numInput('akomel_international_freight', '0.01')}</td></tr>
                            <tr><td style={labelTd}>Tariff AAK MY (0.04%)</td><td style={{ ...valTd, ...calcStyle }}>{akomel ? n(akomel.tariff_aak_my, 4) : '—'}</td></tr>
                            <tr><td style={labelTd}>Risk Futures Fee (USD/TON)</td><td style={inputTd}>{numInput('akomel_risk_futures_fee', '0.01')}</td></tr>
                            <tr><td style={labelTd}>TRM (USD/COP) <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>(Xerenity)</span></td><td style={{ ...valTd, ...calcStyle }}>{n(exposureParams.trm, 2)}</td></tr>
                            <tr><td style={labelTd}>Precio Crudo (COP/TON)</td><td style={{ ...valTd, ...calcStyle }}>{akomel ? n(akomel.precio_crudo_cop_ton, 2) : '—'}</td></tr>
                            <tr><td style={labelTd}>Precio Crudo (COP/KG)</td><td style={{ ...valTd, ...calcStyle, fontWeight: 600 }}>{akomel ? n(akomel.precio_crudo_cop_kg, 2) : '—'}</td></tr>
                            {/* Base proceso */}
                            <tr><td style={{ ...labelTd, padding: '8px 12px', fontSize: '0.75rem', color: '#1e293b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', background: '#f1f5f9', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0' }} colSpan={2}>Base Proceso</td></tr>
                            <tr><td style={labelTd}>Materia Prima (COP/KG)</td><td style={{ ...valTd, ...calcStyle }}>{akomel ? n(akomel.materia_prima, 2) : '—'}</td></tr>
                            <tr><td style={labelTd}>Bonif. Calidad (2.5%)</td><td style={{ ...valTd, ...calcStyle }}>{akomel ? n(akomel.bonificacion_calidad, 2) : '—'}</td></tr>
                            <tr><td style={labelTd}>Prima Abastecimiento (COP/KG)</td><td style={inputTd}>{numInput('akomel_prima_abastecimiento', '0.01')}</td></tr>
                            <tr><td style={labelTd}>Flete Extractora→Fábrica (COP/KG)</td><td style={inputTd}>{numInput('akomel_flete_extractora_fabrica', '0.01')}</td></tr>
                            <tr><td style={labelTd}>Precio MP puesto planta (COP/KG)</td><td style={{ ...valTd, ...calcStyle, fontWeight: 600 }}>{akomel ? n(akomel.precio_mp_puesto_planta, 2) : '—'}</td></tr>
                            {/* AKOMEL NH Granel */}
                            <tr><td style={{ ...labelTd, padding: '8px 12px', fontSize: '0.75rem', color: '#1e293b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', background: '#f1f5f9', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0' }} colSpan={2}>AKOMEL NH Granel</td></tr>
                            <tr><td style={labelTd}>Rend. Impurezas + Humedad</td><td style={inputTd}>{numInput('akomel_rend_impurezas_humedad_granel', '0.001')}</td></tr>
                            <tr><td style={labelTd}>Paso 1 (÷ rend. imp+hum)</td><td style={{ ...valTd, ...calcStyle }}>{akomel ? n(akomel.paso1_granel, 2) : '—'}</td></tr>
                            <tr><td style={labelTd}>Rend. Acidez AAK</td><td style={inputTd}>{numInput('akomel_rend_acidez_aak_granel', '0.001')}</td></tr>
                            <tr><td style={labelTd}>Paso 2 (÷ rend. acidez)</td><td style={{ ...valTd, ...calcStyle }}>{akomel ? n(akomel.paso2_granel, 2) : '—'}</td></tr>
                            <tr><td style={labelTd}>Costos Transformación</td><td style={inputTd}>{numInput('akomel_costos_transf_granel', '1')}</td></tr>
                            <tr><td style={{ ...labelTd, fontWeight: 700 }}>Akomel NH Granel (COP/KG)</td><td style={resultTd}>{akomel ? n(akomel.precio_akomel_nh_granel, 2) : '—'}</td></tr>
                            <tr><td style={labelTd}>KG anual (compra)</td><td style={inputTd}>{numInput('kg_akomel_granel_anual', '1')}</td></tr>
                            <tr><td style={{ ...labelTd, fontWeight: 700 }}>Exposición USD</td><td style={resultTd}>{akomel ? fmtUsd(((exposureParams.kg_akomel_granel_anual ?? 0) * akomel.precio_akomel_nh_granel) / (exposureParams.trm || 1)) : '—'}</td></tr>
                            {/* AKOMEL NH Sin Lecitina */}
                            <tr><td style={{ ...labelTd, padding: '8px 12px', fontSize: '0.75rem', color: '#1e293b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', background: '#f1f5f9', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0' }} colSpan={2}>AKOMEL NH Sin Lecitina Caja 15Kg</td></tr>
                            <tr><td style={labelTd}>Rend. Impurezas + Humedad</td><td style={inputTd}>{numInput('akomel_rend_impurezas_humedad_sl', '0.001')}</td></tr>
                            <tr><td style={labelTd}>Paso 1</td><td style={{ ...valTd, ...calcStyle }}>{akomel ? n(akomel.paso1_sl, 2) : '—'}</td></tr>
                            <tr><td style={labelTd}>Rend. Acidez AAK</td><td style={inputTd}>{numInput('akomel_rend_acidez_aak_sl', '0.001')}</td></tr>
                            <tr><td style={labelTd}>Paso 2</td><td style={{ ...valTd, ...calcStyle }}>{akomel ? n(akomel.paso2_sl, 2) : '—'}</td></tr>
                            <tr><td style={labelTd}>Costos Transformación</td><td style={inputTd}>{numInput('akomel_costos_transf_sl', '1')}</td></tr>
                            <tr><td style={labelTd}>Material Empaque</td><td style={inputTd}>{numInput('akomel_material_empaque_sl', '1')}</td></tr>
                            <tr><td style={{ ...labelTd, fontWeight: 700 }}>Akomel NH SL Caja 15Kg (COP/KG)</td><td style={resultTd}>{akomel ? n(akomel.precio_akomel_nh_sl_caja15, 2) : '—'}</td></tr>
                            <tr><td style={labelTd}>KG anual (compra)</td><td style={inputTd}>{numInput('kg_akomel_sl_anual', '1')}</td></tr>
                            <tr><td style={{ ...labelTd, fontWeight: 700 }}>Exposición USD</td><td style={resultTd}>{akomel ? fmtUsd(((exposureParams.kg_akomel_sl_anual ?? 0) * akomel.precio_akomel_nh_sl_caja15) / (exposureParams.trm || 1)) : '—'}</td></tr>
                            {/* AKOMEL NH Saborizado */}
                            <tr><td style={{ ...labelTd, padding: '8px 12px', fontSize: '0.75rem', color: '#1e293b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', background: '#f1f5f9', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0' }} colSpan={2}>AKOMEL NH Saborizado Caja 15Kg</td></tr>
                            <tr><td style={labelTd}>Rend. Impurezas + Humedad</td><td style={inputTd}>{numInput('akomel_rend_impurezas_humedad_sab', '0.001')}</td></tr>
                            <tr><td style={labelTd}>Paso 1</td><td style={{ ...valTd, ...calcStyle }}>{akomel ? n(akomel.paso1_sab, 2) : '—'}</td></tr>
                            <tr><td style={labelTd}>Rend. Acidez AAK</td><td style={inputTd}>{numInput('akomel_rend_acidez_aak_sab', '0.001')}</td></tr>
                            <tr><td style={labelTd}>Paso 2</td><td style={{ ...valTd, ...calcStyle }}>{akomel ? n(akomel.paso2_sab, 2) : '—'}</td></tr>
                            <tr><td style={labelTd}>Costos Transformación</td><td style={inputTd}>{numInput('akomel_costos_transf_sab', '1')}</td></tr>
                            <tr><td style={labelTd}>Material Empaque</td><td style={inputTd}>{numInput('akomel_material_empaque_sab', '1')}</td></tr>
                            <tr><td style={{ ...labelTd, fontWeight: 700 }}>Akomel NH Sab Caja 15Kg (COP/KG)</td><td style={resultTd}>{akomel ? n(akomel.precio_akomel_nh_sab_caja15, 2) : '—'}</td></tr>
                            <tr><td style={labelTd}>KG anual (compra)</td><td style={inputTd}>{numInput('kg_akomel_sab_anual', '1')}</td></tr>
                            <tr><td style={{ ...labelTd, fontWeight: 700 }}>Exposición USD</td><td style={resultTd}>{akomel ? fmtUsd(((exposureParams.kg_akomel_sab_anual ?? 0) * akomel.precio_akomel_nh_sab_caja15) / (exposureParams.trm || 1)) : '—'}</td></tr>
                            {/* Total AKOMEL USD */}
                            <tr><td style={{ ...labelTd, padding: '8px 12px', fontSize: '0.75rem', color: '#1e293b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', background: '#f1f5f9', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0' }} colSpan={2}>Total</td></tr>
                            <tr><td style={{ ...labelTd, fontWeight: 700 }}>Total Exposición AKOMEL USD</td><td style={{ ...resultTd, background: '#faf5ff', color: '#7c3aed' }}>{akomel ? fmtUsd((((exposureParams.kg_akomel_granel_anual ?? 0) * akomel.precio_akomel_nh_granel) + ((exposureParams.kg_akomel_sl_anual ?? 0) * akomel.precio_akomel_nh_sl_caja15) + ((exposureParams.kg_akomel_sab_anual ?? 0) * akomel.precio_akomel_nh_sab_caja15)) / (exposureParams.trm || 1)) : '—'}</td></tr>
                          </tbody>
                        </table>
                      </div>
                    </Col>

                    {/* ── CEBES MC 35 ── */}
                    <Col md={6} lg={4}>
                      <div className="rounded h-100" style={{ border: '1px solid #e2e8f0', overflow: 'hidden', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                        <div style={headerStyle}>CEBES MC 35 <span className="fw-normal ms-2" style={{ fontSize: '0.7rem' }}>Palmiste — Malasia</span></div>
                        <table className="table table-sm mb-0" style={{ fontSize: '0.78rem' }}>
                          <tbody>
                            <tr><td style={labelTd}>Precio Palmiste CIF (USD/TON)</td><td style={inputTd}>{numInput('cebes_precio_palmiste_cif', '0.01')}</td></tr>
                            <tr><td style={labelTd}>Flete Malasia→Colombia (USD/TON)</td><td style={inputTd}>{numInput('cebes_flete_malasia_colombia', '0.01')}</td></tr>
                            <tr><td style={labelTd}>Flete Malasia→Europa (USD/TON)</td><td style={inputTd}>{numInput('cebes_flete_malasia_europa', '0.01')}</td></tr>
                            <tr><td style={labelTd}>Arancel (0.1%)</td><td style={{ ...valTd, ...calcStyle }}>{cebes ? n(cebes.arancel, 4) : '—'}</td></tr>
                            <tr><td style={labelTd}>Risk Futures Fee (USD/TON)</td><td style={inputTd}>{numInput('cebes_risk_futures_fee_palmiste', '0.01')}</td></tr>
                            <tr><td style={labelTd}>TRM (USD/COP) <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>(Xerenity)</span></td><td style={{ ...valTd, ...calcStyle }}>{n(exposureParams.trm, 2)}</td></tr>
                            <tr><td style={labelTd}>Prima RSPO MB (USD/TON)</td><td style={inputTd}>{numInput('cebes_prima_rspo_mb', '0.01')}</td></tr>
                            <tr><td style={labelTd}>Precio Palmiste (COP/KG)</td><td style={{ ...valTd, ...calcStyle, fontWeight: 600 }}>{cebes ? n(cebes.precio_palmiste_cop_kg, 2) : '—'}</td></tr>
                            {/* Base proceso */}
                            <tr><td style={{ ...labelTd, padding: '8px 12px', fontSize: '0.75rem', color: '#1e293b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', background: '#f1f5f9', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0' }} colSpan={2}>Base Proceso</td></tr>
                            <tr><td style={labelTd}>Materia Prima (COP/KG)</td><td style={{ ...valTd, ...calcStyle }}>{cebes ? n(cebes.materia_prima, 2) : '—'}</td></tr>
                            <tr><td style={labelTd}>Prima Abastecimiento (COP)</td><td style={inputTd}>{numInput('cebes_prima_abastecimiento', '1')}</td></tr>
                            <tr><td style={labelTd}>Flete Extractora→Fábrica (COP/KG)</td><td style={inputTd}>{numInput('cebes_flete_extractora_fabrica', '0.01')}</td></tr>
                            <tr><td style={labelTd}>Precio MP puesto planta (COP/KG)</td><td style={{ ...valTd, ...calcStyle, fontWeight: 600 }}>{cebes ? n(cebes.precio_mp_planta, 2) : '—'}</td></tr>
                            {/* CEBES MC 35 */}
                            <tr><td style={{ ...labelTd, padding: '8px 12px', fontSize: '0.75rem', color: '#1e293b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', background: '#f1f5f9', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0' }} colSpan={2}>CEBES MC 35</td></tr>
                            <tr><td style={labelTd}>Rend. Impurezas + Humedad</td><td style={inputTd}>{numInput('cebes_rend_impurezas_humedad', '0.001')}</td></tr>
                            <tr><td style={labelTd}>Paso 1</td><td style={{ ...valTd, ...calcStyle }}>{cebes ? n(cebes.paso1_cebes, 2) : '—'}</td></tr>
                            <tr><td style={labelTd}>Rend. Acidez AAK</td><td style={inputTd}>{numInput('cebes_rend_acidez_aak', '0.001')}</td></tr>
                            <tr><td style={labelTd}>Paso 2</td><td style={{ ...valTd, ...calcStyle }}>{cebes ? n(cebes.paso2_cebes, 2) : '—'}</td></tr>
                            <tr><td style={labelTd}>Costos Transformación</td><td style={inputTd}>{numInput('cebes_costos_transformacion', '1')}</td></tr>
                            <tr><td style={labelTd}>Material Empaque</td><td style={inputTd}>{numInput('cebes_material_empaque', '1')}</td></tr>
                            <tr><td style={labelTd}>Financiamiento (60 días)</td><td style={inputTd}>{numInput('cebes_financiamiento', '1')}</td></tr>
                            <tr><td style={{ ...labelTd, fontWeight: 700 }}>CEBES MC 35 (COP/KG)</td><td style={resultTd}>{cebes ? n(cebes.precio_cebes_mc35, 2) : '—'}</td></tr>
                            <tr><td style={labelTd}>KG anual (compra)</td><td style={inputTd}>{numInput('kg_cebes_anual', '1')}</td></tr>
                            <tr><td style={{ ...labelTd, fontWeight: 700 }}>Exposición USD</td><td style={{ ...resultTd, background: '#faf5ff', color: '#7c3aed' }}>{cebes ? fmtUsd(((exposureParams.kg_cebes_anual ?? 0) * cebes.precio_cebes_mc35) / (exposureParams.trm || 1)) : '—'}</td></tr>
                          </tbody>
                        </table>
                      </div>
                    </Col>

                    {/* ── ALMIDÓN ── */}
                    <Col md={6} lg={4}>
                      <div className="rounded h-100" style={{ border: '1px solid #e2e8f0', overflow: 'hidden', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                        <div style={headerStyle}>ALMIDÓN <span className="fw-normal ms-2" style={{ fontSize: '0.7rem' }}>Maíz CBOT ZC → Almidón</span></div>
                        <table className="table table-sm mb-0" style={{ fontSize: '0.78rem' }}>
                          <tbody>
                            <tr><td style={labelTd}>Precio Futuro Maíz (¢/bu)</td><td style={inputTd}>{numInput('precio_maiz_cent_bu', '0.01')}</td></tr>
                            <tr><td style={labelTd}>Base Maíz (¢/bu)</td><td style={inputTd}>{numInput('base_maiz_cent_bu', '0.01')}</td></tr>
                            <tr><td style={labelTd}>Flete Marítimo (USD/TON)</td><td style={inputTd}>{numInput('almidon_flete_maritimo', '0.01')}</td></tr>
                            <tr><td style={labelTd}>Conversión bu/ton</td><td style={{ ...valTd, ...calcStyle }}>0.3937</td></tr>
                            <tr><td style={labelTd}>Precio FOB (¢/bu)</td><td style={{ ...valTd, ...calcStyle }}>{almidon ? n(almidon.precio_fob_usc_bu, 2) : '—'}</td></tr>
                            <tr><td style={labelTd}>Precio FOB (USD/TON)</td><td style={{ ...valTd, ...calcStyle }}>{almidon ? n(almidon.precio_fob_usd_ton, 2) : '—'}</td></tr>
                            <tr><td style={labelTd}>Precio Maíz (USD/TON)</td><td style={{ ...valTd, ...calcStyle, fontWeight: 600 }}>{almidon ? n(almidon.precio_maiz_usd_ton, 2) : '—'}</td></tr>
                            <tr><td style={labelTd}>Crédito Subproductos (26%)</td><td style={{ ...valTd, ...calcStyle }}>{almidon ? n(almidon.credito_subproductos, 2) : '—'}</td></tr>
                            <tr><td style={labelTd}>Precio Neto Maíz (USD/TON)</td><td style={{ ...valTd, ...calcStyle, fontWeight: 600 }}>{almidon ? n(almidon.precio_neto_maiz, 2) : '—'}</td></tr>
                            <tr><td style={labelTd}>Factor Maíz→Almidón</td><td style={{ ...valTd, ...calcStyle }}>1.60</td></tr>
                            <tr><td style={{ ...labelTd, fontWeight: 700 }}>Precio Almidón (USD/TON)</td><td style={resultTd}>{almidon ? n(almidon.precio_almidon_usd_ton, 2) : '—'}</td></tr>
                            <tr><td style={labelTd}>KG anual (compra)</td><td style={inputTd}>{numInput('kg_almidon_anual', '1')}</td></tr>
                            <tr><td style={{ ...labelTd, fontWeight: 700 }}>Exposición USD</td><td style={{ ...resultTd, background: '#faf5ff', color: '#7c3aed' }}>{almidon ? fmtUsd(((exposureParams.kg_almidon_anual ?? 0) * almidon.precio_almidon_usd_ton) / 1000) : '—'}</td></tr>
                          </tbody>
                        </table>
                      </div>
                    </Col>
                </Row>
              )}
              </>)}

              {/* ─── COBERTURA CAFE (empresas con CAFE en commodities) ─── */}
              {hasCafe && (() => {
                const cafe = calcularCoberturaCafe(exposureParams);
                const fmt0 = (v: number) => v.toLocaleString('es-CO', { maximumFractionDigits: 0 });
                const fmt2 = (v: number) => v.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                const setScen = (sc: { kc?: number; pfnc?: number; trmc?: number; kcv?: number; pexp?: number; trmv?: number; cargas?: number }) => {
                  setExposureParams((p) => ({
                    ...p,
                    ...(sc.kc != null && { precio_cafe_cent_lb: sc.kc }),
                    ...(sc.pfnc != null && { prima_fnc_cent_lb: sc.pfnc }),
                    ...(sc.trmc != null && { trm: sc.trmc }),
                    ...(sc.kcv != null && { kc_venta_cafe_cent_lb: sc.kcv }),
                    ...(sc.pexp != null && { prima_exp_cent_lb: sc.pexp }),
                    ...(sc.trmv != null && { trm_venta_cafe: sc.trmv }),
                    ...(sc.cargas != null && { cargas_cafe_anual: sc.cargas }),
                  }));
                };
                const sensRows: Array<{ lbl: string; d: number }> = [
                  { lbl: 'KC −10%', d: cafe.delta_kc_minus_10pct },
                  { lbl: 'TRM compra −$200', d: cafe.delta_trm_compra_minus_200 },
                  { lbl: 'TRM venta −$200', d: cafe.delta_trm_venta_minus_200 },
                  { lbl: 'Prima exp. +5 ¢/lb', d: cafe.delta_prima_exp_plus_5 },
                ];
                const maxAbs = Math.max(...sensRows.map((r) => Math.abs(r.d)), 1);
                const sectionDivider = { ...labelTd, padding: '8px 12px', fontSize: '0.75rem', color: '#1e293b', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.05em', background: '#f1f5f9', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0' };

                const trmRef = exposureParams.trm ?? 0;
                const cafeContract = exposureResult?.market_prices?.precio_cafe_cent_lb?.contract;
                const cafeContractLabel = cafeContract ? `Front: ${cafeContract}` : 'Mercado';
                return (
                  <Row className="g-3 mb-4">
                    {/* TRM Xerenity ribbon */}
                    <Col md={12}>
                      <div className="rounded" style={{ background: '#fff', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', padding: '8px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Cobertura Café — Análisis de exposición</span>
                        <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                          TRM actual <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>(Xerenity)</span>:
                          <span style={{ marginLeft: 6, fontWeight: 700, color: '#1e293b', fontFamily: 'ui-monospace, monospace' }}>${fmt2(trmRef)}</span>
                          <button type="button" onClick={() => setExposureParams((p) => ({ ...p, trm_compra_cafe: trmRef, trm_venta_cafe: trmRef }))} style={{ marginLeft: 10, fontSize: '0.7rem', padding: '2px 8px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#475569', borderRadius: 4, cursor: 'pointer' }}>Aplicar a compra y venta</button>
                        </span>
                      </div>
                    </Col>

                    {/* Compra */}
                    <Col md={6}>
                      <div className="rounded h-100" style={{ border: '1px solid #e2e8f0', overflow: 'hidden', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                        <div style={headerStyle}>Cobertura Café — Compra <span className="fw-normal ms-2" style={{ fontSize: '0.7rem' }}>paga COP al caficultor</span></div>
                        <table className="table table-sm mb-0" style={{ fontSize: '0.78rem' }}>
                          <tbody>
                            <tr><td style={sectionDivider} colSpan={2}>Precio internacional</td></tr>
                            <tr><td style={labelTd}>KC futuro (¢/lb) <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>({cafeContractLabel})</span></td><td style={{ ...valTd, ...calcStyle, fontWeight: 600 }}>{fmt2(cafe.kc_compra)}</td></tr>
                            <tr><td style={labelTd}>Prima FNC (¢/lb)</td><td style={inputTd}>{numInput('prima_fnc_cent_lb', '0.5')}</td></tr>
                            <tr><td style={sectionDivider} colSpan={2}>Tipo de cambio</td></tr>
                            <tr><td style={labelTd}>TRM compra (COP/USD)</td><td style={inputTd}>{numInput('trm_compra_cafe', '10')}</td></tr>
                            <tr><td style={labelTd}>FR — Factor Rendimiento</td><td style={inputTd}>
                              <Form.Select size="sm" value={cafe.fr} onChange={(e) => setExposureParams((p) => ({ ...p, factor_rendimiento_cafe: parseFloat(e.target.value) }))} style={{ border: 'none', textAlign: 'right', padding: '5px 8px', background: 'transparent', fontSize: '0.78rem' }}>
                                <option value={0.94}>FR 94 — excelso estándar</option>
                                <option value={0.92}>FR 92 — premium</option>
                                <option value={0.88}>FR 88 — especial</option>
                              </Form.Select>
                            </td></tr>
                            <tr><td style={{ ...labelTd, fontWeight: 700 }}>Precio compra (COP/carga)</td><td style={resultTd}>{fmt0(cafe.p_compra_cop_carga)}</td></tr>
                          </tbody>
                        </table>
                      </div>
                    </Col>

                    {/* Venta */}
                    <Col md={6}>
                      <div className="rounded h-100" style={{ border: '1px solid #e2e8f0', overflow: 'hidden', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                        <div style={headerStyle}>Cobertura Café — Venta <span className="fw-normal ms-2" style={{ fontSize: '0.7rem' }}>cobra USD del exportador</span></div>
                        <table className="table table-sm mb-0" style={{ fontSize: '0.78rem' }}>
                          <tbody>
                            <tr><td style={sectionDivider} colSpan={2}>Precio internacional</td></tr>
                            <tr><td style={labelTd}>Base KC venta (¢/lb)</td><td style={inputTd}>{numInput('kc_venta_cafe_cent_lb', '0.5')}</td></tr>
                            <tr><td style={labelTd}>Prima exportación (¢/lb)</td><td style={inputTd}>{numInput('prima_exp_cent_lb', '0.5')}</td></tr>
                            <tr><td style={sectionDivider} colSpan={2}>Tipo de cambio &amp; volumen</td></tr>
                            <tr><td style={labelTd}>TRM venta (COP/USD)</td><td style={inputTd}>{numInput('trm_venta_cafe', '10')}</td></tr>
                            <tr><td style={labelTd}>Volumen (cargas 125 kg)</td><td style={inputTd}>{numInput('cargas_cafe_anual', '10')}</td></tr>
                            <tr><td style={{ ...labelTd, fontWeight: 700 }}>Precio venta (COP/carga)</td><td style={resultTd}>{fmt0(cafe.p_venta_cop_carga)}</td></tr>
                          </tbody>
                        </table>
                      </div>
                    </Col>

                    {/* Exposición Total del Negocio */}
                    <Col md={12}>
                      <div className="rounded" style={{ background: '#fff', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                        <div style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0' }}>
                          <h6 style={{ color: '#7c3aed', fontWeight: 700, marginBottom: 0, fontSize: '0.85rem' }}>Exposición total del negocio</h6>
                        </div>
                        <div className="table-responsive">
                          <table className="table table-sm align-middle mb-0" style={{ fontSize: '0.78rem' }}>
                            <thead style={{ fontSize: '0.7rem', color: '#64748b' }}>
                              <tr>
                                <th style={{ padding: '8px 12px', borderBottom: '2px solid #e2e8f0', textTransform: 'uppercase', fontWeight: 600 }}>Concepto</th>
                                <th className="text-end" style={{ padding: '8px 12px', borderBottom: '2px solid #e2e8f0', textTransform: 'uppercase', fontWeight: 600 }}>Por carga</th>
                                <th className="text-end" style={{ padding: '8px 12px', borderBottom: '2px solid #e2e8f0', textTransform: 'uppercase', fontWeight: 600 }}>Total ({fmt0(cafe.cargas)} cargas)</th>
                                <th className="text-end" style={{ padding: '8px 12px', borderBottom: '2px solid #e2e8f0', textTransform: 'uppercase', fontWeight: 600 }}>Equivalente USD</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '8px 12px', color: '#64748b' }}>Volumen físico</td>
                                <td className="text-end" style={{ padding: '8px 12px' }}>125 kg</td>
                                <td className="text-end" style={{ padding: '8px 12px', fontWeight: 600 }}>{fmt0(cafe.total_kg)} kg</td>
                                <td className="text-end" style={{ padding: '8px 12px', color: '#94a3b8' }}>{fmt0(cafe.total_lb)} lb</td>
                              </tr>
                              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '8px 12px', color: '#64748b' }}>Compra al caficultor</td>
                                <td className="text-end" style={{ padding: '8px 12px' }}>{fmt0(cafe.p_compra_cop_carga)} COP</td>
                                <td className="text-end" style={{ padding: '8px 12px', fontWeight: 600 }}>{fmtUsd(cafe.total_compra_cop)} COP</td>
                                <td className="text-end" style={{ padding: '8px 12px', color: '#94a3b8' }}>{fmtUsd(cafe.total_compra_cop / (cafe.trm_compra || 1))} USD</td>
                              </tr>
                              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '8px 12px', color: '#64748b' }}>Venta al exportador</td>
                                <td className="text-end" style={{ padding: '8px 12px' }}>{fmt0(cafe.p_venta_cop_carga)} COP</td>
                                <td className="text-end" style={{ padding: '8px 12px', fontWeight: 600 }}>{fmtUsd(cafe.total_venta_cop)} COP</td>
                                <td className="text-end" style={{ padding: '8px 12px', color: '#94a3b8' }}>{fmtUsd(cafe.total_venta_usd)} USD</td>
                              </tr>
                              <tr style={{ borderTop: '2px solid #1e293b', fontWeight: 700 }}>
                                <td style={{ padding: '10px 12px' }}>Margen / Utilidad</td>
                                <td className="text-end" style={{ padding: '10px 12px', color: cafe.margen_cop_carga >= 0 ? '#16a34a' : '#dc2626' }}>{fmt0(cafe.margen_cop_carga)} COP <span style={{ fontWeight: 400, color: '#94a3b8', fontSize: '0.7rem' }}>({cafe.margen_pct.toFixed(1)}%)</span></td>
                                <td className="text-end" style={{ padding: '10px 12px', color: cafe.margen_cop_carga >= 0 ? '#16a34a' : '#dc2626' }}>{fmtUsd(cafe.utilidad_total_cop)} COP</td>
                                <td className="text-end" style={{ padding: '10px 12px', color: cafe.margen_cop_carga >= 0 ? '#16a34a' : '#dc2626' }}>{fmtUsd(cafe.utilidad_total_usd)} USD</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </Col>

                    {/* Descalces */}
                    <Col md={6}>
                      <div className="rounded h-100" style={{ background: '#fff', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                        <div style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0' }}>
                          <h6 style={{ color: '#7c3aed', fontWeight: 700, marginBottom: 0, fontSize: '0.85rem' }}>Descalce temporal</h6>
                        </div>
                        <table className="table table-sm mb-0" style={{ fontSize: '0.78rem' }}>
                          <tbody>
                            <tr><td style={labelTd}>Descalce TRM (venta − compra)</td><td style={{ ...valTd, fontWeight: 600, color: cafe.descalce_trm >= 0 ? '#16a34a' : '#dc2626' }}>{cafe.descalce_trm >= 0 ? '+' : ''}{fmt0(cafe.descalce_trm)} COP/USD</td></tr>
                            <tr><td style={labelTd}>Descalce KC (venta − compra)</td><td style={{ ...valTd, fontWeight: 600, color: cafe.descalce_kc >= 0 ? '#16a34a' : '#dc2626' }}>{cafe.descalce_kc >= 0 ? '+' : ''}{fmt2(cafe.descalce_kc)} ¢/lb</td></tr>
                          </tbody>
                        </table>
                      </div>
                    </Col>

                    {/* Sensibilidades */}
                    <Col md={6}>
                      <div className="rounded h-100" style={{ background: '#fff', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                        <div style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0' }}>
                          <h6 style={{ color: '#7c3aed', fontWeight: 700, marginBottom: 0, fontSize: '0.85rem' }}>Sensibilidad — impacto en margen por carga</h6>
                        </div>
                        <div style={{ padding: '10px 16px' }}>
                          {sensRows.map((r) => {
                            const pct = Math.min(Math.abs(r.d) / maxAbs * 100, 100);
                            const col = r.d >= 0 ? '#16a34a' : '#dc2626';
                            return (
                              <div key={r.lbl} style={{ display: 'grid', gridTemplateColumns: '160px 1fr 110px', gap: 10, alignItems: 'center', marginBottom: 8, fontSize: '0.75rem' }}>
                                <span style={{ color: '#64748b' }}>{r.lbl}</span>
                                <div style={{ background: '#f1f5f9', borderRadius: 3, height: 5, overflow: 'hidden' }}>
                                  <div style={{ height: '100%', width: `${pct}%`, background: col, borderRadius: 3 }} />
                                </div>
                                <span style={{ textAlign: 'right', color: col, fontWeight: 600 }}>{r.d >= 0 ? '+' : ''}{fmt0(r.d)} COP</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </Col>

                    {/* Chart sensibilidad TRM */}
                    <Col md={12}>
                      <div className="rounded" style={{ background: '#fff', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                        <div style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0' }}>
                          <h6 style={{ color: '#7c3aed', fontWeight: 700, marginBottom: 0, fontSize: '0.85rem' }}>Sensibilidad del margen a la TRM de compra</h6>
                        </div>
                        <div style={{ padding: '14px 16px' }}>
                          <ResponsiveContainer width="100%" height={240}>
                            <LineChart data={cafe.curva} margin={{ top: 5, right: 25, left: 5, bottom: 25 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                              <XAxis dataKey="trm" tick={{ fontSize: 10, fill: '#64748b' }} label={{ value: 'TRM compra (COP/USD)', position: 'insideBottom', offset: -10, fontSize: 11, fill: '#64748b' }} />
                              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={(v) => fmt0(v)} label={{ value: 'Margen COP/carga', angle: -90, position: 'insideLeft', fontSize: 11, fill: '#64748b', dy: 60 }} />
                              <Tooltip
                                formatter={(v: number) => `${fmt0(v)} COP/carga`}
                                labelFormatter={(t) => `TRM compra: ${fmt0(t as number)}`}
                                contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 4, fontSize: '0.78rem' }}
                              />
                              <Legend wrapperStyle={{ fontSize: '0.75rem', paddingTop: 8 }} />
                              <Line type="monotone" dataKey="sin_descalce" name="Sin descalce" stroke="#7c3aed" strokeWidth={2} dot={false} />
                              <Line type="monotone" dataKey="trm_venta_fija" name={`TRM venta fija (${fmt0(cafe.trm_venta)})`} stroke="#64748b" strokeWidth={1.5} strokeDasharray="5 4" dot={false} />
                              <Line type="monotone" dataKey={() => 0} name="Break even" stroke="#dc2626" strokeWidth={1} strokeDasharray="3 3" dot={false} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </Col>

                    {/* Escenarios */}
                    <Col md={12}>
                      <div className="rounded" style={{ background: '#fff', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                        <div style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0' }}>
                          <h6 style={{ color: '#7c3aed', fontWeight: 700, marginBottom: 0, fontSize: '0.85rem' }}>Escenarios pre-configurados</h6>
                        </div>
                        <div style={{ padding: '12px 16px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {[
                            { lbl: 'Base (hoy)', sc: { kc: cafe.kc_compra, pfnc: 10, kcv: cafe.kc_compra, pexp: 25, cargas: 200 } },
                            { lbl: 'KC −15%', sc: { kc: cafe.kc_compra * 0.85, kcv: cafe.kc_compra * 0.85, pfnc: 10, pexp: 25, cargas: 200 } },
                            { lbl: 'TRM compra $3,400', sc: { trmc: 3400, kcv: cafe.kc_compra, pexp: 25, pfnc: 10, cargas: 200 } },
                            { lbl: 'TRM compra $4,000', sc: { trmc: 4000, kcv: cafe.kc_compra, pexp: 25, pfnc: 10, cargas: 200 } },
                            { lbl: 'KC −15% + TRM $3,400', sc: { kc: cafe.kc_compra * 0.85, kcv: cafe.kc_compra * 0.85, trmc: 3400, pexp: 25, pfnc: 10, cargas: 200 } },
                            { lbl: 'KC compra = KC venta', sc: { kcv: cafe.kc_compra, pexp: 25, pfnc: 10, cargas: 200 } },
                          ].map((b) => (
                            <Button key={b.lbl} variant="outline-secondary" size="sm" onClick={() => setScen(b.sc)} style={{ fontSize: '0.72rem' }}>{b.lbl}</Button>
                          ))}
                        </div>
                      </div>
                    </Col>
                  </Row>
                );
              })()}

              {/* Summary tables */}
              {exposureResult && (() => {
                // Recompute Super formula rows from live exposureParams so typing
                // KG in a card updates this table instantly (no "Actualizar" click).
                // Non-Super commodities keep the fetched values (need market prices).
                const SUPER_IDS = new Set(['AKOMEL', 'CEBES_MC35', 'ALMIDON']);
                const baseRows = exposureResult.commodities.filter((c) => !SUPER_IDS.has(c.nombre));
                const liveSuperRows = isSuperAlimentos ? buildSuperFormulaCommodities(exposureParams) : [];
                const displayRows = [...baseRows, ...liveSuperRows];
                const liveTotalUsd = displayRows.reduce((s, c) => s + (c.exposicion_usd ?? 0), 0);
                const liveRealUsd = (exposureResult.exposicion_ventas_intl ?? 0) - liveTotalUsd;
                return (
                <>
                  <div className="rounded mb-3" style={{ background: '#fff', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0' }}>
                      <h6 style={{ color: '#7c3aed', fontWeight: 700, marginBottom: 0, fontSize: '0.85rem' }}>Exposición por Commodity</h6>
                    </div>
                    <div className="table-responsive">
                      <table className="table table-sm align-middle mb-0" style={{ fontSize: '0.78rem', borderCollapse: 'separate', borderSpacing: 0 }}>
                        <thead style={{ fontSize: '0.7rem', color: '#64748b' }}>
                          <tr>
                            <th style={{ padding: '8px 12px', borderBottom: '2px solid #e2e8f0', textTransform: 'uppercase', fontWeight: 600 }}>Commodity</th>
                            <th className="text-center" style={{ padding: '8px 12px', borderBottom: '2px solid #e2e8f0', textTransform: 'uppercase', fontWeight: 600 }}>Exchange</th>
                            <th className="text-center" style={{ padding: '8px 12px', borderBottom: '2px solid #e2e8f0', textTransform: 'uppercase', fontWeight: 600 }}>Unidad</th>
                            <th className="text-end" style={{ padding: '8px 12px', borderBottom: '2px solid #e2e8f0', textTransform: 'uppercase', fontWeight: 600 }}>Px Futuro</th>
                            <th className="text-end" style={{ padding: '8px 12px', borderBottom: '2px solid #e2e8f0', textTransform: 'uppercase', fontWeight: 600 }}>TON Total</th>
                            <th className="text-end" style={{ padding: '8px 12px', borderBottom: '2px solid #e2e8f0', textTransform: 'uppercase', fontWeight: 600 }}>Exposición USD</th>
                            <th className="text-end" style={{ padding: '8px 12px', borderBottom: '2px solid #e2e8f0', textTransform: 'uppercase', fontWeight: 600 }}>Px/TON</th>
                          </tr>
                        </thead>
                        <tbody>
                          {displayRows.map((c) => (
                            <tr key={c.nombre} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '8px 12px', color: '#7c3aed', fontWeight: 600 }}>{c.nombre}</td>
                              <td className="text-center" style={{ padding: '8px 12px', color: '#64748b' }}>{c.exchange}</td>
                              <td className="text-center" style={{ padding: '8px 12px', color: '#94a3b8', fontSize: '0.7rem' }}>{c.unidad_cotizacion}</td>
                              <td className="text-end" style={{ padding: '8px 12px' }}>{c.precio_futuro != null ? c.precio_futuro.toLocaleString('en-US') : '—'}</td>
                              <td className="text-end" style={{ padding: '8px 12px' }}>{c.ton_total != null ? c.ton_total.toLocaleString('en-US') : '—'}</td>
                              <td className="text-end" style={{ padding: '8px 12px', fontWeight: 700 }}>{fmtUsd(c.exposicion_usd)}</td>
                              <td className="text-end" style={{ padding: '8px 12px' }}>{c.precio_por_ton != null ? fmtUsd(c.precio_por_ton) : '—'}</td>
                            </tr>
                          ))}
                          <tr style={{ borderTop: '2px solid #1e293b', fontWeight: 700 }}>
                            <td colSpan={5} className="text-end" style={{ padding: '10px 12px' }}>Total Commodities</td>
                            <td className="text-end" style={{ padding: '10px 12px' }}>{fmtUsd(liveTotalUsd)}</td>
                            <td>{' '}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="rounded" style={{ background: '#fff', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', maxWidth: 500 }}>
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0' }}>
                      <h6 style={{ color: '#7c3aed', fontWeight: 700, marginBottom: 0, fontSize: '0.85rem' }}>Resumen Exposición Compañía</h6>
                    </div>
                    <table className="table table-sm mb-0" style={{ fontSize: '0.85rem', borderCollapse: 'separate', borderSpacing: 0 }}>
                      <tbody>
                        <tr>
                          <td style={{ padding: '8px 16px', color: '#64748b' }}>Total Commodities</td>
                          <td className="text-end" style={{ padding: '8px 16px', fontWeight: 700 }}>{fmtUsd(liveTotalUsd)}</td>
                        </tr>
                        <tr style={{ borderTop: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '8px 16px', color: '#64748b' }}>Exposición Ventas Intl.</td>
                          <td className="text-end" style={{ padding: '8px 16px', fontWeight: 700 }}>{fmtUsd(exposureResult.exposicion_ventas_intl)}</td>
                        </tr>
                        <tr style={{ borderTop: '2px solid #16a34a' }}>
                          <td style={{ padding: '10px 16px', fontWeight: 700, color: '#16a34a' }}>Exposición Real USD</td>
                          <td className="text-end" style={{ padding: '10px 16px', fontWeight: 700, color: '#16a34a' }}>{fmtUsd(liveRealUsd)}</td>
                        </tr>
                        <tr style={{ borderTop: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '8px 16px', color: '#64748b' }}>Exposición PEN (Perú)</td>
                          <td className="text-end" style={{ padding: '8px 16px' }}>{fmtUsd(exposureResult.exposicion_pen)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </>
                );
              })()}
            </div>
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
            <div id="pdf-matrices">
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
                  <PdfButton elementId="pdf-matrices" fileName="matrices.pdf" />
                  <CsvButton elementId="pdf-matrices" fileName="matrices.csv" />
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
            </div>
          );
        })()}

        {/* ── Portafolio GR (Futures) Tab ── */}
        {activeTab === 'futures' && (
          <div id="futures-tab">
            {/* Month selector + controls */}
            <div className="d-flex align-items-center gap-2 mb-3 flex-wrap">
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => {
                const prev = futuresMonth.month === 0 ? { year: futuresMonth.year - 1, month: 11 } : { year: futuresMonth.year, month: futuresMonth.month - 1 };
                setFuturesMonth(prev);
              }}>
                <Icon icon={faChevronLeft} />
              </button>
              <strong style={{ minWidth: 140, textAlign: 'center' }}>
                {MONTH_NAMES[futuresMonth.month]} {futuresMonth.year}
              </strong>
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => {
                const next = futuresMonth.month === 11 ? { year: futuresMonth.year + 1, month: 0 } : { year: futuresMonth.year, month: futuresMonth.month + 1 };
                setFuturesMonth(next);
              }}>
                <Icon icon={faChevronRight} />
              </button>

              <Button
                className="btn-sm ms-3"
                onClick={handleFetchFutures}
                disabled={futuresLoading}
              >
                <Icon icon={faSyncAlt} spin={futuresLoading} className="me-1" />
                Actualizar
              </Button>
              <Button
                className="btn-sm btn-outline-primary"
                onClick={() => setFuturesShowAddForm(!futuresShowAddForm)}
              >
                {futuresShowAddForm ? 'Cancelar' : '+ Nueva Posición'}
              </Button>
              <Form.Check
                type="switch"
                label="Mostrar cerradas"
                checked={futuresShowClosed}
                onChange={(e) => { setFuturesShowClosed(e.target.checked); }}
                className="ms-3"
              />
              <PdfButton elementId="futures-tab" fileName="portafolio_gr_futuros.pdf" />
              <CsvButton elementId="futures-tab" fileName="portafolio_gr_futuros.csv" />
            </div>

            {/* Add Position Form */}
            {futuresShowAddForm && (
              <div className="border rounded p-3 mb-3" style={{ background: '#f8fafc', maxWidth: 800 }}>
                <h6 style={{ fontWeight: 600, marginBottom: 12 }}>Nueva Posición</h6>
                <Row className="g-2 align-items-end">
                  <Col xs={2}>
                    <Form.Label className="small mb-1">Activo</Form.Label>
                    <Form.Select size="sm" value={newPosition.asset} onChange={(e) => setNewPosition({ ...newPosition, asset: e.target.value })}>
                      {(companyConfig?.commodities ?? [{asset:'MAIZ'},{asset:'AZUCAR'},{asset:'CACAO'}]).map((c) => (
                        <option key={c.asset} value={c.asset}>{c.asset}</option>
                      ))}
                    </Form.Select>
                  </Col>
                  <Col xs={2}>
                    <Form.Label className="small mb-1">Contrato</Form.Label>
                    <Form.Control size="sm" placeholder="ZCN26" value={newPosition.contract} onChange={(e) => setNewPosition({ ...newPosition, contract: e.target.value.toUpperCase() })} />
                  </Col>
                  <Col xs={2}>
                    <Form.Label className="small mb-1">Dirección</Form.Label>
                    <Form.Select size="sm" value={newPosition.direction} onChange={(e) => setNewPosition({ ...newPosition, direction: e.target.value as 'LONG' | 'SHORT' })}>
                      <option value="LONG">LONG</option>
                      <option value="SHORT">SHORT</option>
                    </Form.Select>
                  </Col>
                  <Col xs={1}>
                    <Form.Label className="small mb-1">Contratos</Form.Label>
                    <Form.Control size="sm" type="number" min={1} value={newPosition.nominal} onChange={(e) => setNewPosition({ ...newPosition, nominal: parseInt(e.target.value, 10) || 1 })} />
                  </Col>
                  <Col xs={2}>
                    <Form.Label className="small mb-1">
                      Precio Compra
                      <span style={{ color: '#94a3b8', fontSize: '0.65rem', marginLeft: 4 }}>
                        {({ MAIZ: '(cents/bu)', AZUCAR: '(cents/lb)', CACAO: '(USD/ton)' }[newPosition.asset] ?? '')}
                      </span>
                    </Form.Label>
                    <Form.Control size="sm" type="number" step="0.01" value={newPosition.entry_price || ''} onChange={(e) => setNewPosition({ ...newPosition, entry_price: parseFloat(e.target.value) || 0 })} />
                  </Col>
                  <Col xs={2}>
                    <Form.Label className="small mb-1">Fecha Entrada</Form.Label>
                    <Form.Control size="sm" type="date" value={newPosition.entry_date} onChange={(e) => setNewPosition({ ...newPosition, entry_date: e.target.value })} />
                  </Col>
                  <Col xs={1}>
                    <Button className="btn-sm btn-success w-100" onClick={handleAddPosition}>Crear</Button>
                  </Col>
                </Row>
              </div>
            )}

            {/* Portfolio Table */}
            {futuresLoading && (
              <p className="text-muted">Cargando portafolio...</p>
            )}
            {!futuresLoading && futuresPortfolio.length === 0 && (
              <p className="text-muted">No hay posiciones de futuros registradas.</p>
            )}
            {!futuresLoading && futuresPortfolio.length > 0 && (
              <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                <div className="table-responsive">
                <table className="table table-sm mb-0" style={{ fontSize: '0.8rem', borderCollapse: 'separate', borderSpacing: 0 }}>
                  <thead>
                    <tr style={{ fontSize: '0.7rem', color: '#64748b' }}>
                      <th style={{ borderBottom: '2px solid #e2e8f0', padding: '8px 6px' }}>Activo</th>
                      <th style={{ borderBottom: '2px solid #e2e8f0', padding: '8px 6px' }}>Contrato</th>
                      <th style={{ borderBottom: '2px solid #e2e8f0', padding: '8px 6px' }}>Dir.</th>
                      <th className="text-center" style={{ borderBottom: '2px solid #e2e8f0', padding: '8px 6px' }}>Nom.</th>
                      <th style={{ borderBottom: '2px solid #e2e8f0', padding: '8px 6px' }}>Fecha</th>
                      <th className="text-center" style={{ borderBottom: '2px solid #e2e8f0', padding: '8px 6px' }}>Mult.</th>
                      <th className="text-end" style={{ borderBottom: '2px solid #e2e8f0', padding: '8px 6px' }}>
                        Px Compra
                      </th>
                      <th className="text-end" style={{ borderBottom: '2px solid #e2e8f0', padding: '8px 6px' }}>
                        Px Actual
                        {futuresPortfolio[0]?.current_price_date && <div style={{ fontSize: '0.6rem', color: '#94a3b8', fontWeight: 400 }}>({futuresPortfolio[0].current_price_date})</div>}
                      </th>
                      <th className="text-end" style={{ borderBottom: '2px solid #e2e8f0', padding: '8px 6px' }} title="Para posiciones abiertas en el mes seleccionado: precio de entrada. Para posiciones de meses anteriores: cierre del último día hábil del mes anterior al filtro.">
                        Px Previo
                      </th>
                      <th className="text-end" style={{ borderBottom: '2px solid #e2e8f0', padding: '8px 6px', color: '#475569' }}>Valor Compra</th>
                      <th className="text-end" style={{ borderBottom: '2px solid #e2e8f0', padding: '8px 6px', color: '#475569' }}>Valor T</th>
                      <th className="text-end" style={{ borderBottom: '2px solid #e2e8f0', padding: '8px 6px', color: '#475569' }}>Valor T-1</th>
                      <th className="text-end" style={{ borderBottom: '2px solid #e2e8f0', padding: '8px 6px', color: '#0f766e', fontWeight: 700 }}>P&G Mes</th>
                      <th className="text-end" style={{ borderBottom: '2px solid #e2e8f0', padding: '8px 6px', color: '#0f766e', fontWeight: 700 }}>P&G Inicio</th>
                      <th style={{ borderBottom: '2px solid #e2e8f0', padding: '8px 6px', width: 120 }}><span className="visually-hidden">Acciones</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      // Pre-compute spread groups (rows sharing portfolio_id, 2 legs opp direction)
                      type SpreadM = { long: FuturesPosition; short: FuturesPosition; nominal: number; mult: number; toUsd: number; spreadOpen: number; spreadCurrent: number | null; spreadPrev: number | null; valorCompra: number; valorT: number | null; valorT1: number | null; pnlMonth: number; pnlInception: number };
                      const spreadMap = new Map<string, SpreadM>();
                      const groups = new Map<string, FuturesPosition[]>();
                      futuresPortfolio.forEach((p) => {
                        if (!p.portfolio_id) return;
                        const arr = groups.get(p.portfolio_id) ?? [];
                        arr.push(p);
                        groups.set(p.portfolio_id, arr);
                      });
                      groups.forEach((legs, pid) => {
                        if (legs.length !== 2) return;
                        const long = legs.find((l) => l.direction === 'LONG');
                        const short = legs.find((l) => l.direction === 'SHORT');
                        if (!long || !short || long.asset !== short.asset) return;
                        const nominal = Math.min(long.nominal ?? 0, short.nominal ?? 0);
                        const mult = long.multiplier ?? 1;
                        const toUsd = long.asset === 'CACAO' ? 1 : 0.01;
                        const spreadOpen = (long.entry_price ?? 0) - (short.entry_price ?? 0);
                        const spreadCurrent = (long.current_price != null && short.current_price != null) ? long.current_price - short.current_price : null;
                        const spreadPrev = (long.precio_previo != null && short.precio_previo != null) ? long.precio_previo - short.precio_previo : null;
                        spreadMap.set(pid, {
                          long, short, nominal, mult, toUsd,
                          spreadOpen, spreadCurrent, spreadPrev,
                          valorCompra: spreadOpen * nominal * mult * toUsd,
                          valorT: spreadCurrent != null ? spreadCurrent * nominal * mult * toUsd : null,
                          valorT1: spreadPrev != null ? spreadPrev * nominal * mult * toUsd : null,
                          pnlMonth: (long.pnl_month ?? 0) + (short.pnl_month ?? 0),
                          pnlInception: (long.pnl_inception ?? 0) + (short.pnl_inception ?? 0),
                        });
                      });
                      const renderedSpreads = new Set<string>();
                      const rendered: React.ReactNode[] = [];

                      futuresPortfolio.forEach((pos, idx) => {
                      const isTotal = pos.asset === 'Total';
                      const isSubtotal = pos.asset?.startsWith('Total ') && !isTotal;
                      const isSummaryRow = isTotal || isSubtotal;
                      const dirColor = pos.direction === 'LONG' ? '#059669' : '#dc2626';

                      // ── Spread handling: render spread-header on first leg, skip second leg ──
                      if (pos.portfolio_id && spreadMap.has(pos.portfolio_id) && !isSummaryRow) {
                        if (renderedSpreads.has(pos.portfolio_id)) return; // skip second leg
                        renderedSpreads.add(pos.portfolio_id);
                        const m = spreadMap.get(pos.portfolio_id)!;
                        const isExpanded = expandedSpreads.has(pos.portfolio_id);
                        const sprColor = m.pnlInception >= 0 ? '#059669' : '#dc2626';
                        const fmtSpread = (v: number | null) => v == null ? '—' : (v >= 0 ? '+' : '') + v.toFixed(2);
                        const toggle = () => setExpandedSpreads((prev) => { const n = new Set(prev); if (n.has(pos.portfolio_id!)) n.delete(pos.portfolio_id!); else n.add(pos.portfolio_id!); return n; });
                        rendered.push(
                          <tr key={`spread-${pos.portfolio_id}`} style={{ background: '#faf5ff', borderTop: '2px solid #c4b5fd' }}>
                            <td style={{ padding: '8px 6px' }}>
                              <button type="button" onClick={toggle} style={{ background: 'none', border: 'none', padding: 0, fontSize: '0.7rem', color: '#7c3aed', marginRight: 4, cursor: 'pointer' }} aria-label={isExpanded ? 'Colapsar' : 'Expandir'}>{isExpanded ? '▾' : '▸'}</button>
                              <span style={{ color: '#7c3aed', fontWeight: 700 }}>{m.long.asset}</span>
                            </td>
                            <td style={{ padding: '8px 6px', color: '#475569', fontWeight: 600, fontSize: '0.75rem' }}>
                              {m.long.contract}/{m.short.contract}
                              <span style={{ color: '#94a3b8', fontSize: '0.65rem', marginLeft: 4 }}>(spread #{pos.portfolio_id})</span>
                            </td>
                            <td style={{ padding: '8px 6px', color: '#7c3aed', fontWeight: 600, fontSize: '0.7rem', letterSpacing: '0.05em' }}>SPREAD</td>
                            <td className="text-center" style={{ padding: '8px 6px' }}>{m.nominal}</td>
                            <td style={{ padding: '8px 6px', color: '#64748b', fontSize: '0.75rem' }}>{m.long.entry_date}</td>
                            <td className="text-center" style={{ padding: '8px 6px', fontSize: '0.65rem', color: '#94a3b8' }}>{({ MAIZ: '5,000 bu', AZUCAR: '112,000 lbs', CACAO: '10 ton' } as Record<string,string>)[m.long.asset] ?? ''}</td>
                            <td className="text-end" style={{ padding: '8px 6px', fontSize: '0.75rem' }} title="Spread apertura (long − short)">Δ {fmtSpread(m.spreadOpen)}</td>
                            <td className="text-end" style={{ padding: '8px 6px', fontSize: '0.75rem', fontWeight: 600 }} title="Spread actual">Δ {fmtSpread(m.spreadCurrent)}</td>
                            <td className="text-end" style={{ padding: '8px 6px', fontSize: '0.75rem' }} title="Spread previo">Δ {fmtSpread(m.spreadPrev)}</td>
                            <td className="text-end" style={{ padding: '8px 6px' }}>{fmtUsd(Math.round(m.valorCompra))}</td>
                            <td className="text-end" style={{ padding: '8px 6px' }}>{m.valorT != null ? fmtUsd(Math.round(m.valorT)) : ''}</td>
                            <td className="text-end" style={{ padding: '8px 6px' }}>{m.valorT1 != null ? fmtUsd(Math.round(m.valorT1)) : ''}</td>
                            <td className="text-end" style={{ padding: '8px 6px', fontWeight: 600, color: m.pnlMonth >= 0 ? '#059669' : '#dc2626' }}>{fmtUsd(m.pnlMonth)}</td>
                            <td className="text-end" style={{ padding: '8px 6px', fontWeight: 600, color: sprColor }}>{fmtUsd(m.pnlInception)}</td>
                            <td style={{ padding: '8px 6px' }}>{' '}</td>
                          </tr>
                        );
                        if (isExpanded) {
                          [m.long, m.short].forEach((leg) => {
                            const legDirColor = leg.direction === 'LONG' ? '#059669' : '#dc2626';
                            rendered.push(
                              <tr key={`leg-${leg.id ?? leg.contract}`} style={{ background: '#fafafa', fontSize: '0.78rem' }}>
                                <td style={{ padding: '6px 6px 6px 28px', color: '#94a3b8', fontStyle: 'italic' }}>↳ leg</td>
                                <td style={{ padding: '6px 6px', color: '#64748b' }}>{leg.contract}{leg.contract && parseContractMaturity(leg.contract) && <span style={{ color: '#cbd5e1', fontSize: '0.7rem', marginLeft: 4 }}>({parseContractMaturity(leg.contract)})</span>}</td>
                                <td style={{ padding: '6px 6px', color: legDirColor, fontWeight: 600, fontSize: '0.7rem' }}>{leg.direction}</td>
                                <td className="text-center" style={{ padding: '6px 6px' }}>{leg.nominal}</td>
                                <td style={{ padding: '6px 6px', color: '#94a3b8', fontSize: '0.7rem' }}>{leg.entry_date}</td>
                                <td className="text-center" style={{ padding: '6px 6px' }}>{' '}</td>
                                <td className="text-end" style={{ padding: '6px 6px' }}>{leg.entry_price != null ? fmt(leg.entry_price, 2) : ''}</td>
                                <td className="text-end" style={{ padding: '6px 6px' }} title={leg.current_price_date ? `Precio del ${leg.current_price_date}` : undefined}>{leg.current_price != null ? fmt(leg.current_price, 2) : ''}</td>
                                <td className="text-end" style={{ padding: '6px 6px' }} title={leg.precio_previo_date ? `Precio previo del ${leg.precio_previo_date}` : undefined}>{leg.precio_previo != null ? fmt(leg.precio_previo, 2) : ''}</td>
                                <td className="text-end" style={{ padding: '6px 6px', color: '#94a3b8' }}>{leg.entry_price != null && leg.nominal != null ? fmtUsd(Math.round(leg.entry_price * (leg.multiplier ?? 1) * leg.nominal * (leg.asset === 'CACAO' ? 1 : 0.01))) : ''}</td>
                                <td className="text-end" style={{ padding: '6px 6px', color: '#94a3b8' }}>{leg.valor_t != null ? fmtUsd(leg.valor_t) : ''}</td>
                                <td className="text-end" style={{ padding: '6px 6px', color: '#94a3b8' }}>{leg.valor_t1 != null ? fmtUsd(leg.valor_t1) : ''}</td>
                                <td className={`text-end ${pnlClass(leg.pnl_month)}`} style={{ padding: '6px 6px' }}>{leg.pnl_month != null ? fmtUsd(leg.pnl_month) : ''}</td>
                                <td className={`text-end ${pnlClass(leg.pnl_inception)}`} style={{ padding: '6px 6px' }}>{leg.pnl_inception != null ? fmtUsd(leg.pnl_inception) : ''}</td>
                                <td style={{ padding: '6px 6px' }}>
                                  {leg.id && (
                                    <div className="d-flex gap-1 justify-content-end">
                                      <button type="button" className="btn btn-sm" style={{ fontSize: '0.62rem', padding: '1px 6px', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: 4 }}
                                        onClick={() => { setEditModal(leg); setEditFields({ asset: leg.asset, contract: leg.contract ?? '', direction: (leg.direction as 'LONG' | 'SHORT') ?? 'SHORT', nominal: leg.nominal ?? 1, entry_price: leg.entry_price ?? 0, entry_date: leg.entry_date ?? '' }); }}>Editar</button>
                                      <button type="button" className="btn btn-sm" style={{ fontSize: '0.62rem', padding: '1px 6px', color: '#94a3b8' }}
                                        onClick={() => handleDelete(leg)} title="Eliminar" aria-label="Eliminar leg">&times;</button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          });
                        }
                        return;
                      }

                      // Normal row
                      rendered.push(
                        <tr key={pos.id ?? `row-${idx}`} style={getRowStyle(isTotal, isSubtotal)}>
                          <td style={{ padding: '8px 6px', fontWeight: isSummaryRow ? 700 : 400 }}>
                            {/* eslint-disable-next-line no-nested-ternary */}
                            <span style={{ color: isTotal ? '#1e293b' : (isSubtotal ? '#475569' : '#7c3aed'), fontWeight: 600 }}>{pos.asset}</span>
                          </td>
                          <td style={{ padding: '8px 6px', color: '#64748b' }}>
                            {isSummaryRow ? '' : (
                              <>
                                <span style={{ fontWeight: 600 }}>{pos.contract ?? ''}</span>
                                {pos.contract && parseContractMaturity(pos.contract) && (
                                  <span style={{ color: '#94a3b8', fontSize: '0.7rem', marginLeft: 4 }}>
                                    ({parseContractMaturity(pos.contract)})
                                  </span>
                                )}
                              </>
                            )}
                          </td>
                          <td style={{ padding: '8px 6px', color: dirColor, fontWeight: 600, fontSize: '0.75rem' }}>{isSummaryRow ? '' : (pos.direction ?? '')}</td>
                          <td className="text-center" style={{ padding: '8px 6px', fontWeight: isSummaryRow ? 700 : 400 }}>{pos.nominal || ''}</td>
                          <td style={{ padding: '8px 6px', color: '#64748b', fontSize: '0.75rem' }}>{isSummaryRow ? '' : (pos.entry_date ?? '')}</td>
                          <td className="text-center" style={{ padding: '8px 6px', fontSize: '0.65rem', color: '#94a3b8' }}>
                            {!isSummaryRow && pos.asset ? ({ MAIZ: '5,000 bu', AZUCAR: '112,000 lbs', CACAO: '10 ton' }[pos.asset] ?? '') : ''}
                          </td>
                          <td className="text-end" style={{ padding: '8px 6px' }}>{!isSummaryRow && pos.entry_price != null ? fmt(pos.entry_price, 2) : ''}</td>
                          <td className="text-end" style={{ padding: '8px 6px', fontWeight: 600 }} title={!isSummaryRow && pos.current_price_date ? `Precio del ${pos.current_price_date}` : undefined}>{!isSummaryRow && pos.current_price != null ? fmt(pos.current_price, 2) : ''}</td>
                          <td className="text-end" style={{ padding: '8px 6px' }} title={!isSummaryRow && pos.precio_previo_date ? `Precio previo del ${pos.precio_previo_date}` : undefined}>{!isSummaryRow && pos.precio_previo != null ? fmt(pos.precio_previo, 2) : ''}</td>
                          <td className="text-end" style={{ padding: '8px 6px' }}>{!isSummaryRow && pos.entry_price != null && pos.nominal != null ? fmtUsd(Math.round(pos.entry_price * (pos.multiplier ?? 1) * pos.nominal * ({ MAIZ: 0.01, AZUCAR: 0.01, CACAO: 1 }[pos.asset] ?? 1))) : ''}</td>
                          <td className="text-end" style={{ padding: '8px 6px' }}>{pos.valor_t != null ? fmtUsd(pos.valor_t) : ''}</td>
                          <td className="text-end" style={{ padding: '8px 6px' }}>{pos.valor_t1 != null ? fmtUsd(pos.valor_t1) : ''}</td>
                          <td className={`text-end ${pnlClass(pos.pnl_month)}`} style={{ padding: '8px 6px', fontWeight: 600 }}>{pos.pnl_month != null ? fmtUsd(pos.pnl_month) : ''}</td>
                          <td className={`text-end ${pnlClass(pos.pnl_inception)}`} style={{ padding: '8px 6px', fontWeight: 600 }}>{pos.pnl_inception != null ? fmtUsd(pos.pnl_inception) : ''}</td>
                          <td style={{ padding: '8px 6px' }}>
                            {!isSummaryRow && pos.id && (
                              <div className="d-flex gap-1 justify-content-end">
                                <button type="button" className="btn btn-sm" style={{ fontSize: '0.65rem', padding: '2px 8px', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: 4 }}
                                  onClick={() => { setEditModal(pos); setEditFields({ asset: pos.asset, contract: pos.contract ?? '', direction: (pos.direction as 'LONG' | 'SHORT') ?? 'SHORT', nominal: pos.nominal ?? 1, entry_price: pos.entry_price ?? 0, entry_date: pos.entry_date ?? '' }); }}>
                                  Editar
                                </button>
                                <button type="button" className="btn btn-sm" style={{ fontSize: '0.65rem', padding: '2px 8px', color: '#3b82f6', border: '1px solid #bfdbfe', borderRadius: 4 }}
                                  onClick={() => { setRollModal(pos); setRollContract(''); setRollPrice(''); setRollEntryPrice(''); }}>
                                  Roll
                                </button>
                                <button type="button" className="btn btn-sm" style={{ fontSize: '0.65rem', padding: '2px 8px', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 4 }}
                                  onClick={() => { setCloseModal(pos); setClosePrice(pos.current_price?.toString() ?? ''); }}>
                                  Cerrar
                                </button>
                                <button type="button" className="btn btn-sm" style={{ fontSize: '0.65rem', padding: '2px 6px', color: '#94a3b8' }}
                                  onClick={() => handleDelete(pos)} title="Eliminar" aria-label="Eliminar posición">
                                  &times;
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    });
                    return rendered;
                    })()}
                  </tbody>
                </table>
                </div>
              </div>
            )}

            {/* Multiplier reference */}
            {futuresPortfolio.length > 0 && (
              <div className="mt-2" style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                Multiplicadores: MAIZ = 5,000 bu/contrato · AZUCAR = 112,000 lbs/contrato · CACAO = 10 ton/contrato
              </div>
            )}
          </div>
        )}
      </Container>
      )}

      {/* Edit Position Modal */}
      <Modal show={editModal != null} onHide={() => setEditModal(null)} size="sm">
        <Modal.Header closeButton style={{ background: '#1e293b' }}>
          <Modal.Title style={{ color: '#fff', fontSize: '0.95rem' }}>
            Editar: {editModal?.asset} {editModal?.contract}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-2">
            <Form.Label className="small">Activo</Form.Label>
            <Form.Select size="sm" value={editFields.asset ?? ''} onChange={(e) => setEditFields({ ...editFields, asset: e.target.value })}>
              {(companyConfig?.commodities ?? [{asset:'MAIZ'},{asset:'AZUCAR'},{asset:'CACAO'}]).map((c) => (
                <option key={c.asset} value={c.asset}>{c.asset}</option>
              ))}
            </Form.Select>
          </Form.Group>
          <Form.Group className="mb-2">
            <Form.Label className="small">Contrato</Form.Label>
            <Form.Control size="sm" value={editFields.contract ?? ''} onChange={(e) => setEditFields({ ...editFields, contract: e.target.value.toUpperCase() })} />
          </Form.Group>
          <Form.Group className="mb-2">
            <Form.Label className="small">Dirección</Form.Label>
            <Form.Select size="sm" value={editFields.direction ?? 'SHORT'} onChange={(e) => setEditFields({ ...editFields, direction: e.target.value as 'LONG' | 'SHORT' })}>
              <option value="LONG">LONG</option>
              <option value="SHORT">SHORT</option>
            </Form.Select>
          </Form.Group>
          <Form.Group className="mb-2">
            <Form.Label className="small">Contratos</Form.Label>
            <Form.Control size="sm" type="number" min={1} value={editFields.nominal ?? 1} onChange={(e) => setEditFields({ ...editFields, nominal: parseInt(e.target.value, 10) || 1 })} />
          </Form.Group>
          <Form.Group className="mb-2">
            <Form.Label className="small">Precio Compra</Form.Label>
            <Form.Control size="sm" type="number" step="0.01" value={editFields.entry_price ?? ''} onChange={(e) => setEditFields({ ...editFields, entry_price: parseFloat(e.target.value) || 0 })} />
          </Form.Group>
          <Form.Group className="mb-2">
            <Form.Label className="small">Fecha Entrada</Form.Label>
            <Form.Control size="sm" type="date" value={editFields.entry_date ?? ''} onChange={(e) => setEditFields({ ...editFields, entry_date: e.target.value })} />
          </Form.Group>
          <Button className="btn-sm btn-primary w-100 mt-2" onClick={handleEdit}>
            Guardar Cambios
          </Button>
        </Modal.Body>
      </Modal>

      {/* Roll Modal */}
      <Modal show={rollModal != null} onHide={() => setRollModal(null)} size="sm">
        <Modal.Header closeButton style={{ background: '#1e293b' }}>
          <Modal.Title style={{ color: '#fff', fontSize: '0.95rem' }}>
            Roll: {rollModal?.asset} {rollModal?.contract}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-2">
            <Form.Label className="small">Nuevo Contrato</Form.Label>
            <Form.Control size="sm" placeholder="ZCN26" value={rollContract} onChange={(e) => setRollContract(e.target.value.toUpperCase())} />
          </Form.Group>
          <Form.Group className="mb-2">
            <Form.Label className="small">Precio de Cierre (contrato actual)</Form.Label>
            <Form.Control size="sm" type="number" step="0.01" value={rollPrice} onChange={(e) => setRollPrice(e.target.value)} />
          </Form.Group>
          <Form.Group className="mb-2">
            <Form.Label className="small">Precio Entrada (nuevo contrato)</Form.Label>
            <Form.Control size="sm" type="number" step="0.01" value={rollEntryPrice} onChange={(e) => setRollEntryPrice(e.target.value)} placeholder="Mismo que cierre si vacío" />
          </Form.Group>
          <Button className="btn-sm btn-primary w-100 mt-2" onClick={handleRoll} disabled={!rollContract || !rollPrice}>
            Ejecutar Roll
          </Button>
        </Modal.Body>
      </Modal>

      {/* Close Position Modal */}
      <Modal show={closeModal != null} onHide={() => setCloseModal(null)} size="sm">
        <Modal.Header closeButton style={{ background: '#1e293b' }}>
          <Modal.Title style={{ color: '#fff', fontSize: '0.95rem' }}>
            Cerrar: {closeModal?.asset} {closeModal?.contract}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-2">
            <Form.Label className="small">Precio de Cierre</Form.Label>
            <Form.Control size="sm" type="number" step="0.01" value={closePrice} onChange={(e) => setClosePrice(e.target.value)} />
          </Form.Group>
          <Button className="btn-sm btn-danger w-100 mt-2" onClick={handleClose} disabled={!closePrice}>
            Cerrar Posición
          </Button>
        </Modal.Body>
      </Modal>

      {/* ─── PRECIOS LOCALES TAB (solo si empresa tiene CAFE) ─── */}
        {activeTab === 'coffee' && (
          <div>
            <Row className="mb-3 align-items-center">
              <Col xs="auto">
                <Button variant="primary" size="sm" onClick={handleFetchCoffeePrices} disabled={coffeeLoading}>
                  <Icon icon={faSyncAlt} className={coffeeLoading ? 'fa-spin me-1' : 'me-1'} />
                  Actualizar
                </Button>
              </Col>
            </Row>

            {coffeeLoading && <p className="text-muted">Cargando precios...</p>}

            {!coffeeLoading && coffeePrices.length === 0 && (
              <p className="text-muted text-center mt-4">Sin datos de precios locales de café.</p>
            )}

            {coffeePrices.length > 0 && (() => {
              const TIPO_LABELS: Record<string, string> = {
                precio_interno_carga: 'Precio Interno Carga',
                precio_base_f90: 'Base F90',
                precio_ref_f94: 'Referencia F94',
                precio_nespresso_f90: 'Nespresso F90',
                precio_cp_creciente_f90: 'CP Creciente F90',
                precio_humedo_cereza: 'Húmedo Cereza',
              };
              const ANSERMA_COLORS: Record<string, string> = {
                precio_base_f90: '#2563eb',
                precio_ref_f94: '#7c3aed',
                precio_nespresso_f90: '#059669',
                precio_cp_creciente_f90: '#d97706',
                precio_humedo_cereza: '#0891b2',
              };
              const fmtCOP = (v: number) => `$${v.toLocaleString('es-CO')}`;

              // ── Separate data by fuente ──
              const ansermaRows = coffeePrices.filter((r) => r.fuente === 'ANSERMA');
              const fncRows = coffeePrices.filter((r) => r.fuente === 'FNC');

              // ── ANSERMA chart data ──
              const ansermaTipos = Array.from(new Set(ansermaRows.map((r) => r.tipo_precio))).sort();
              const ansermaFechas = Array.from(new Set(ansermaRows.map((r) => r.fecha))).sort();
              const ansermaChartData = ansermaFechas.map((fecha) => {
                const point: Record<string, string | number | null> = { fecha };
                ansermaTipos.forEach((tipo) => {
                  const row = ansermaRows.find((r) => r.fecha === fecha && r.tipo_precio === tipo);
                  point[tipo] = row ? parseFloat(row.valor) : null;
                });
                return point;
              });

              // ── FNC chart data (with date filter) ──
              const fncTipos = Array.from(new Set(fncRows.map((r) => r.tipo_precio))).sort();
              const filteredFnc = fncRows.filter((r) => {
                if (fncDateFrom && r.fecha < fncDateFrom) return false;
                if (fncDateTo && r.fecha > fncDateTo) return false;
                return true;
              });
              const fncFechas = Array.from(new Set(filteredFnc.map((r) => r.fecha))).sort();
              const fncChartData = fncFechas.map((fecha) => {
                const point: Record<string, string | number | null> = { fecha };
                fncTipos.forEach((tipo) => {
                  const row = filteredFnc.find((r) => r.fecha === fecha && r.tipo_precio === tipo);
                  point[tipo] = row ? parseFloat(row.valor) : null;
                });
                return point;
              });

              // Date range for FNC (min/max from data)
              const allFncFechas = Array.from(new Set(fncRows.map((r) => r.fecha))).sort();
              const fncMinDate = allFncFechas[0] ?? '';
              const fncMaxDate = allFncFechas[allFncFechas.length - 1] ?? '';

              const cardStyle = { background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', padding: '24px', marginBottom: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' };
              const headerStyle = { color: '#7c3aed', fontWeight: 700 as const, marginBottom: 20, display: 'flex' as const, alignItems: 'center' as const, gap: 8 };

              return (
                <>
                  {/* ══════════ COOPERATIVA DE ANSERMA ══════════ */}
                  {ansermaRows.length > 0 && (
                    <div style={cardStyle}>
                      <div style={headerStyle}>
                        <span style={{ background: '#f0fdf4', color: '#059669', padding: '4px 10px', borderRadius: 6, fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' as const }}>Anserma</span>
                        <h6 style={{ margin: 0, color: '#1e293b', fontWeight: 700 }}>Cooperativa de Caficultores de Anserma</h6>
                      </div>
                      <ResponsiveContainer width="100%" height={340}>
                        <LineChart data={ansermaChartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="fecha" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
                          <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={(v: number) => fmtCOP(v)} width={100} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} domain={['dataMin - 5000', 'dataMax + 5000']} />
                          <Tooltip
                            formatter={(value: number, name: string) => [fmtCOP(value), TIPO_LABELS[name] ?? name]}
                            labelStyle={{ fontWeight: 700, color: '#1e293b' }}
                            contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                          />
                          <Legend formatter={(value: string) => TIPO_LABELS[value] ?? value} wrapperStyle={{ fontSize: '0.75rem', paddingTop: 12 }} />
                          {ansermaTipos.map((tipo) => (
                            <Line key={tipo} type="monotone" dataKey={tipo} stroke={ANSERMA_COLORS[tipo] ?? '#64748b'} strokeWidth={2.5} dot={{ r: 3, strokeWidth: 2 }} activeDot={{ r: 5 }} connectNulls />
                          ))}
                        </LineChart>
                      </ResponsiveContainer>

                      {/* Table */}
                      <div className="table-responsive mt-3">
                        <table className="table table-sm mb-0" style={{ fontSize: '0.78rem' }}>
                          <thead>
                            <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                              <th style={{ color: '#94a3b8', fontSize: '0.7rem', fontWeight: 600 }}>Fecha</th>
                              {ansermaTipos.map((t) => (
                                <th key={t} className="text-end" style={{ color: ANSERMA_COLORS[t] ?? '#64748b', fontSize: '0.7rem', fontWeight: 600 }}>
                                  {TIPO_LABELS[t] ?? t}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {ansermaFechas.slice(-10).reverse().map((fecha) => (
                              <tr key={fecha} style={{ borderBottom: '1px solid #f8fafc' }}>
                                <td style={{ padding: '7px 8px', color: '#475569', fontWeight: 500 }}>{fecha}</td>
                                {ansermaTipos.map((tipo) => {
                                  const row = ansermaRows.find((r) => r.fecha === fecha && r.tipo_precio === tipo);
                                  return (
                                    <td key={tipo} className="text-end" style={{ padding: '7px 8px', fontWeight: 600, color: '#1e293b' }}>
                                      {row ? fmtCOP(parseFloat(row.valor)) : '—'}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* ══════════ FONDO NACIONAL DE CAFETEROS ══════════ */}
                  {fncRows.length > 0 && (
                    <div style={cardStyle}>
                      <div style={{ ...headerStyle, justifyContent: 'space-between', flexWrap: 'wrap' as const }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ background: '#fef2f2', color: '#dc2626', padding: '4px 10px', borderRadius: 6, fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' as const }}>FNC</span>
                          <h6 style={{ margin: 0, color: '#1e293b', fontWeight: 700 }}>Fondo Nacional de Cafeteros</h6>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 500 }}>Desde</span>
                          <Form.Control
                            type="date"
                            size="sm"
                            value={fncDateFrom || fncMinDate}
                            min={fncMinDate}
                            max={fncMaxDate}
                            onChange={(e) => setFncDateFrom(e.target.value)}
                            style={{ width: 150, fontSize: '0.78rem' }}
                          />
                          <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 500 }}>Hasta</span>
                          <Form.Control
                            type="date"
                            size="sm"
                            value={fncDateTo || fncMaxDate}
                            min={fncMinDate}
                            max={fncMaxDate}
                            onChange={(e) => setFncDateTo(e.target.value)}
                            style={{ width: 150, fontSize: '0.78rem' }}
                          />
                        </div>
                      </div>

                      <ResponsiveContainer width="100%" height={340}>
                        <LineChart data={fncChartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="fecha" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
                          <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={(v: number) => `$${(v / 1000000).toFixed(1)}M`} width={70} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} domain={['auto', 'auto']} />
                          <Tooltip
                            formatter={(value: number, name: string) => [fmtCOP(value), TIPO_LABELS[name] ?? name]}
                            labelStyle={{ fontWeight: 700, color: '#1e293b' }}
                            contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                          />
                          {fncTipos.map((tipo) => (
                            <Line key={tipo} type="monotone" dataKey={tipo} stroke="#dc2626" strokeWidth={2.5} dot={{ r: 4, fill: '#dc2626', strokeWidth: 0 }} activeDot={{ r: 6, stroke: '#dc2626', strokeWidth: 2, fill: '#fff' }} connectNulls />
                          ))}
                        </LineChart>
                      </ResponsiveContainer>

                      {/* Table */}
                      <div className="table-responsive mt-3">
                        <table className="table table-sm mb-0" style={{ fontSize: '0.78rem' }}>
                          <thead>
                            <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                              <th style={{ color: '#94a3b8', fontSize: '0.7rem', fontWeight: 600 }}>Fecha</th>
                              {fncTipos.map((t) => (
                                <th key={t} className="text-end" style={{ color: '#dc2626', fontSize: '0.7rem', fontWeight: 600 }}>
                                  {TIPO_LABELS[t] ?? t}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {fncFechas.slice(-10).reverse().map((fecha) => (
                              <tr key={fecha} style={{ borderBottom: '1px solid #f8fafc' }}>
                                <td style={{ padding: '7px 8px', color: '#475569', fontWeight: 500 }}>{fecha}</td>
                                {fncTipos.map((tipo) => {
                                  const row = filteredFnc.find((r) => r.fecha === fecha && r.tipo_precio === tipo);
                                  return (
                                    <td key={tipo} className="text-end" style={{ padding: '7px 8px', fontWeight: 600, color: '#1e293b' }}>
                                      {row ? fmtCOP(parseFloat(row.valor)) : '—'}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}

      {/* ─── CALCULADORA USDCOP TAB ─── */}
        {activeTab === 'usdcop' && (
          <div>
            <Row className="mb-3 align-items-center">
              <Col xs="auto">
                <Button variant="primary" size="sm" onClick={handleFetchUsdcop} disabled={usdcopLoading}>
                  <Icon icon={faSyncAlt} className={usdcopLoading ? 'fa-spin me-1' : 'me-1'} />
                  Actualizar
                </Button>
              </Col>
              <Col>
                <span className="text-muted" style={{ fontSize: '0.8rem' }}>
                  Proyección de rango de precio basada en volatilidad histórica rolling 180 días
                </span>
              </Col>
            </Row>

            {usdcopLoading && !usdcopData && <p className="text-muted">Cargando datos...</p>}

            {usdcopData && (() => {
              const TRM = usdcopData.trm;
              const VOL_D = usdcopData.vol_diaria;
              const CONF: Record<string, number> = {
                '0.5': 38.3, '1': 68.3, '1.5': 86.6, '2': 95.4, '2.5': 98.8, '3': 99.7,
              };
              const bandAt = (t: number, k: number) => {
                const sig = VOL_D * Math.sqrt(t) * k;
                return { floor: TRM * (1 - sig), ceil: TRM * (1 + sig) };
              };
              const { floor, ceil } = bandAt(usdcopDays, usdcopSigma);
              const width = ceil - floor;
              const widthPct = (width / TRM) * 100;
              const confKey = usdcopSigma.toString();
              const conf = CONF[confKey] ?? CONF[usdcopSigma.toFixed(1)] ?? 0;
              const fmtUsdcop = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

              // Chart data: cono de incertidumbre hasta T días
              const chartData = Array.from({ length: usdcopDays + 1 }, (_, t) => {
                if (t === 0) {
                  return { t, floor: TRM, ceil: TRM, trm: TRM, spread: 0 };
                }
                const b = bandAt(t, usdcopSigma);
                return { t, floor: b.floor, ceil: b.ceil, trm: TRM, spread: b.ceil - b.floor };
              });

              const statCardStyle = { background: '#f7f9fc', border: '1px solid #d9e1ec', borderRadius: 10, padding: '14px 16px' };
              const statLabel = { fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: '0.05em', fontWeight: 600 };
              const statVal = { fontFamily: 'ui-monospace, Consolas, monospace', fontSize: '1.3rem', fontWeight: 600, marginTop: 4 };

              const resultCardStyle = { background: '#eef2f8', border: '1px solid #d9e1ec', borderRadius: 10, padding: '14px', textAlign: 'center' as const };
              const resultLabel = { fontSize: '0.68rem', color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: '0.06em', fontWeight: 600 };
              const resultVal = { fontFamily: 'ui-monospace, Consolas, monospace', fontSize: '1.45rem', fontWeight: 700, marginTop: 6 };

              return (
                <>
                  {/* Stats cards: TRM / Fecha / Vol D / Vol A */}
                  <Row className="g-2 mb-3">
                    <Col xs={6} md={3}>
                      <div style={statCardStyle}>
                        <div style={statLabel}>TRM actual</div>
                        <div style={statVal}>{fmtUsdcop(TRM)}</div>
                      </div>
                    </Col>
                    <Col xs={6} md={3}>
                      <div style={statCardStyle}>
                        <div style={statLabel}>Fecha</div>
                        <div style={statVal}>{usdcopData.fecha.slice(0, 10)}</div>
                      </div>
                    </Col>
                    <Col xs={6} md={3}>
                      <div style={statCardStyle}>
                        <div style={statLabel}>Vol. diaria (180d)</div>
                        <div style={statVal}>{(VOL_D * 100).toFixed(4)}%</div>
                      </div>
                    </Col>
                    <Col xs={6} md={3}>
                      <div style={statCardStyle}>
                        <div style={statLabel}>Vol. anual (180d)</div>
                        <div style={statVal}>{(usdcopData.vol_anual * 100).toFixed(2)}%</div>
                      </div>
                    </Col>
                  </Row>

                  <h5 style={{ fontSize: '1.1rem', marginTop: 24, marginBottom: 12, fontWeight: 700 }}>1. Calculadora interactiva</h5>

                  {/* Controls + Results card */}
                  <div style={{ background: '#f7f9fc', border: '1px solid #d9e1ec', borderRadius: 12, padding: 22, marginBottom: 20 }}>
                    <Row className="g-4">
                      <Col xs={12} md={6}>
                        <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          <span>Días a pronosticar</span>
                          <span style={{ color: '#059669', fontFamily: 'ui-monospace, Consolas, monospace', fontWeight: 600 }}>{usdcopDays} día{usdcopDays === 1 ? '' : 's'}</span>
                        </div>
                        <Form.Range min={1} max={180} step={1} value={usdcopDays} onChange={(e) => setUsdcopDays(parseInt(e.target.value, 10))} />
                      </Col>
                      <Col xs={12} md={6}>
                        <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          <span>Desviaciones estándar</span>
                          <span style={{ color: '#059669', fontFamily: 'ui-monospace, Consolas, monospace', fontWeight: 600 }}>{usdcopSigma.toFixed(1)} σ</span>
                        </div>
                        <Form.Range min={0.5} max={3.0} step={0.5} value={usdcopSigma} onChange={(e) => setUsdcopSigma(parseFloat(e.target.value))} />
                      </Col>
                    </Row>

                    <Row className="g-2 mt-2">
                      <Col xs={6} md={3}>
                        <div style={resultCardStyle}>
                          <div style={resultLabel}>Piso</div>
                          <div style={{ ...resultVal, color: '#dc2626' }}>{fmtUsdcop(floor)}</div>
                        </div>
                      </Col>
                      <Col xs={6} md={3}>
                        <div style={resultCardStyle}>
                          <div style={resultLabel}>Techo</div>
                          <div style={{ ...resultVal, color: '#059669' }}>{fmtUsdcop(ceil)}</div>
                        </div>
                      </Col>
                      <Col xs={6} md={3}>
                        <div style={resultCardStyle}>
                          <div style={resultLabel}>Amplitud</div>
                          <div style={{ ...resultVal, color: '#d97706' }}>{fmtUsdcop(width)} ({widthPct.toFixed(1)}%)</div>
                        </div>
                      </Col>
                      <Col xs={6} md={3}>
                        <div style={resultCardStyle}>
                          <div style={resultLabel}>Confianza</div>
                          <div style={{ ...resultVal, color: '#2563eb' }}>{conf.toFixed(1)}%</div>
                        </div>
                      </Col>
                    </Row>
                  </div>

                  {/* Chart */}
                  <div style={{ background: '#f7f9fc', border: '1px solid #d9e1ec', borderRadius: 12, padding: 20, marginBottom: 28, height: 420 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 20, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(217,225,236,0.6)" />
                        <XAxis dataKey="t" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} label={{ value: 'Días hacia adelante', position: 'insideBottom', offset: -5, fill: '#64748b', fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v: number) => fmtUsdcop(v)} width={75} domain={['auto', 'auto']} tickLine={false} label={{ value: 'COP por USD', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 12 }} />
                        <Tooltip
                          formatter={(value: number, name: string) => {
                            const labelMap: Record<string, string> = { floor: 'Piso', ceil: 'Techo', trm: 'TRM actual' };
                            return [fmtUsdcop(value), labelMap[name] ?? name];
                          }}
                          labelFormatter={(v: number) => `Día ${v}`}
                          contentStyle={{ borderRadius: 8, border: '1px solid #d9e1ec' }}
                        />
                        <Legend
                          formatter={(value: string) => {
                            const labelMap: Record<string, string> = { floor: 'Piso', ceil: 'Techo', trm: 'TRM actual' };
                            return labelMap[value] ?? value;
                          }}
                          wrapperStyle={{ fontSize: '0.78rem' }}
                        />
                        <Area type="monotone" dataKey="ceil" stroke="#059669" fill="rgba(5,150,105,0.12)" strokeWidth={2} dot={false} activeDot={false} />
                        <Area type="monotone" dataKey="floor" stroke="#dc2626" fill="#ffffff" strokeWidth={2} dot={false} activeDot={false} />
                        <Line type="monotone" dataKey="trm" stroke="#2563eb" strokeDasharray="6 4" strokeWidth={1.5} dot={false} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Justificación estadística */}
                  <h5 style={{ fontSize: '1.1rem', marginTop: 24, marginBottom: 12, fontWeight: 700 }}>2. Justificación estadística</h5>

                  <div style={{ background: '#f7f9fc', border: '1px solid #d9e1ec', borderRadius: 12, padding: 22, marginBottom: 20 }}>
                    <h6 style={{ color: '#2563eb', fontSize: '1rem', marginTop: 0, marginBottom: 8 }}>¿Qué es la volatilidad rolling 180 días y por qué 180?</h6>
                    <p style={{ color: '#334155', fontSize: '0.92rem' }}>
                      La <strong>volatilidad rolling</strong> es la desviación estándar de los retornos logarítmicos diarios
                      calculada sobre una ventana móvil. Con 180 días hábiles (~9 meses calendario) logramos un balance entre:
                    </p>
                    <ul style={{ color: '#334155', fontSize: '0.92rem' }}>
                      <li><strong>Estabilidad estadística:</strong> suficientes observaciones (~180) para un estimador robusto.</li>
                      <li><strong>Relevancia temporal:</strong> captura el régimen reciente sin arrastrar shocks antiguos.</li>
                      <li><strong>Ciclos macro:</strong> abarca al menos dos reuniones del Banco de la República y un ciclo fiscal parcial.</li>
                    </ul>
                    <p style={{ color: '#334155', fontSize: '0.92rem' }}>
                      Ventanas más cortas (30–60d) son reactivas pero ruidosas; más largas (365d+) suavizan demasiado y ocultan
                      cambios de régimen. 180d es el estándar de la industria para pares FX de mercados emergentes.
                    </p>

                    <h6 style={{ color: '#2563eb', fontSize: '1rem', marginTop: 20, marginBottom: 8 }}>¿Qué significa cada nivel de desviación estándar?</h6>
                    <p style={{ color: '#334155', fontSize: '0.92rem' }}>Bajo el supuesto de normalidad, el siguiente porcentaje de observaciones cae dentro de ±Nσ respecto a la media:</p>
                    <table className="table table-sm" style={{ fontSize: '0.88rem', marginBottom: 16 }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid #d9e1ec' }}>
                          <th style={{ color: '#64748b', textTransform: 'uppercase', fontSize: '0.72rem' }}>Nivel</th>
                          <th style={{ color: '#64748b', textTransform: 'uppercase', fontSize: '0.72rem' }}>Confianza</th>
                          <th style={{ color: '#64748b', textTransform: 'uppercase', fontSize: '0.72rem' }}>Interpretación</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr><td style={{ fontFamily: 'monospace' }}>1.0 σ</td><td style={{ fontFamily: 'monospace' }}>68.3%</td><td>Rango típico, ~2 de 3 días</td></tr>
                        <tr><td style={{ fontFamily: 'monospace' }}>1.5 σ</td><td style={{ fontFamily: 'monospace' }}>86.6%</td><td>Rango amplio, ~6 de 7 días</td></tr>
                        <tr><td style={{ fontFamily: 'monospace' }}>2.0 σ</td><td style={{ fontFamily: 'monospace' }}>95.4%</td><td>Rango conservador, ~19 de 20 días</td></tr>
                        <tr><td style={{ fontFamily: 'monospace' }}>2.5 σ</td><td style={{ fontFamily: 'monospace' }}>98.8%</td><td>Rango extremo, ~1 excepción en 83 días</td></tr>
                        <tr><td style={{ fontFamily: 'monospace' }}>3.0 σ</td><td style={{ fontFamily: 'monospace' }}>99.7%</td><td>Rango máximo, ~1 excepción en 370 días</td></tr>
                      </tbody>
                    </table>

                    <h6 style={{ color: '#2563eb', fontSize: '1rem', marginTop: 20, marginBottom: 8 }}>¿Por qué el rango se amplía con el tiempo? (Raíz del tiempo)</h6>
                    <p style={{ color: '#334155', fontSize: '0.92rem' }}>
                      Si los retornos diarios son independientes e idénticamente distribuidos, la varianza es aditiva:
                      la varianza de T días equivale a T veces la varianza de un día. Como la volatilidad es la raíz cuadrada de la varianza:
                    </p>
                    <p style={{ textAlign: 'center', fontFamily: 'ui-monospace, Consolas, monospace', fontSize: '1.05rem', color: '#059669', margin: '12px 0' }}>
                      σ(T días) = σ(1 día) × √T
                    </p>
                    <p style={{ color: '#334155', fontSize: '0.92rem' }}>
                      Por eso el rango crece con <strong>√T</strong>, no linealmente. Duplicar el horizonte amplía la banda solo
                      en un factor de 1.41, no 2. El cono de incertidumbre tiene forma parabólica.
                    </p>

                    <h6 style={{ color: '#2563eb', fontSize: '1rem', marginTop: 20, marginBottom: 8 }}>Limitaciones del modelo</h6>
                    <ul style={{ color: '#334155', fontSize: '0.92rem' }}>
                      <li><strong>Colas gordas:</strong> los retornos reales tienen más eventos extremos que la normal. Un &quot;2σ&quot; real suele cubrir ~93% en lugar de 95.4%.</li>
                      <li><strong>Volatilidad estocástica:</strong> la volatilidad no es constante; se agrupa en regímenes (clustering). Modelos GARCH capturan esto mejor.</li>
                      <li><strong>Eventos discretos:</strong> decisiones del BanRep, datos de inflación US, shocks petroleros o políticos generan gaps que el modelo gaussiano no anticipa.</li>
                      <li><strong>Correlación serial:</strong> si hay tendencia (drift), el centro de la banda debería desplazarse, no quedar anclado en la TRM actual.</li>
                      <li><strong>Horizonte largo:</strong> más allá de 60–90 días la distribución real se aleja notablemente de la normal y la proyección pierde precisión.</li>
                    </ul>

                    <h6 style={{ color: '#2563eb', fontSize: '1rem', marginTop: 20, marginBottom: 8 }}>Guía práctica: ¿qué nivel usar?</h6>
                    <table className="table table-sm" style={{ fontSize: '0.88rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid #d9e1ec' }}>
                          <th style={{ color: '#64748b', textTransform: 'uppercase', fontSize: '0.72rem' }}>Horizonte</th>
                          <th style={{ color: '#64748b', textTransform: 'uppercase', fontSize: '0.72rem' }}>Nivel sugerido</th>
                          <th style={{ color: '#64748b', textTransform: 'uppercase', fontSize: '0.72rem' }}>Uso típico</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr><td>1–7 días</td><td style={{ fontFamily: 'monospace' }}>1.0–1.5 σ</td><td>Trading intradía, cobertura táctica</td></tr>
                        <tr><td>8–30 días</td><td style={{ fontFamily: 'monospace' }}>1.5–2.0 σ</td><td>Flujos operativos, importadores/exportadores</td></tr>
                        <tr><td>31–90 días</td><td style={{ fontFamily: 'monospace' }}>2.0 σ</td><td>Presupuestos trimestrales, forwards cortos</td></tr>
                        <tr><td>91–180 días</td><td style={{ fontFamily: 'monospace' }}>2.0–2.5 σ</td><td>Planeación semestral, cobertura estratégica</td></tr>
                        <tr><td>Stress testing</td><td style={{ fontFamily: 'monospace' }}>3.0 σ</td><td>Worst-case, capital regulatorio, colchones</td></tr>
                      </tbody>
                    </table>

                    <div style={{ background: 'rgba(217,119,6,0.08)', borderLeft: '3px solid #d97706', padding: '12px 14px', borderRadius: 6, marginTop: 12, color: '#78350f', fontSize: '0.9rem' }}>
                      <strong>Regla práctica:</strong> a mayor horizonte y mayor sensibilidad a pérdidas, mayor σ. Pero recuerda
                      que ampliar el rango tiene un costo: decisiones más conservadoras y menos accionables.
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        )}

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
    </RoleGuard>
    </CoreLayout>
  );
}

export default RiskManagement;
