/* eslint-disable no-restricted-syntax, prefer-template */
/**
 * Risk Management API — frontend-only calculations.
 * Reads data directly from Supabase and computes VaR, exposure, and P&L locally.
 * No dependency on Fly.io/Django backend for the Commodities module.
 */
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type {
  RollingVarResponse, BenchmarkFactorsResponse,
  ExposureResponse, ExposureParams,
  FuturesPortfolioResponse, NewFuturesPosition, FuturesRollParams, FuturesCloseParams, FuturesEditParams,
} from 'src/types/risk';
import {
  fetchRiskPrices, pivotPrices,
  fetchRiskPricesAllContracts, pivotPricesByContract,
  fetchFuturesPositionsFromDB, upsertFuturesPositionsDB,
  closeFuturesPositionDB, deleteFuturesPositionDB, editFuturesPositionDB,
} from 'src/lib/risk/supabaseRisk';
import {
  calculateVarSeries, getLatestVarFactors, calculateMatrices,
  findPrice, getZScore,
} from 'src/lib/risk/varCalculator';
import { calcularExposicionTotal } from 'src/lib/risk/exposureCalculator';
import { calculateFuturesPortfolio, executeRoll } from 'src/lib/risk/futuresCalculator';
import type { CommodityConfig, RiskCompanyConfig } from 'src/lib/risk/companyConfig';
import { getUnits } from 'src/lib/risk/companyConfig';
import {
  parseISOAsNoon,
  formatISO,
  lastBusinessDayOfPrevMonth as lastBusinessDayOfPrevMonthDate,
  lastBusinessDayOfPrevQuarter as lastBusinessDayOfPrevQuarterDate,
} from 'src/lib/risk/dateHelpers';

// Cliente Supabase local para las RPCs nuevas de futures realized.
// (supabaseRisk.ts ya tiene su propio cliente; usamos uno propio aqui para
//  no exportar el suyo — simetria con otros modelos que llaman RPCs.)
const supabase = createClientComponentClient();

// Fallback units (used when no company config)
const DEFAULT_UNITS: Record<string, string> = {
  MAIZ: 'TONS', AZUCAR: 'TONS', CACAO: 'TONS', USD: 'USD/COP',
};

// ── Helper: get date range for price history ──

function getStartDate(filterDate: string, daysBack: number): string {
  const d = new Date(filterDate + 'T12:00:00');
  d.setDate(d.getDate() - daysBack);
  return d.toISOString().slice(0, 10);
}

/** Wrapper string -> string. Delegates a la implementacion inmutable de
 *  dateHelpers.ts (single source of truth, libre de mutacion). */
function lastBusinessDayOfPrevMonth(filterDate: string): string {
  return formatISO(lastBusinessDayOfPrevMonthDate(parseISOAsNoon(filterDate)));
}

/** Ultimo dia habil del trimestre anterior a filterDate. */
function lastBusinessDayOfPrevQuarter(filterDate: string): string {
  return formatISO(lastBusinessDayOfPrevQuarterDate(parseISOAsNoon(filterDate)));
}

/** Ventana de precios para el Benchmark.
 *  - 'month': inicio = ultimo dia habil del mes anterior (default)
 *  - 'quarter': inicio = ultimo dia habil del trimestre anterior
 *  Los Coches usa 'quarter' (su exposicion es trimestral).
 */
export type PriceWindowMode = 'month' | 'quarter';

// ── Benchmark Factors ──

