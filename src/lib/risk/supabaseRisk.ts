/* eslint-disable no-restricted-syntax, no-plusplus, no-continue */
/**
 * Direct Supabase queries for risk management data.
 * Replaces Django backend calls — reads from xerenity schema tables.
 */
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

const supabase = createClientComponentClient();
const SCHEMA = 'xerenity';

// ── Risk Prices (global market data) ──

export interface RiskPriceRow {
  date: string;
  asset: string;
  price: number;
  contract: string | null;
}

export async function fetchRiskPrices(
  startDate: string,
  endDate: string,
): Promise<RiskPriceRow[]> {
  const { data, error } = await supabase
    .schema(SCHEMA)
    .from('risk_prices')
    .select('date, asset, price, contract')
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true });

  if (error) throw new Error(`Failed to fetch risk_prices: ${error.message}`);
  return (data ?? []) as RiskPriceRow[];
}

/**
 * Pivot raw price rows into a date-indexed structure.
 * Returns { dates: string[], prices: { MAIZ: number[], AZUCAR: number[], ... } }
 */
export function pivotPrices(rows: RiskPriceRow[]): {
  dates: string[];
  prices: Record<string, (number | null)[]>;
  contracts: Record<string, string>;
} {
  const dateSet = new Set<string>();
  const assetSet = new Set<string>();
  const priceMap = new Map<string, Map<string, number>>();
  const contractMap = new Map<string, string>();

  for (const row of rows) {
    dateSet.add(row.date);
    assetSet.add(row.asset);

    if (!priceMap.has(row.date)) priceMap.set(row.date, new Map());
    priceMap.get(row.date)!.set(row.asset, row.price);

    if (row.contract) contractMap.set(row.asset, row.contract);
  }

  const dates = Array.from(dateSet).sort();
  const assets = Array.from(assetSet).sort();

  const prices: Record<string, (number | null)[]> = {};
  for (const asset of assets) {
    prices[asset] = dates.map((d) => priceMap.get(d)?.get(asset) ?? null);
  }

  const contracts: Record<string, string> = {};
  contractMap.forEach((contract, asset) => {
    contracts[asset] = contract;
  });

  return { dates, prices, contracts };
}

// ── Risk Prices ALL Contracts (per-contract close price) ──
//
// risk_prices stores SOLO el front contract por activo, asi que todos
// los contratos del mismo activo terminaban tomando el mismo precio
// (bug: el Portafolio GR mostraba 457.75 para ZCN26, ZCU26, ZCZ26, etc.).
//
// risk_prices_all_contracts almacena el close price por (date, asset, contract).
// Para mark-to-market del Portafolio GR usamos esta tabla, con fallback al
// front contract si no hay datos para un contrato especifico.

export interface RiskPriceContractRow {
  date: string;
  asset: string;
  contract: string;
  close: number;
}

export async function fetchRiskPricesAllContracts(
  startDate: string,
  endDate: string,
  contracts?: string[],
): Promise<RiskPriceContractRow[]> {
  let query = supabase
    .schema(SCHEMA)
    .from('risk_prices_all_contracts')
    .select('date, asset, contract, close')
    .gte('date', startDate)
    .lte('date', endDate);

  if (contracts && contracts.length > 0) {
    query = query.in('contract', contracts);
  }

  const { data, error } = await query.order('date', { ascending: true });

  if (error) throw new Error(`Failed to fetch risk_prices_all_contracts: ${error.message}`);
  return (data ?? []) as RiskPriceContractRow[];
}

/**
 * Pivot per-contract rows into a date-indexed structure keyed by contract.
 * Returns { dates: string[], pricesByContract: { ZCN26: [...], SBV26: [...], ... } }
 *
 * Si un contrato no tiene datos para una fecha, queda null en esa posicion.
 */
export function pivotPricesByContract(rows: RiskPriceContractRow[]): {
  dates: string[];
  pricesByContract: Record<string, (number | null)[]>;
} {
  const dateSet = new Set<string>();
  const contractSet = new Set<string>();
  // (date, contract) → close
  const priceMap = new Map<string, Map<string, number>>();

  for (const row of rows) {
    dateSet.add(row.date);
    contractSet.add(row.contract);
    if (!priceMap.has(row.date)) priceMap.set(row.date, new Map());
    priceMap.get(row.date)!.set(row.contract, row.close);
  }

  const dates = Array.from(dateSet).sort();
  const contracts = Array.from(contractSet).sort();

  const pricesByContract: Record<string, (number | null)[]> = {};
  for (const contract of contracts) {
    pricesByContract[contract] = dates.map((d) => priceMap.get(d)?.get(contract) ?? null);
  }

  return { dates, pricesByContract };
}

/**
 * Fetch distinct assets available in risk_prices (for onboarding).
 */
export async function fetchAvailableAssets(): Promise<string[]> {
  const { data, error } = await supabase
    .schema(SCHEMA)
    .from('risk_prices')
    .select('asset')
    .limit(1000);

  if (error) throw new Error(`Failed to fetch available assets: ${error.message}`);
  const assets = new Set<string>();
  (data ?? []).forEach((row: { asset: string }) => assets.add(row.asset));
  return Array.from(assets).sort();
}

// ── Risk Positions (per-company) ──

