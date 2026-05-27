/**
 * findAndChart — shared core used by both:
 *   - The chat tool `find_and_chart_series` (src/pages/api/chat/tool-executor.ts)
 *   - The direct API route /api/resolver/chart-direct (Bloomberg-bar path)
 *
 * Flow per query:
 *   1. Embed via OpenAI (best-effort, falls back to literal-only)
 *   2. resolve_query (hybrid) → top match
 *   3. query_series → rows
 *   4. Auto-pick value column
 *   5. Build ChartSpec
 *
 * Multi-query: fan out + merge by date.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { ChartSpec } from 'src/types/chat';

type AnySupabase = any;

export interface ResolverMatch {
  table_name: string;
  table_label: string | null;
  slice_column: string | null;
  slice_value: string | null;
  label: string | null;
  category: string | null;
  confidence: number;
  match_source: string;
}

interface QuerySeriesResult {
  table_name: string;
  label: string;
  date_column: string;
  slice_column: string | null;
  slice_value: string | null;
  row_count: number;
  rows: Record<string, unknown>[];
}

interface ResolveAndFetchOk {
  ok: true;
  query: string;
  match: ResolverMatch;
  series: QuerySeriesResult;
  valueColumn: string | null;
  dataKey: string;
  displayName: string;
}
interface ResolveAndFetchErr {
  ok: false;
  query: string;
  error: string;
}
type ResolveAndFetchResult = ResolveAndFetchOk | ResolveAndFetchErr;

export interface FindAndChartInput {
  queries: string[];
  period_days: number;
  chart_type?: 'line' | 'bar' | 'area';
  from?: string; // ISO date YYYY-MM-DD (overrides period_days if both given)
  to?: string;
}

export interface FindAndChartMeta {
  query: string;
  table_name: string;
  label: string;
  confidence: number;
  match_source: string;
  row_count: number;
}

export interface FindAndChartResult {
  success: boolean;
  error?: string;
  matches?: FindAndChartMeta[];
  warnings?: string[];
  period_days?: number;
  from?: string;
  to?: string;
  chartData?: ChartSpec;
  /** Raw rows when chart auto-build failed */
  raw_series?: { query: string; rows: Record<string, unknown>[] }[];
}

const PREFERRED_VALUE_COLUMNS = [
  'valor', 'value', 'rate', 'tasa', 'indice', 'precio', 'price',
];

async function embedQuery(text: string): Promise<number[] | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  try {
    const r = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text,
        encoding_format: 'float',
      }),
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { data?: { embedding: number[] }[] };
    return j.data?.[0]?.embedding ?? null;
  } catch {
    return null;
  }
}

function pickValueColumn(
  row: Record<string, unknown>,
  dateColumn: string,
  sliceColumn: string | null,
): string | null {
  const skip = new Set<string>([dateColumn, sliceColumn ?? '']);
  const candidates = Object.entries(row).filter(
    ([k, v]) =>
      !skip.has(k) &&
      (typeof v === 'number' ||
        (typeof v === 'string' && !Number.isNaN(parseFloat(v)))),
  );
  if (candidates.length === 0) return null;
  const preferredHit = PREFERRED_VALUE_COLUMNS
    .map((name) => candidates.find(([k]) => k.toLowerCase() === name))
    .find((hit) => hit !== undefined);
  if (preferredHit) return preferredHit[0];
  return candidates[0][0];
}

async function resolveAndFetchOne(
  query: string,
  fromISO: string,
  toISO: string,
  supabase: AnySupabase,
): Promise<ResolveAndFetchResult> {
  const embedding = await embedQuery(query);

  const resolveParams: Record<string, unknown> = { p_text: query, p_limit: 5 };
  if (embedding) resolveParams.p_embedding = `[${embedding.join(',')}]`;

  const { data: matches, error: resolveError } = await supabase
    .schema('xerenity')
    .rpc('resolve_query', resolveParams);
  if (resolveError) {
    return { ok: false, query, error: `Resolve: ${resolveError.message}` };
  }
  const matchList = (matches ?? []) as ResolverMatch[];
  if (matchList.length === 0) {
    return { ok: false, query, error: `Sin matches para "${query}"` };
  }
  const top = matchList[0];

  const { data: seriesData, error: queryError } = await supabase
    .schema('xerenity')
    .rpc('query_series', {
      p_table: top.table_name,
      p_slice_value: top.slice_value,
      p_from: fromISO,
      p_to: toISO,
      p_limit: 5000,
    });
  if (queryError) {
    return { ok: false, query, error: `Fetch ${top.table_name}: ${queryError.message}` };
  }
  const series = seriesData as QuerySeriesResult;
  if (!series.rows || series.rows.length === 0) {
    return { ok: false, query, error: `Sin datos para ${top.label}` };
  }

  const valueColumn = pickValueColumn(
    series.rows[0],
    series.date_column,
    series.slice_column,
  );
  const displayName =
    top.label ?? top.table_label ?? series.label ?? series.table_name;
  const dataKey = `${top.table_name}|${top.slice_value ?? '_'}`;

  return { ok: true, query, match: top, series, valueColumn, dataKey, displayName };
}