export async function fetchBenchmarkFactors(
  filterDate: string,
  confidenceLevel = 0.99,
  companyConfig?: RiskCompanyConfig | null,
  priceWindowMode: PriceWindowMode = 'month',
): Promise<BenchmarkFactorsResponse> {
  const units = companyConfig ? getUnits(companyConfig) : DEFAULT_UNITS;
  const startDate = getStartDate(filterDate, 400); // ~13 months for 180d rolling + prices
  const rows = await fetchRiskPrices(startDate, filterDate);
  const { dates, prices: allPrices, contracts: allContracts } = pivotPrices(rows);

  // ── Filtrar por commodities de la empresa ──
  // risk_prices es global (tiene MAIZ, AZUCAR, CACAO, USD para todos), pero
  // cada empresa solo "ve" los activos que selecciono en risk_company_config.
  // Si no se filtra, una empresa nueva ve los datos de los demas (data leak).
  let prices = allPrices;
  let contracts = allContracts;
  if (companyConfig) {
    const allowedAssets = new Set<string>([
      ...companyConfig.commodities.map((c) => c.asset),
      companyConfig.currency_asset, // siempre incluir USD/currency
    ]);
    prices = Object.fromEntries(
      Object.entries(allPrices).filter(([asset]) => allowedAssets.has(asset)),
    );
    contracts = Object.fromEntries(
      Object.entries(allContracts).filter(([asset]) => allowedAssets.has(asset)),
    );
  }
  const assets = Object.keys(prices);

  if (assets.length === 0) {
    // No hay precios para los commodities de esta empresa. Retornamos respuesta
    // vacia en vez de lanzar error: las empresas nuevas con commodities sin
    // data en risk_prices deben ver el dashboard vacio, no un toast de error.
    return {
      factors: {},
      covariance_matrix: {},
      correlation_matrix: {},
      assets: [],
      contracts: {},
      period: { start: filterDate, end: filterDate },
      covariance_period: { start: filterDate, end: filterDate, observations: {} },
      confidence_level: confidenceLevel,
      z_score: Math.round(getZScore(confidenceLevel) * 10000) / 10000,
    };
  }

  const { varFactors, returns } = calculateVarSeries(prices, 180, confidenceLevel);
  const latestFactors = getLatestVarFactors(varFactors);
  const { covariance, correlation, observations } = calculateMatrices(returns, 180);

  // Price start: depende del priceWindowMode.
  //   - 'month' (default): ultimo dia habil del mes anterior
  //   - 'quarter': ultimo dia habil del trimestre anterior (Los Coches)
  const priceStartDate = priceWindowMode === 'quarter'
    ? lastBusinessDayOfPrevQuarter(filterDate)
    : lastBusinessDayOfPrevMonth(filterDate);

  const factors: Record<string, {
    factor_var_diario: number | null;
    daily_variance: number | null;
    price_start: number | null;
    price_end: number | null;
    factor_unit: string;
    contract?: string;
  }> = {};

  const actualStartDates: string[] = [];
  const actualEndDates: string[] = [];

  for (const asset of assets) {
    const pStart = findPrice(dates, prices[asset], priceStartDate);
    const pEnd = findPrice(dates, prices[asset], filterDate);
    if (pStart.date) actualStartDates.push(pStart.date);
    if (pEnd.date) actualEndDates.push(pEnd.date);

    const dailyVar = covariance[asset]?.[asset] ?? null;

    factors[asset] = {
      factor_var_diario: latestFactors[asset] ?? null,
      daily_variance: dailyVar,
      price_start: pStart.price != null ? Math.round(pStart.price * 10000) / 10000 : null,
      price_end: pEnd.price != null ? Math.round(pEnd.price * 10000) / 10000 : null,
      factor_unit: units[asset] ?? '',
      contract: contracts[asset],
    };
  }

  const realStart = actualStartDates.length > 0 ? actualStartDates.sort().pop()! : priceStartDate;
  const realEnd = actualEndDates.length > 0 ? actualEndDates.sort().pop()! : filterDate;

  // Covariance period
  const len = dates.length;
  const covStart = len > 180 ? dates[len - 180] : dates[0];
  const covEnd = dates[len - 1];

  return {
    factors,
    covariance_matrix: covariance,
    correlation_matrix: correlation,
    assets,
    contracts,
    period: { start: realStart, end: realEnd },
    covariance_period: { start: covStart, end: covEnd, observations },
    confidence_level: confidenceLevel,
    z_score: Math.round(getZScore(confidenceLevel) * 10000) / 10000,
  };
}

// ── Rolling VaR ──

