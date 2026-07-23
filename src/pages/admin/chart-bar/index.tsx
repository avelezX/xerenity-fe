'use client';

/**
 * /admin/chart-bar — Bloomberg-style search bar.
 *
 * Una sola input. Tipeás "TRM último mes" o "IBR 3M vs SOFR" → enter →
 * la API hace todo (resolve hybrid + fetch + ChartSpec) y la gráfica
 * aparece debajo. Sin LLM, sin friction.
 *
 * Para múltiples series: separar con " vs " o " | ".
 * Para período inline: poner "el query, período" — separado por coma.
 *   Ej: "TRM, último mes"  /  "IBR 3M vs SOFR 3M, q1 2024"
 */

import React, { useCallback, useEffect, useState } from 'react';
import { CoreLayout } from '@layout';
import { Container, Form, Spinner, Badge } from 'react-bootstrap';
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import {
  faChartLine,
  faMagnifyingGlass,
  faKeyboard,
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'react-toastify';
import styled from 'styled-components';
import PageTitle from '@components/PageTitle';
import Button from '@components/UI/Button';
import RoleGuard from 'src/components/RoleGuard';
import useAppStore from 'src/store';
import Chart from '@components/chart/Chart';
import type { ChartSpec } from 'src/types/chat';
import type {
  FindAndChartResult,
  FindAndChartMeta,
} from 'src/lib/resolver/findAndChart';

const Page = styled.div`
  padding: 16px 24px;
  max-width: 1200px;
  margin: 0 auto;
`;

const Bar = styled.div`
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  align-items: center;

  .form-control {
    font-size: 18px;
    padding: 14px 18px;
    border: 2px solid #302b63;
    border-radius: 8px;
    background: #1a1a1a;
    color: #fff;
    font-family: 'JetBrains Mono', 'Courier New', monospace;

    &::placeholder {
      color: #6b6b8d;
    }

    &:focus {
      box-shadow: 0 0 0 3px rgba(48, 43, 99, 0.2);
      background: #1a1a1a;
      color: #fff;
      border-color: #4a44a0;
    }
  }
`;

const Hint = styled.div`
  font-size: 12px;
  color: #888;
  margin-bottom: 16px;
  font-family: 'JetBrains Mono', monospace;

  code {
    background: #f3f3f7;
    padding: 2px 6px;
    border-radius: 3px;
    color: #302b63;
    font-size: 11px;
  }
`;

const ChartCard = styled.div`
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  padding: 24px;
  margin-bottom: 16px;
`;

const MatchesRow = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 16px;
  font-size: 12px;

  .match-chip {
    background: #f3f3f7;
    border: 1px solid #d8d8e6;
    border-radius: 12px;
    padding: 4px 10px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .match-chip code {
    font-size: 11px;
    color: #6b6b8d;
  }
  .conf {
    font-weight: 700;
    color: #302b63;
  }
`;

const ErrorBox = styled.div`
  background: #fdf3f4;
  border: 1px solid #f5c6cb;
  color: #761c1c;
  padding: 14px 18px;
  border-radius: 8px;
  font-size: 14px;
  margin-bottom: 16px;
`;

const WarningBox = styled.div`
  background: #fff8e1;
  border: 1px solid #ffe082;
  color: #7a5a00;
  padding: 10px 14px;
  border-radius: 6px;
  font-size: 12px;
  margin-bottom: 12px;

  strong { display: block; margin-bottom: 4px; }
`;

const ControlsRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 8px;

  .group {
    display: flex;
    gap: 4px;
    align-items: center;
  }

  .lbl {
    font-size: 11px;
    color: #888;
    margin-right: 2px;
  }

  button {
    border: 1px solid #d8d8e6;
    background: #fff;
    color: #4a4a68;
    font-size: 12px;
    font-weight: 600;
    padding: 3px 12px;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.12s;

    &:hover {
      border-color: #302b63;
      color: #302b63;
    }

    &.active {
      background: #302b63;
      border-color: #302b63;
      color: #fff;
    }
  }
`;

const AnalysisBox = styled.div`
  margin-top: 12px;
  background: #f7f7fb;
  border-left: 3px solid #302b63;
  border-radius: 6px;
  padding: 14px 16px;
  font-size: 14px;
  line-height: 1.65;
  color: #333;
  white-space: pre-wrap;
`;

const PLACEHOLDER = 'TRM último mes  ·  IBR 3M vs SOFR 3M  ·  inflación q1 2024';

interface ParsedInput {
  queries: string[];
  periodText?: string;
}

// Recognizable period phrase anchored at the END of the input. Matches with or
// without a leading comma so "inflación q1, 2024" (comma INSIDE the period) and
// "TRM ultimo mes" (no separator) both work. Deliberately excludes bare tenor
// short-forms like "3M"/"1Y" so "IBR 3M" is NOT mistaken for a 3-month period —
// periods must be spelled out (mes/meses/año/días), a quarter (q1 [year]), or a
// year / year-range.
const TRAILING_PERIOD_RE =
  /(?:^|[\s,])\s*(hoy|ytd|mtd|(?:este|últim[oa]|ultim[oa])s?\s+(?:año|ano|mes|trimestre|semana)|(?:últim[oa]s?|ultim[oa]s?)\s+\d+\s+(?:d[íi]as?|semanas?|meses?|años?|anos?)|\d+\s+(?:d[íi]as?|semanas?|meses?|años?|anos?)|q[1-4](?:[\s,]+\d{4})?|\d{4}(?:\s*(?:[-–]|a)\s*\d{4})?)\s*$/i;

// Parse the input bar:
//   "TRM" → {queries: ["TRM"]}
//   "IBR 3M vs SOFR 3M" → {queries: ["IBR 3M", "SOFR 3M"]}  (3M stays a tenor)
//   "TRM, ultimo mes" / "TRM ultimo mes" → {queries: ["TRM"], periodText: "ultimo mes"}
//   "inflación q1, 2024" → {queries: ["inflación"], periodText: "q1, 2024"}
function parseBar(input: string): ParsedInput {
  const t = input.trim();
  if (!t) return { queries: [] };

  let queriesPart = t;
  let periodText: string | undefined;

  const m = t.match(TRAILING_PERIOD_RE);
  if (m && m.index !== undefined) {
    periodText = m[1].trim();
    queriesPart = t.slice(0, m.index).replace(/[\s,]+$/, '').trim();
  } else {
    // Fallback: free-form period after a comma (legacy behaviour).
    const commaIdx = t.lastIndexOf(',');
    if (commaIdx > 0) {
      queriesPart = t.slice(0, commaIdx).trim();
      periodText = t.slice(commaIdx + 1).trim();
    }
  }

  const splitQueries = (s: string) => s
    .split(/\s+(?:vs|\|)\s+/i)
    .map((q) => q.trim())
    .filter((q) => q.length > 0);

  const queries = splitQueries(queriesPart);

  // If peeling the period left no query, the phrase was actually the query.
  if (queries.length === 0) {
    return { queries: splitQueries(t) };
  }

  return { queries, periodText };
}

// Transform the merged ChartSpec into per-series {time,value}[] arrays for the
// TradingView-based Chart component (the same one Suameca/MarketDashboard use).
const LINE_COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

// Period filter. The API always returns the full history; these just narrow the
// visible window client-side. Anchored to the DATA's latest date (not "today")
// so lagging series — e.g. a monthly index — still show a real window.
const PERIODS = ['1M', '3M', '6M', 'YTD', '1Y', '5Y', 'MAX'] as const;
type Period = (typeof PERIODS)[number];
const PERIOD_DAYS: Record<Exclude<Period, 'YTD' | 'MAX'>, number> = {
  '1M': 30,
  '3M': 90,
  '6M': 180,
  '1Y': 365,
  '5Y': 1825,
};

function cutoffFor(period: Period, maxDateISO: string | null): string | null {
  if (period === 'MAX' || !maxDateISO) return null;
  const max = new Date(`${maxDateISO}T00:00:00Z`);
  if (period === 'YTD') return `${max.getUTCFullYear()}-01-01`;
  const d = new Date(max);
  d.setUTCDate(d.getUTCDate() - PERIOD_DAYS[period]);
  return d.toISOString().slice(0, 10);
}

// How multiple series share (or don't) the price axis:
//   shared — all on the right scale (Suameca default; fine for same-unit series)
//   dual   — 1st series right axis, 2nd left axis, rest auto-scaled overlays
//   norm   — all rebased to 100 at the start of the visible window (Chart's
//            native normalize; base = first visible point since data is
//            pre-filtered by the period cutoff)
type ScaleMode = 'shared' | 'dual' | 'norm';

const SCALE_MODE_LABELS: Record<ScaleMode, string> = {
  shared: 'Eje común',
  dual: '2 ejes',
  norm: 'Base 100',
};

// Median |value| per series; if the biggest/smallest ratio is huge, a shared
// axis flattens the small series (TRM ~4000 vs a rate ~10) → default to norm.
function smartScaleMode(spec: ChartSpec): ScaleMode {
  if (spec.series.length < 2) return 'shared';
  const medians = spec.series
    .map((s) => {
      const vals = spec.data
        .map((row) => Math.abs(Number(row[s.data_key])))
        .filter((v) => Number.isFinite(v) && v > 0)
        .sort((a, b) => a - b);
      return vals.length > 0 ? vals[Math.floor(vals.length / 2)] : 0;
    })
    .filter((m) => m > 0);
  if (medians.length < 2) return 'shared';
  return Math.max(...medians) / Math.min(...medians) >= 20 ? 'norm' : 'shared';
}

function scaleIdFor(mode: ScaleMode, index: number, key: string): string {
  // norm: rebased series share the RIGHT scale (not an overlay id like
  // Suameca's 'normalized') so the base-100 values get a visible axis.
  if (mode === 'dual') {
    if (index === 0) return 'right';
    if (index === 1) return 'left';
    return key; // 3rd+ series: own auto-scaled overlay
  }
  return 'right';
}

interface ChartLine {
  key: string;
  name: string;
  color: string;
  data: { time: string; value: number }[];
}

function buildLines(spec: ChartSpec, cutoff: string | null): ChartLine[] {
  return spec.series.map((s, i) => ({
    key: s.data_key,
    name: s.name,
    color: s.color || LINE_COLORS[i % LINE_COLORS.length],
    data: spec.data
      .map((row) => ({
        time: String(row[spec.x_axis_key]).slice(0, 10),
        value: Number(row[s.data_key]),
      }))
      .filter(
        (d) =>
          d.time.length === 10 &&
          Number.isFinite(d.value) &&
          (!cutoff || d.time >= cutoff),
      )
      .sort((a, b) => a.time.localeCompare(b.time)),
  }));
}

// ── Fase 4: payload para /api/resolver/chart-analysis ────────────────────────
// Enviamos un RESUMEN (stats sobre datos completos + serie decimada), no los
// puntos crudos: prompt chico (~3K tokens), mejor análisis, ~$0.01 por clic.

const ANALYSIS_MAX_POINTS = 150;

type Pt = { time: string; value: number };

function valueOnOrBefore(pts: Pt[], targetISO: string): number | null {
  for (let i = pts.length - 1; i >= 0; i -= 1) {
    if (pts[i].time <= targetISO) return pts[i].value;
  }
  return null;
}

function pctChange(current: number, base: number | null): number | null {
  if (base === null || base === 0) return null;
  return ((current - base) / Math.abs(base)) * 100;
}

function isoDaysBefore(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function statsFor(pts: Pt[]) {
  let min = pts[0];
  let max = pts[0];
  pts.forEach((p) => {
    if (p.value < min.value) min = p;
    if (p.value > max.value) max = p;
  });
  const first = pts[0];
  const last = pts[pts.length - 1];
  const year = last.time.slice(0, 4);
  return {
    first: first.value,
    firstDate: first.time,
    last: last.value,
    lastDate: last.time,
    min: min.value,
    minDate: min.time,
    max: max.value,
    maxDate: max.time,
    change1M: pctChange(last.value, valueOnOrBefore(pts, isoDaysBefore(last.time, 30))),
    change1Y: pctChange(last.value, valueOnOrBefore(pts, isoDaysBefore(last.time, 365))),
    changeYTD: pctChange(last.value, valueOnOrBefore(pts, `${year}-01-01`)),
  };
}

function downsample(pts: Pt[], max: number): [string, number][] {
  if (pts.length <= max) return pts.map((p) => [p.time, p.value]);
  const stride = Math.ceil(pts.length / max);
  const out: [string, number][] = [];
  for (let i = 0; i < pts.length; i += stride) out.push([pts[i].time, pts[i].value]);
  const lastPt = pts[pts.length - 1];
  if (out[out.length - 1][0] !== lastPt.time) out.push([lastPt.time, lastPt.value]);
  return out;
}

function buildAnalysisPayload(
  spec: ChartSpec,
  period: Period,
  from?: string,
  to?: string,
  query?: string,
) {
  // Stats sobre la historia COMPLETA (cutoff null), no solo la ventana visible.
  const series = buildLines(spec, null)
    .filter((ln) => ln.data.length > 0)
    .map((ln) => ({
      name: ln.name,
      table: ln.key.split('|')[0],
      stats: statsFor(ln.data),
      points: downsample(ln.data, ANALYSIS_MAX_POINTS),
    }));
  return { series, from, to, period, query };
}

const ChartBarPage = () => {
  const userProfile = useAppStore((s) => s.userProfile);
  const loadUserProfile = useAppStore((s) => s.loadUserProfile);

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FindAndChartResult | null>(null);
  // The Chart component exposes its lightweight-charts instance through a ref
  // (not state), so mounting <Chart> and its <Chart.Line> children in the same
  // render leaves the lines with an undefined chart context and nothing is
  // drawn. Mount the container first, then add the lines on the next frame,
  // once the container's mount effect has created the chart.
  const [chartReady, setChartReady] = useState(false);
  const [period, setPeriod] = useState<Period>('MAX');
  const [scaleMode, setScaleMode] = useState<ScaleMode>('shared');
  const [analysis, setAnalysis] = useState<{
    loading: boolean;
    text?: string;
    error?: string;
  } | null>(null);

  useEffect(() => {
    if (!userProfile) loadUserProfile();
  }, [userProfile, loadUserProfile]);

  useEffect(() => {
    setChartReady(false);
    setPeriod('MAX'); // each new search starts showing the complete range
    setAnalysis(null); // el análisis es por búsqueda — se pide con el botón
    setScaleMode(
      result?.chartData ? smartScaleMode(result.chartData as ChartSpec) : 'shared',
    );
    if (!result?.chartData) return undefined;
    const id = requestAnimationFrame(() => setChartReady(true));
    return () => cancelAnimationFrame(id);
  }, [result]);

  const onAnalyze = useCallback(async () => {
    if (!result?.chartData) return;
    setAnalysis({ loading: true });
    try {
      const payload = buildAnalysisPayload(
        result.chartData as ChartSpec,
        period,
        result.from,
        result.to,
        result.matches?.map((m) => m.query).join(' vs '),
      );
      const r = await fetch('/api/resolver/chart-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = (await r.json()) as { analysis?: string; error?: string };
      if (!r.ok || !json.analysis) {
        setAnalysis({ loading: false, error: json.error ?? `HTTP ${r.status}` });
        return;
      }
      setAnalysis({ loading: false, text: json.analysis });
    } catch (e) {
      setAnalysis({
        loading: false,
        error: e instanceof Error ? e.message : 'Error de red',
      });
    }
  }, [result, period]);

  const onSubmit = useCallback(async () => {
    const parsed = parseBar(input);
    if (parsed.queries.length === 0) {
      toast.warn('Tipea algo');
      return;
    }
    setLoading(true);
    setResult(null);

    try {
      const r = await fetch('/api/resolver/chart-direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          queries: parsed.queries,
          period_text: parsed.periodText,
        }),
      });
      const json = (await r.json()) as FindAndChartResult & { error?: string };
      if (!r.ok) {
        toast.error(json.error ?? `HTTP ${r.status}`);
        setResult(json);
        return;
      }
      setResult(json);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [input]);

  const onKey = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') onSubmit();
    },
    [onSubmit],
  );

  const chartSpec = result?.chartData as ChartSpec | undefined;
  const maxDataDate =
    chartSpec && chartSpec.data.length > 0
      ? String(chartSpec.data[chartSpec.data.length - 1][chartSpec.x_axis_key]).slice(0, 10)
      : null;
  const cutoff = cutoffFor(period, maxDataDate);

  return (
    <CoreLayout>
      <Container fluid>
        <RoleGuard
          requiredRole="super_admin"
          fallback={
            <Page>
              <p className="text-muted">No tenes permisos para acceder a esta pagina.</p>
            </Page>
          }
        >
          <Page>
            <PageTitle>
              <Icon icon={faChartLine} />
              <h4>Chart Bar — Bloomberg-style search</h4>
            </PageTitle>
            <p className="text-muted" style={{ fontSize: 13, marginBottom: 18 }}>
              Una sola input. Sin LLM. Tipea, enter, gráfica.
            </p>

            <Bar>
              <Form.Control
                type="text"
                placeholder={PLACEHOLDER}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKey}
                disabled={loading}
                autoFocus
              />
              <Button
                variant="primary"
                onClick={onSubmit}
                disabled={loading || !input.trim()}
                style={{ height: 52, padding: '0 24px' }}
              >
                {loading ? (
                  <Spinner size="sm" animation="border" />
                ) : (
                  <Icon icon={faMagnifyingGlass} />
                )}
              </Button>
            </Bar>

            <Hint>
              <Icon icon={faKeyboard} /> Sintaxis: <code>query</code> ·{' '}
              <code>query vs query</code> (compara) ·{' '}
              <code>query, periodo</code> (rango).
              Periodos: <code>hoy</code>, <code>ultimo mes</code>,{' '}
              <code>ultimos 30 dias</code>, <code>q1 2024</code>,{' '}
              <code>octubre 2024</code>, <code>2023</code>.
            </Hint>

            {result?.error && !result.success && (
              <ErrorBox>
                <strong>Error:</strong> {result.error}
              </ErrorBox>
            )}

            {result?.warnings && result.warnings.length > 0 && (
              <WarningBox>
                <strong>Algunas series fallaron:</strong>
                {result.warnings.map((w) => (
                  <div key={w}>· {w}</div>
                ))}
              </WarningBox>
            )}

            {result?.chartData && (
              <ChartCard>
                <MatchesRow>
                  {result.matches?.map((m: FindAndChartMeta) => (
                    <div key={`${m.table_name}|${m.query}`} className="match-chip">
                      <span>{m.label}</span>
                      <code>{m.table_name}</code>
                      <span className="conf">{(m.confidence * 100).toFixed(0)}%</span>
                      <Badge bg="light" text="dark" style={{ fontSize: 10 }}>
                        {m.match_source}
                      </Badge>
                    </div>
                  ))}
                </MatchesRow>
                <ControlsRow>
                  <div className="group">
                    {chartSpec && chartSpec.series.length >= 2 && (
                      <>
                        <span className="lbl">Escala:</span>
                        {(Object.keys(SCALE_MODE_LABELS) as ScaleMode[]).map((m) => (
                          <button
                            key={m}
                            type="button"
                            className={scaleMode === m ? 'active' : ''}
                            onClick={() => setScaleMode(m)}
                          >
                            {SCALE_MODE_LABELS[m]}
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                  <div className="group">
                    {PERIODS.map((p) => (
                      <button
                        key={p}
                        type="button"
                        className={period === p ? 'active' : ''}
                        onClick={() => setPeriod(p)}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </ControlsRow>
                <Chart chartHeight={480} showToolbar>
                  {chartReady && buildLines(result.chartData as ChartSpec, cutoff).map((ln, i) => (
                    <Chart.Line
                      key={ln.key}
                      data={ln.data}
                      color={ln.color}
                      title={ln.name}
                      scaleId={scaleIdFor(scaleMode, i, ln.key)}
                      applyFunctions={scaleMode === 'norm' ? ['normalize'] : undefined}
                      lastValueVisible={false}
                      priceLineVisible={false}
                    />
                  ))}
                </Chart>
                <div style={{ marginTop: 12 }}>
                  <Button
                    variant="primary"
                    onClick={onAnalyze}
                    disabled={analysis?.loading}
                    style={{ fontSize: 13, padding: '6px 18px' }}
                  >
                    {analysis?.loading ? (
                      <>
                        <Spinner
                          size="sm"
                          animation="border"
                          style={{ marginRight: 8 }}
                        />
                        Analizando…
                      </>
                    ) : (
                      'Xerenity AI Analysis'
                    )}
                  </Button>
                  {analysis?.error && (
                    <ErrorBox style={{ marginTop: 10, marginBottom: 0 }}>
                      <strong>No se pudo generar el análisis:</strong>{' '}
                      {analysis.error}
                    </ErrorBox>
                  )}
                  {analysis?.text && <AnalysisBox>{analysis.text}</AnalysisBox>}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: '#888',
                    marginTop: 8,
                    textAlign: 'right',
                  }}
                >
                  Datos: {result.from} → {result.to}
                  {chartSpec ? ` · ${chartSpec.data.length} puntos` : ''}
                  {period !== 'MAX' ? ` · viendo ${period}` : ''}
                </div>
              </ChartCard>
            )}
          </Page>
        </RoleGuard>
      </Container>
    </CoreLayout>
  );
};

export default ChartBarPage;