function mergeByDate(results: ResolveAndFetchOk[]): Record<string, unknown>[] {
  const byDate = new Map<string, Record<string, unknown>>();
  results
    .filter((r) => r.valueColumn !== null)
    .forEach((r) => {
      const dateCol = r.series.date_column;
      const valCol = r.valueColumn as string;
      r.series.rows.forEach((row) => {
        const dateRaw = row[dateCol];
        const dateKey = String(dateRaw).slice(0, 10);
        let entry = byDate.get(dateKey);
        if (!entry) {
          entry = { date: dateKey };
          byDate.set(dateKey, entry);
        }
        const raw = row[valCol];
        entry[r.dataKey] =
          typeof raw === 'string' ? parseFloat(raw) : (raw as number);
      });
    });
  return Array.from(byDate.values()).sort((a, b) =>
    String(a.date).localeCompare(String(b.date)),
  );
}

/**
 * Main entrypoint. Returns a normalised result regardless of partial failures.
 */
export async function findAndChart(
  input: FindAndChartInput,
  supabase: AnySupabase,
): Promise<FindAndChartResult> {
  const queries = input.queries.map((q) => q.trim()).filter((q) => q.length > 0);
  if (queries.length === 0) {
    return { success: false, error: 'queries vacio' };
  }
  if (queries.length > 5) {
    return { success: false, error: 'Maximo 5 queries por llamada' };
  }

  // Compute date range
  let fromISO: string;
  let toISO: string;
  if (input.from && input.to) {
    fromISO = input.from;
    toISO = input.to;
  } else {
    const to = new Date();
    const from = new Date(to);
    from.setDate(from.getDate() - input.period_days);
    fromISO = from.toISOString().slice(0, 10);
    toISO = to.toISOString().slice(0, 10);
  }

  // Fan out
  const results = await Promise.all(
    queries.map((q) => resolveAndFetchOne(q, fromISO, toISO, supabase)),
  );
  const oks = results.filter((r): r is ResolveAndFetchOk => r.ok);
  const errs = results.filter((r): r is ResolveAndFetchErr => !r.ok);

  const warningsList = errs.length > 0
    ? errs.map((e) => `${e.query}: ${e.error}`)
    : undefined;

  if (oks.length === 0) {
    return {
      success: false,
      error: `Sin resultados. Errores: ${errs.map((e) => `${e.query}: ${e.error}`).join('; ')}`,
      warnings: warningsList,
      from: fromISO,
      to: toISO,
      period_days: input.period_days,
    };
  }

  const matches: FindAndChartMeta[] = oks.map((r) => ({
    query: r.query,
    table_name: r.match.table_name,
    label: r.displayName,
    confidence: r.match.confidence,
    match_source: r.match.match_source,
    row_count: r.series.row_count,
  }));

  // Build ChartSpec
  const chartData = mergeByDate(oks);
  const seriesSpec = oks
    .filter((r) => r.valueColumn !== null)
    .map((r) => ({ data_key: r.dataKey, name: r.displayName }));

  if (seriesSpec.length === 0) {
    return {
      success: true,
      matches,
      warnings: warningsList,
      from: fromISO,
      to: toISO,
      period_days: input.period_days,
      raw_series: oks.map((r) => ({
        query: r.query,
        rows: r.series.rows,
      })),
    };
  }

  const chartTitle =
    oks.length === 1
      ? oks[0].displayName
      : oks.map((r) => r.displayName).join(' vs ');

  return {
    success: true,
    matches,
    warnings: warningsList,
    from: fromISO,
    to: toISO,
    period_days: input.period_days,
    chartData: {
      chart_type: input.chart_type ?? 'line',
      title: chartTitle,
      x_axis_key: 'date',
      series: seriesSpec,
      data: chartData,
    },
  };
}