export async function fetchRollingVar(
  filterDate: string,
  confidenceLevel = 0.99,
  companyConfig?: RiskCompanyConfig | null,
): Promise<RollingVarResponse> {
  const startDate = getStartDate(filterDate, 365);
  const rows = await fetchRiskPrices(startDate, filterDate);
  const { dates, prices: allPrices, contracts: allContracts } = pivotPrices(rows);

  // Filtrar por commodities de la empresa (ver fetchBenchmarkFactors).
  let prices = allPrices;
  let contracts = allContracts;
  if (companyConfig) {
    const allowedAssets = new Set<string>([
      ...companyConfig.commodities.map((c) => c.asset),
      companyConfig.currency_asset,
    ]);
    prices = Object.fromEntries(
      Object.entries(allPrices).filter(([asset]) => allowedAssets.has(asset)),
    );
    contracts = Object.fromEntries(
      Object.entries(allContracts).filter(([asset]) => allowedAssets.has(asset)),
    );
  }

  if (dates.length === 0 || Object.keys(prices).length === 0) {
    return { dates: [], prices: {}, rolling_var: {}, contracts: {} };
  }

  const { varFactors } = calculateVarSeries(prices, 180, confidenceLevel);

  // Rolling VaR in $ = var_factor × price
  const rollingVar: Record<string, (number | null)[]> = {};
  for (const [asset, factors] of Object.entries(varFactors)) {
    const assetPrices = prices[asset];
    rollingVar[asset] = factors.map((f, i) => {
      const p = assetPrices[i];
      if (f == null || p == null) return null;
      return Math.round(f * p * 100) / 100;
    });
  }

  return { dates, prices, rolling_var: rollingVar, contracts };
}

// ── Exposure ──

export async function fetchExposure(
  filterDate: string,
  exposureParams: ExposureParams,
  opts?: { includeSuperFormulas?: boolean },
): Promise<ExposureResponse> {
  // Fetch latest prices to override params
  const startDate = getStartDate(filterDate, 60);
  const rows = await fetchRiskPrices(startDate, filterDate);
  const { dates, prices, contracts } = pivotPrices(rows);

  const priceMap: Record<string, string> = {
    AZUCAR: 'precio_azucar_cent_lb',
    MAIZ: 'precio_maiz_cent_bu',
    CACAO: 'precio_cocoa_usd_ton',
    CAFE: 'precio_cafe_cent_lb',
    USD: 'trm',
  };

  const marketPrices: Record<string, { value: number; date: string; source: string; contract?: string }> = {};
  const params = { ...exposureParams };

  for (const [dbCol, paramKey] of Object.entries(priceMap)) {
    if (prices[dbCol]) {
      const found = findPrice(dates, prices[dbCol], filterDate);
      if (found.price != null && found.date != null) {
        marketPrices[paramKey] = {
          value: Math.round(found.price * 10000) / 10000,
          date: found.date,
          source: dbCol,
          contract: contracts[dbCol],
        };
        (params as Record<string, unknown>)[paramKey] = found.price;
      }
    }
  }

  const result = calcularExposicionTotal(params, { includeSuperFormulas: opts?.includeSuperFormulas });
  return {
    ...result,
    market_prices: marketPrices,
    // exposicion_ventas_intl es el INPUT de Ventas Internacionales (USD),
    // no el resultado de Exposicion Real. Bug anterior: asignaba
    // result.exposicion_real_usd, lo que hacia que "Ventas Intl" y "Real USD"
    // mostraran el mismo numero en el resumen (ambos 82.6M) aunque el input
    // era 130M.
    exposicion_ventas_intl: result.ventas_intl_usd,
    // exposicion_pen = input de Ventas Peru (no hardcode 0).
    exposicion_pen: result.ventas_pe_usd,
  } as unknown as ExposureResponse;
}

// ── Futures Portfolio ──

