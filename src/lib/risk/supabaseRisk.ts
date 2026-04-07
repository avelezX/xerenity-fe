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
