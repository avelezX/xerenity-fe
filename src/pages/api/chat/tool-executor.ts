import { createClient } from '@supabase/supabase-js';
import { findAndChart } from 'src/lib/resolver/findAndChart';
import { VALID_PATHS } from './tools';

const SCHEMA = 'xerenity';

const FORBIDDEN_SQL = /^\s*(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE|COPY|EXEC)\b/i;

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: SCHEMA } },
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = ReturnType<typeof createClient> | any;

export interface ChartAction {
  action: 'set_period' | 'normalize' | 'clear' | 'remove_series';
  period?: string;
  normalize?: boolean;
  ticker?: string;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  chartData?: unknown;
  navigationTarget?: string;
  chartAction?: ChartAction;
}

async function executeQuery(input: Record<string, unknown>): Promise<ToolResult> {
  const sql = (input.sql as string || '').trim();

  if (!sql) {
    return { success: false, error: 'SQL query vacia' };
  }

  if (FORBIDDEN_SQL.test(sql)) {
    return { success: false, error: 'Solo queries SELECT son permitidas' };
  }

  if (!sql.toUpperCase().trimStart().startsWith('SELECT')) {
    return { success: false, error: 'La query debe comenzar con SELECT' };
  }

  try {
    const serviceClient = getServiceClient();
    const { data, error } = await serviceClient.rpc('agent_query', { p_sql: sql });

    if (error) {
      return { success: false, error: `Error ejecutando query: ${error.message}` };
    }

    const rows = data ?? [];
    const rowCount = Array.isArray(rows) ? rows.length : 0;

    return {
      success: true,
      data: { rows, rowCount },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido';
    return { success: false, error: `Error ejecutando query: ${msg}` };
  }
}

function executeChart(input: Record<string, unknown>): ToolResult {
  const { chart_type: chartType, title, x_axis_key: xAxisKey, series, data } = input;

  if (!chartType || !title || !xAxisKey || !series || !data) {
    return { success: false, error: 'Parametros incompletos para generar grafico' };
  }

  if (!Array.isArray(data) || data.length === 0) {
    return { success: false, error: 'Data del grafico esta vacia' };
  }

  return {
    success: true,
    chartData: { chart_type: chartType, title, x_axis_key: xAxisKey, series, data },
  };
}

function executeNavigate(input: Record<string, unknown>): ToolResult {
  const path = input.path as string;

  if (!VALID_PATHS.includes(path)) {
    return {
      success: false,
      error: `Path invalido: ${path}. Paths validos: ${VALID_PATHS.join(', ')}`,
    };
  }

  return {
    success: true,
    navigationTarget: path,
    data: { path, description: input.description },
  };
}

async function executeCreatePosition(
  input: Record<string, unknown>,
  userSupabase?: AnySupabaseClient,
): Promise<ToolResult> {
  if (!userSupabase) {
    return { success: false, error: 'Se requiere sesion de usuario para crear posiciones' };
  }

  const positionType = input.position_type as string;
  const params = input.params as Record<string, unknown>;

  if (!params) {
    return { success: false, error: 'Parametros de posicion requeridos' };
  }

  try {
    let rpcName: string;
    let rpcParams: Record<string, unknown>;

    switch (positionType) {
      case 'ndf':
        rpcName = 'create_ndf_position';
        rpcParams = {
          p_label: params.label ?? null,
          p_counterparty: params.counterparty ?? null,
          p_notional_usd: params.notional_usd,
          p_strike: params.strike,
          p_maturity_date: params.maturity_date,
          p_direction: params.direction ?? 'buy',
          p_id_operacion: params.id_operacion ?? null,
          p_trade_date: params.trade_date ?? null,
          p_sociedad: params.sociedad ?? null,
          p_id_banco: params.id_banco ?? null,
          p_modalidad: params.modalidad ?? null,
          p_settlement_date: params.settlement_date ?? null,
          p_tipo_divisa: params.tipo_divisa ?? null,
          p_estado: params.estado ?? null,
          p_doc_sap: params.doc_sap ?? null,
        };
        break;

      case 'xccy':
        rpcName = 'create_xccy_position';
        rpcParams = {
          p_label: params.label ?? null,
          p_counterparty: params.counterparty ?? null,
          p_notional_usd: params.notional_usd,
          p_start_date: params.start_date,
          p_maturity_date: params.maturity_date,
          p_usd_spread_bps: params.usd_spread_bps ?? 0,
          p_cop_spread_bps: params.cop_spread_bps ?? 0,
          p_pay_usd: params.pay_usd ?? true,
          p_fx_initial: params.fx_initial,
          p_payment_frequency: params.payment_frequency ?? '3M',
          p_amortization_type: params.amortization_type ?? 'bullet',
          p_amortization_schedule: params.amortization_schedule ?? null,
          p_id_operacion: params.id_operacion ?? null,
          p_trade_date: params.trade_date ?? null,
          p_sociedad: params.sociedad ?? null,
          p_id_banco: params.id_banco ?? null,
          p_modalidad: params.modalidad ?? null,
          p_settlement_date: params.settlement_date ?? null,
          p_tipo_divisa: params.tipo_divisa ?? null,
          p_estado: params.estado ?? null,
          p_doc_sap: params.doc_sap ?? null,
        };
        break;

      case 'ibr_swap':
        rpcName = 'create_ibr_swap_position';
        rpcParams = {
          p_label: params.label ?? null,
          p_counterparty: params.counterparty ?? null,
          p_notional: params.notional,
          p_start_date: params.start_date,
          p_maturity_date: params.maturity_date,
          p_fixed_rate: params.fixed_rate,
          p_pay_fixed: params.pay_fixed ?? true,
          p_spread_bps: params.spread_bps ?? 0,
          p_payment_frequency: params.payment_frequency ?? '3M',
          p_id_operacion: params.id_operacion ?? null,
          p_trade_date: params.trade_date ?? null,
          p_sociedad: params.sociedad ?? null,
          p_id_banco: params.id_banco ?? null,
          p_modalidad: params.modalidad ?? null,
          p_settlement_date: params.settlement_date ?? null,
          p_tipo_divisa: params.tipo_divisa ?? null,
          p_estado: params.estado ?? null,
          p_doc_sap: params.doc_sap ?? null,
        };
        break;

      case 'tes':
        rpcName = 'create_tes_position';
        rpcParams = {
          p_bond_name: params.bond_name,
          p_issue_date: params.issue_date ?? null,
          p_maturity_date: params.maturity_date ?? null,
          p_coupon_rate: params.coupon_rate ?? null,
          p_notional: params.notional,
          p_face_value: params.face_value ?? 100,
          p_purchase_price: params.purchase_price ?? null,
          p_purchase_ytm: params.purchase_ytm ?? null,
          p_trade_date: params.trade_date ?? null,
          p_sociedad: params.sociedad ?? null,
          p_estado: params.estado ?? 'Activo',
          p_label: params.label ?? null,
          p_counterparty: params.counterparty ?? null,
        };
        break;

      default:
        return { success: false, error: `Tipo de posicion invalido: ${positionType}` };
    }

    const { data, error } = await userSupabase.schema(SCHEMA).rpc(rpcName, rpcParams);

    if (error) {
      return { success: false, error: `Error creando posicion ${positionType}: ${error.message}` };
    }

    return { success: true, data };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido';
    return { success: false, error: `Error creando posicion: ${msg}` };
  }
}

async function executeCreateLoan(
  input: Record<string, unknown>,
  userSupabase?: AnySupabaseClient,
): Promise<ToolResult> {
  if (!userSupabase) {
    return { success: false, error: 'Se requiere sesion de usuario para crear prestamos' };
  }

  const params = input.params as Record<string, unknown>;

  if (!params) {
    return { success: false, error: 'Parametros de prestamo requeridos' };
  }

  try {
    const { data, error } = await userSupabase.schema(SCHEMA).rpc('create_credit', params);

    if (error) {
      return { success: false, error: `Error creando prestamo: ${error.message}` };
    }

    return { success: true, data };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido';
    return { success: false, error: `Error creando prestamo: ${msg}` };
  }
}

function executeViewSeries(input: Record<string, unknown>): ToolResult {
  const tickers = input.tickers as string[];
  const names = (input.names as string[]) || tickers;

  if (!Array.isArray(tickers) || tickers.length === 0) {
    return { success: false, error: 'Se requiere al menos un ticker de serie' };
  }

  if (tickers.length > 5) {
    return { success: false, error: 'Maximo 5 series a la vez' };
  }

  return {
    success: true,
    navigationTarget: '_series_action',
    data: { description: input.description, tickers, names },
  };
}

function executeControlChart(input: Record<string, unknown>): ToolResult {
  const action = input.action as string;
  const validActions = ['set_period', 'normalize', 'clear', 'remove_series'];

  if (!validActions.includes(action)) {
    return { success: false, error: `Accion invalida: ${action}` };
  }

  const chartAction: ChartAction = { action: action as ChartAction['action'] };

  if (action === 'set_period') {
    const period = input.period as string;
    const validPeriods = ['1D', '5D', '1M', '3M', '6M', 'YTD', '1Y', '3Y', '5Y', '10Y'];
    if (!period || !validPeriods.includes(period)) {
      return { success: false, error: `Periodo invalido: ${period}. Validos: ${validPeriods.join(', ')}` };
    }
    chartAction.period = period;
  }

  if (action === 'normalize') {
    chartAction.normalize = input.normalize !== false;
  }

  if (action === 'remove_series') {
    if (!input.ticker) {
      return { success: false, error: 'Se requiere el ticker de la serie a quitar' };
    }
    chartAction.ticker = input.ticker as string;
  }

  return {
    success: true,
    chartAction,
    data: { ...chartAction },
  };
}

// ── read_repo_file (gated to super_admin) ─────────────────────────────────

const REPO_OWNER = 'avelezX';
const REPO_NAME = 'xerenity-dm';
const MAX_FILE_BYTES = 200_000; // 200 kB cap; GitHub Contents API actually
                                // refuses >1 MB, but our agent has no
                                // business reading anything larger anyway.

async function callerIsSuperAdmin(
  userSupabase: AnySupabaseClient | undefined,
): Promise<boolean> {
  if (!userSupabase) return false;
  try {
    const { data: { user } } = await userSupabase.auth.getUser();
    if (!user?.id) return false;
    const { data, error } = await userSupabase
      .schema('xerenity')
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    if (error) return false;
    return data?.role === 'super_admin';
  } catch {
    return false;
  }
}

function isPathSafe(path: string): boolean {
  if (!path) return false;
  if (path.startsWith('/')) return false;
  if (path.includes('..')) return false;
  if (path.includes('\0')) return false;
  // Whitelist a tight character set: letters, digits, _ - . / and one space
  // (some workflow filenames use spaces). Anything else is suspicious.
  return /^[A-Za-z0-9_\-./ ]+$/.test(path);
}

async function executeReadRepoFile(
  input: Record<string, unknown>,
  userSupabase: AnySupabaseClient | undefined,
): Promise<ToolResult> {
  const allowed = await callerIsSuperAdmin(userSupabase);
  if (!allowed) {
    return {
      success: false,
      error: 'read_repo_file requiere role=super_admin',
    };
  }

  const path = (input.path as string || '').trim();
  if (!isPathSafe(path)) {
    return {
      success: false,
      error: `Path no permitido: ${path}. Debe ser relativo, sin ".." ni caracteres especiales.`,
    };
  }

  const token = process.env.GITHUB_PAT_XERENITY_DM_READ;
  if (!token) {
    return {
      success: false,
      error: 'GITHUB_PAT_XERENITY_DM_READ no esta configurado en el server',
    };
  }

  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${encodeURIComponent(path).replace(/%2F/g, '/')}`;

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    if (res.status === 404) {
      return { success: false, error: `Archivo no encontrado en xerenity-dm: ${path}` };
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return {
        success: false,
        error: `GitHub API ${res.status}: ${text.slice(0, 200)}`,
      };
    }
    const json = await res.json() as {
      type?: string;
      encoding?: string;
      size?: number;
      content?: string;
    };
    if (json.type !== 'file') {
      return { success: false, error: `${path} no es un archivo (es ${json.type})` };
    }
    if (typeof json.size === 'number' && json.size > MAX_FILE_BYTES) {
      return {
        success: false,
        error: `Archivo demasiado grande (${json.size} bytes, limite ${MAX_FILE_BYTES})`,
      };
    }
    if (json.encoding !== 'base64' || !json.content) {
      return { success: false, error: 'Respuesta inesperada de GitHub Contents API' };
    }
    const decoded = Buffer.from(json.content, 'base64').toString('utf8');
    return {
      success: true,
      data: {
        path,
        repo: `${REPO_OWNER}/${REPO_NAME}`,
        bytes: decoded.length,
        content: decoded,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: `read_repo_file error: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}


// ─────────────────────────────────────────────────────────────────
// Catalog tools (Phase 3) — let the agent introspect what data exists
// before writing query_database SQL or referencing tables by guess.
// All three use the caller's session (userSupabase) so the existing
// auth.uid() gates in the catalog RPCs work transparently.
// ─────────────────────────────────────────────────────────────────

async function executeListDataCatalog(
  userSupabase?: AnySupabaseClient,
): Promise<ToolResult> {
  if (!userSupabase) {
    return { success: false, error: 'Se requiere sesion de usuario para consultar el catalogo' };
  }
  try {
    const { data, error } = await userSupabase
      .schema('xerenity')
      .rpc('list_data_catalog_overview');
    if (error) return { success: false, error: `Catalog overview: ${error.message}` };
    return { success: true, data: { tables: data ?? [] } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido';
    return { success: false, error: `Catalog overview: ${msg}` };
  }
}

async function executeDescribeTable(
  input: Record<string, unknown>,
  userSupabase?: AnySupabaseClient,
): Promise<ToolResult> {
  if (!userSupabase) {
    return { success: false, error: 'Se requiere sesion de usuario para describir tabla' };
  }
  const tableName = ((input.table_name as string) || '').trim();
  if (!tableName) {
    return { success: false, error: 'table_name es requerido' };
  }
  try {
    const { data, error } = await userSupabase
      .schema('xerenity')
      .rpc('describe_table', { p_table: tableName });
    if (error) return { success: false, error: `Describe table: ${error.message}` };
    return { success: true, data };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido';
    return { success: false, error: `Describe table: ${msg}` };
  }
}

async function executeDescribeLineage(
  input: Record<string, unknown>,
  userSupabase?: AnySupabaseClient,
): Promise<ToolResult> {
  if (!userSupabase) {
    return { success: false, error: 'Se requiere sesion de usuario para consultar lineage' };
  }
  const tableName = ((input.table_name as string) || '').trim();
  if (!tableName) {
    return { success: false, error: 'table_name es requerido' };
  }
  try {
    const { data, error } = await userSupabase
      .schema('xerenity')
      .rpc('get_table_lineage', { p_table: tableName });
    if (error) return { success: false, error: `Lineage: ${error.message}` };
    return { success: true, data };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido';
    return { success: false, error: `Lineage: ${msg}` };
  }
}

// ─── find_and_chart_series ────────────────────────────────────────
// Thin wrapper sobre src/lib/resolver/findAndChart. La lib es compartida
// con /api/resolver/chart-direct (Bloomberg-bar path sin LLM).

async function executeFindAndChartSeries(
  input: Record<string, unknown>,
  userSupabase?: AnySupabaseClient,
): Promise<ToolResult> {
  if (!userSupabase) {
    return { success: false, error: 'Se requiere sesion de usuario' };
  }

  // Accept either query (single string) or queries (array). queries wins.
  const rawQueries = input.queries as string[] | undefined;
  const rawQuery = input.query as string | undefined;
  const queries: string[] = (() => {
    if (Array.isArray(rawQueries) && rawQueries.length > 0) return rawQueries;
    if (typeof rawQuery === 'string') return [rawQuery];
    return [];
  })();

  if (queries.length === 0) {
    return { success: false, error: 'query o queries es requerido' };
  }

  const periodDays = Math.max(
    1,
    Math.min(3650, (input.period_days as number) ?? 365),
  );
  const chartType = (input.chart_type as 'line' | 'bar' | 'area') ?? 'line';

  const result = await findAndChart(
    { queries, period_days: periodDays, chart_type: chartType },
    userSupabase,
  );

  if (!result.success) {
    return { success: false, error: result.error };
  }

  return {
    success: true,
    data: {
      matches: result.matches,
      warnings: result.warnings,
      period_days: result.period_days,
      from: result.from,
      to: result.to,
      ...(result.raw_series ? { raw_series: result.raw_series } : {}),
    },
    chartData: result.chartData,
  };
}


// eslint-disable-next-line import/prefer-default-export
export async function executeTool(
  toolName: string,
  toolInput: Record<string, unknown>,
  userSupabase?: AnySupabaseClient,
): Promise<ToolResult> {
  switch (toolName) {
    case 'query_database':
      return executeQuery(toolInput);
    case 'generate_chart':
      return executeChart(toolInput);
    case 'navigate_to':
      return executeNavigate(toolInput);
    case 'create_position':
      return executeCreatePosition(toolInput, userSupabase);
    case 'create_loan':
      return executeCreateLoan(toolInput, userSupabase);
    case 'view_series':
      return executeViewSeries(toolInput);
    case 'control_chart':
      return executeControlChart(toolInput);
    case 'read_repo_file':
      return executeReadRepoFile(toolInput, userSupabase);
    case 'list_data_catalog':
      return executeListDataCatalog(userSupabase);
    case 'describe_table':
      return executeDescribeTable(toolInput, userSupabase);
    case 'describe_lineage':
      return executeDescribeLineage(toolInput, userSupabase);
    case 'find_and_chart_series':
      return executeFindAndChartSeries(toolInput, userSupabase);
    default:
      return { success: false, error: `Tool desconocido: ${toolName}` };
  }
}