export async function fetchFuturesPortfolio(
  filterDate: string,
  activeOnly = true,
  companyId?: string,
  commodityConfig?: CommodityConfig[],
): Promise<FuturesPortfolioResponse> {
  const positions = await fetchFuturesPositionsFromDB(companyId, activeOnly);

  if (positions.length === 0) return { portfolio: [] };

  const startDate = getStartDate(filterDate, 90);

  // Cargamos:
  // 1) precios per-contrato desde risk_prices_all_contracts (fuente principal
  //    para mark-to-market — cada contrato tiene su propio precio).
  // 2) precios del front contract desde risk_prices como FALLBACK por si
  //    algun contrato del Portafolio GR no tiene datos en
  //    risk_prices_all_contracts (ej. recien creado, sin collector corrido).
  const uniqueContracts = Array.from(new Set(positions.map((p) => p.contract).filter(Boolean)));
  const [allContractRows, frontRows] = await Promise.all([
    fetchRiskPricesAllContracts(startDate, filterDate, uniqueContracts).catch(() => []),
    fetchRiskPrices(startDate, filterDate),
  ]);

  const { dates: contractDates, pricesByContract } = pivotPricesByContract(allContractRows);
  const { dates: frontDates, prices: frontPrices } = pivotPrices(frontRows);

  const portfolio = calculateFuturesPortfolio(
    positions,
    contractDates.length > 0 ? contractDates : frontDates,
    frontPrices,
    filterDate,
    commodityConfig,
    pricesByContract,
    contractDates,
  );
  return { portfolio };
}

// ── Futures CRUD ──

export async function upsertFuturesPositions(
  _filterDate: string,
  positions: NewFuturesPosition[],
  companyId?: string,
): Promise<{ status: string; count: number }> {
  const records = positions.map((p) => ({
    ...p,
    active: true,
    ...(companyId ? { company_id: companyId } : {}),
  }));
  await upsertFuturesPositionsDB(records);
  return { status: 'ok', count: positions.length };
}

export async function rollFuturesPosition(
  _filterDate: string,
  params: FuturesRollParams,
): Promise<{ status: string; closed_position_id: string; new_position: unknown }> {
  const positions = await fetchFuturesPositionsFromDB();
  const oldPos = positions.find((p) => p.id === params.position_id);
  if (!oldPos) throw new Error(`Position ${params.position_id} not found`);

  const { closeUpdate, newPosition } = executeRoll(
    oldPos, params.new_contract, params.roll_price,
    params.roll_date ?? new Date().toISOString().slice(0, 10),
    params.new_entry_price,
  );

  await closeFuturesPositionDB(
    params.position_id,
    closeUpdate.closed_date as string,
    closeUpdate.closed_price as number,
    closeUpdate.rolled_to as string,
  );
  await upsertFuturesPositionsDB([newPosition]);

  return { status: 'rolled', closed_position_id: params.position_id, new_position: newPosition };
}

export async function closeFuturesPosition(
  _filterDate: string,
  params: FuturesCloseParams,
): Promise<{ status: string; position_id: string; realized_pnl_usd?: number; realized_id?: string }> {
  const closeDate = params.closed_date ?? new Date().toISOString().slice(0, 10);

  // Si el caller pasa qty_closed + multiplier, usamos la RPC nueva que
  // calcula y persiste el P&L realizado en xerenity.risk_futures_realized.
  // Sin esos params (retro-compat) hacemos el UPDATE directo — el realized
  // se pierde, pero no rompemos callers viejos.
  if (params.qty_closed != null && params.multiplier_usd != null) {
    const { data, error } = await supabase
      .schema('xerenity')
      .rpc('close_futures_position', {
        p_position_id: params.position_id,
        p_close_date: closeDate,
        p_close_price: params.closed_price,
        p_qty_closed: params.qty_closed,
        p_multiplier_usd: params.multiplier_usd,
        p_note: params.note ?? null,
      });
    if (error) throw new Error(error.message || 'Failed to close futures position');
    const payload = data as {
      message?: string;
      realized_id?: string;
      realized_pnl_usd?: number;
    } | null;
    if (payload?.message && payload.message.startsWith('Cannot')) {
      throw new Error(payload.message);
    }
    return {
      status: 'closed',
      position_id: params.position_id,
      realized_pnl_usd: payload?.realized_pnl_usd,
      realized_id: payload?.realized_id,
    };
  }

  await closeFuturesPositionDB(
    params.position_id,
    closeDate,
    params.closed_price,
  );
  return { status: 'closed', position_id: params.position_id };
}

// ── Realized (P&L de cierres) ─────────────────────────────────────────