export interface RiskPositionRow {
  asset: string;
  position: number;
  position_type: 'benchmark' | 'gr';
  weight: number;
  company_id: string | null;
  portfolio_id: string | null;
}

export async function fetchRiskPositions(
  companyId?: string,
): Promise<RiskPositionRow[]> {
  let query = supabase
    .schema(SCHEMA)
    .from('risk_positions')
    .select('*')
    .order('asset', { ascending: true });

  if (companyId) query = query.eq('company_id', companyId);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to fetch risk_positions: ${error.message}`);
  return (data ?? []) as RiskPositionRow[];
}

// ── Portfolio Config (per-company) ──

export interface PortfolioConfigRow {
  id: string;
  price_date_start: string | null;
  price_date_end: string | null;
  rolling_window: number | null;
  confidence_level: number | null;
  company_id: string | null;
}

export async function fetchPortfolioConfig(
  companyId?: string,
): Promise<PortfolioConfigRow | null> {
  let query = supabase
    .schema(SCHEMA)
    .from('risk_portfolio_config')
    .select('*')
    .limit(1);

  if (companyId) query = query.eq('company_id', companyId);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to fetch risk_portfolio_config: ${error.message}`);
  return data?.[0] ?? null;
}

// ── Futures Portfolio (per-company) ──

export interface FuturesPositionRow {
  id: string;
  asset: string;
  contract: string;
  direction: 'LONG' | 'SHORT';
  nominal: number;
  entry_price: number;
  entry_date: string;
  active: boolean;
  closed_date: string | null;
  closed_price: number | null;
  rolled_to: string | null;
  company_id: string | null;
  portfolio_id: string | null;
}

export async function fetchFuturesPositionsFromDB(
  companyId?: string,
  activeOnly = true,
): Promise<FuturesPositionRow[]> {
  let query = supabase
    .schema(SCHEMA)
    .from('risk_futures_portfolio')
    .select('*')
    .order('entry_date', { ascending: false });

  if (activeOnly) query = query.eq('active', true);
  if (companyId) query = query.eq('company_id', companyId);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to fetch risk_futures_portfolio: ${error.message}`);
  return (data ?? []) as FuturesPositionRow[];
}

// ── CRUD for Futures Positions ──

export async function upsertFuturesPositionsDB(
  records: Partial<FuturesPositionRow>[],
): Promise<void> {
  // Insert puro (no upsert): se elimino el unique constraint
  // uq_futures_position en risk_futures_portfolio para permitir multiples
  // entradas al mismo contrato a diferentes precios. Si dejaramos .upsert
  // con onConflict apuntando a una constraint inexistente, PostgREST
  // retorna 400 y el "Crear" del Portafolio GR falla en silencio.
  const { error } = await supabase
    .schema(SCHEMA)
    .from('risk_futures_portfolio')
    .insert(records);

  if (error) throw new Error(`Failed to insert futures positions: ${error.message}`);
}

export async function closeFuturesPositionDB(
  positionId: string,
  closedDate: string,
  closedPrice: number,
  rolledTo?: string,
): Promise<void> {
  const payload: Record<string, unknown> = {
    active: false,
    closed_date: closedDate,
    closed_price: closedPrice,
  };
  if (rolledTo) payload.rolled_to = rolledTo;

  const { error } = await supabase
    .schema(SCHEMA)
    .from('risk_futures_portfolio')
    .update(payload)
    .eq('id', positionId);

  if (error) throw new Error(`Failed to close futures position: ${error.message}`);
}

export async function deleteFuturesPositionDB(positionId: string): Promise<void> {
  const { error } = await supabase
    .schema(SCHEMA)
    .from('risk_futures_portfolio')
    .delete()
    .eq('id', positionId);

  if (error) throw new Error(`Failed to delete futures position: ${error.message}`);
}

export async function editFuturesPositionDB(
  positionId: string,
  updates: Record<string, unknown>,
): Promise<void> {
  const allowed = ['asset', 'contract', 'direction', 'nominal', 'entry_price', 'entry_date'];
  const payload: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in updates) payload[key] = updates[key];
  }

  const { error } = await supabase
    .schema(SCHEMA)
    .from('risk_futures_portfolio')
    .update(payload)
    .eq('id', positionId);

  if (error) throw new Error(`Failed to edit futures position: ${error.message}`);
}

// ── Coffee Prices (precios locales de café) ──

export interface CoffeePriceRow {
  id: string;
  fecha: string;
  fuente: string;       // 'FNC' | 'ANSERMA'
  tipo_precio: string;  // 'precio_interno_carga', 'precio_base_f90', etc.
  valor: string;        // COP como string — parsear a number
  unidad: string;       // 'COP'
}

/**
 * Fetch coffee prices from xerenity.coffee_prices.
 * Returns rows sorted by fecha ascending for charting.
 */
export async function fetchCoffeePrices(
  startDate?: string,
  endDate?: string,
): Promise<CoffeePriceRow[]> {
  let query = supabase
    .schema(SCHEMA)
    .from('coffee_prices')
    .select('id, fecha, fuente, tipo_precio, valor, unidad')
    .order('fecha', { ascending: true });

  if (startDate) query = query.gte('fecha', startDate);
  if (endDate) query = query.lte('fecha', endDate);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to fetch coffee_prices: ${error.message}`);
  return (data ?? []) as CoffeePriceRow[];
}