// Nota: usamos direct table SELECT en vez de RPC porque la RPC tenia
// problemas de resolucion via PostgREST desde el frontend (retornaba
// empty aunque data existiera en la tabla). RLS policy
// `can_view_company_data(company_id)` filtra correctamente:
//   - super_admin sin companyId → ve TODAS las filas
//   - super_admin con companyId → filtra por el picker
//   - corp_admin/gestor/lector → forzado a su empresa via can_view
export async function fetchFuturesRealized(
  companyId?: string | null,
): Promise<{ data: import('src/types/risk').FuturesRealizedRow[]; error?: string }> {
  let query = supabase
    .schema('xerenity')
    .from('risk_futures_realized')
    .select('id, position_id, company_id, asset, contract, direction, qty_closed, entry_price, close_price, close_date, multiplier_usd, realized_pnl_usd, note, closed_by, created_at')
    .order('close_date', { ascending: false })
    .order('created_at', { ascending: false });
  if (companyId) query = query.eq('company_id', companyId);
  const { data, error } = await query;
  if (error) return { data: [], error: error.message };
  // El shape del select() es igual al RPC excepto que `id` se llama `id` (no `realized_id`).
  // Mapeamos para mantener el mismo type que espera el UI.
  const rows = (data ?? []).map((r) => ({
    realized_id: (r as { id: string }).id,
    position_id: (r as { position_id: string }).position_id,
    company_id: (r as { company_id: string }).company_id,
    asset: (r as { asset: string }).asset,
    contract: (r as { contract: string }).contract,
    direction: (r as { direction: 'LONG' | 'SHORT' }).direction,
    qty_closed: (r as { qty_closed: number }).qty_closed,
    entry_price: Number((r as { entry_price: number }).entry_price),
    close_price: Number((r as { close_price: number }).close_price),
    close_date: (r as { close_date: string }).close_date,
    multiplier_usd: Number((r as { multiplier_usd: number }).multiplier_usd),
    realized_pnl_usd: Number((r as { realized_pnl_usd: number }).realized_pnl_usd),
    note: (r as { note: string | null }).note,
    closed_by: (r as { closed_by: string | null }).closed_by,
    created_at: (r as { created_at: string }).created_at,
  }));
  return { data: rows };
}

export async function fetchFuturesCommissions(
  companyId?: string | null,
): Promise<{ data: import('src/types/risk').FuturesCommissionRow[]; error?: string }> {
  let query = supabase
    .schema('xerenity')
    .from('risk_futures_commissions')
    .select('id, company_id, statement_date, broker, account, clearing_fee, commission, nfa_fee, other_fees, total_charges, note, created_at')
    .order('statement_date', { ascending: false });
  if (companyId) query = query.eq('company_id', companyId);
  const { data, error } = await query;
  if (error) return { data: [], error: error.message };
  const rows = (data ?? []).map((r) => ({
    id: (r as { id: string }).id,
    company_id: (r as { company_id: string }).company_id,
    statement_date: (r as { statement_date: string }).statement_date,
    broker: (r as { broker: string }).broker,
    account: (r as { account: string | null }).account,
    clearing_fee: Number((r as { clearing_fee: number }).clearing_fee),
    commission: Number((r as { commission: number }).commission),
    nfa_fee: Number((r as { nfa_fee: number }).nfa_fee),
    other_fees: Number((r as { other_fees: number }).other_fees),
    total_charges: Number((r as { total_charges: number }).total_charges),
    note: (r as { note: string | null }).note,
    created_at: (r as { created_at: string }).created_at,
  }));
  return { data: rows };
}

export async function deleteFuturesPosition(
  _filterDate: string,
  positionId: string,
): Promise<{ status: string; position_id: string }> {
  await deleteFuturesPositionDB(positionId);
  return { status: 'deleted', position_id: positionId };
}

export async function editFuturesPosition(
  _filterDate: string,
  params: FuturesEditParams,
): Promise<{ status: string; position_id: string; updated_fields: string[] }> {
  await editFuturesPositionDB(params.position_id, params.updates);
  return { status: 'updated', position_id: params.position_id, updated_fields: Object.keys(params.updates) };
}
