/* eslint-disable no-restricted-syntax, no-plusplus, no-continue */
/**
 * Direct Supabase queries for risk management data.
 * Replaces Django backend calls — reads from xerenity schema tables.
 */
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { fetchFxSpotSeries } from 'src/lib/risk/marketMarks';

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
  // Commodities: precios EOD vienen de `risk_prices` (alimentada por collectors
  // de IB para MAIZ/AZUCAR/CACAO/CAFE/etc.). Excluimos asset='USD' aqui.
  // USD: viene de `market_marks.fx_spot` para ser consistente con OTC pricing
  // y con la fuente unica de verdad del modulo. Si en `risk_prices` queda
  // alguna fila vieja con asset='USD', se ignora.
  const { data: commodityData, error: commodityErr } = await supabase
    .schema(SCHEMA)
    .from('risk_prices')
    .select('date, asset, price, contract')
    .gte('date', startDate)
    .lte('date', endDate)
    .neq('asset', 'USD')
    .order('date', { ascending: true });

  if (commodityErr) throw new Error(`Failed to fetch risk_prices: ${commodityErr.message}`);
  const commodityRows = (commodityData ?? []) as RiskPriceRow[];

  // USD desde market_marks (single source of truth EOD para FX).
  // Si falla, no rompemos los commodities — solo loggeamos.
  let usdRows: RiskPriceRow[] = [];
  try {
    const fxSeries = await fetchFxSpotSeries(startDate, endDate);
    usdRows = fxSeries.map((p) => ({
      date: p.fecha,
      asset: 'USD',
      price: p.fx_spot,
      contract: null,
    }));
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('fetchRiskPrices: no se pudo cargar USD de market_marks:', e);
  }

  return [...commodityRows, ...usdRows].sort((a, b) => a.date.localeCompare(b.date));
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

// ── Cafe Ventas (blotter de venta a Sucafina / clientes finales) ──
//
// Reemplazo (jun 2026) del antiguo Blotter Fijaciones que vivia ligado a
// cafe_lotes. El blotter de ventas es independiente del lote de compra
// y trae campos extra para identificar el contrato externo:
//   - ref_contrato (e.g. "MPEX-18066")
//   - ny_mes (mes del contrato NY al que se fija: "U6", "Z6", ...)
//   - calidad (e.g. "Mr Hat (Excelso)")
//   - estado (texto libre)
// Calculos numericos por fila: precio_final = ny + prima, etc. (ver
// BlotterVentasCafe.tsx).

export interface CafeVentaRow {
  id: string;
  company_id: string;
  // Discriminador: 'fijacion_ny' (NY pricing, Sucafina-style) | 'factura_cop'
  // (factura domestica COP/kg, El Embrujo channels).
  tipo_venta?: 'fijacion_ny' | 'factura_cop';
  // ── Fijacion NY (puede ser null si tipo_venta=factura_cop) ──
  ref_contrato: string;      // "MPEX-18066"
  ny_mes: string;            // "U6", "Z6", ...
  calidad: string;           // "Mr Hat (Excelso)" — kept in schema, hidden in UI
  fijacion_ny: number | null;       // cents/lb del NY base
  prima: number | null;             // diferencial cents/lb
  fijacion_cop: number | null;      // TRM al fijar
  // ── Factura COP (puede ser null si tipo_venta=fijacion_ny) ──
  factura?: string | null;          // "EMB-388"
  cliente?: string | null;          // "SUCAFINA COLOMBIA SAS"
  producto?: string | null;         // "CAFE PERGAMINO SECO", "WIZARD", ...
  valor_kilo?: number | null;       // COP/kg directo
  // ── Lookups capturados al momento del seed (factura_cop) ──
  trm_dia?: number | null;          // BanRep serie 25 al fecha_fijacion
  precio_kc_cents?: number | null;  // risk_prices CAFE al fecha_fijacion
  // ── Comunes ──
  fecha_fijacion: string;    // YYYY-MM-DD
  sacos: number;
  kg: number;
  moneda: 'COP' | 'USD';
  estado: string;
  created_at?: string;
  updated_at?: string;
}

export async function fetchCafeVentas(companyId: string): Promise<CafeVentaRow[]> {
  const { data, error } = await supabase
    .schema(SCHEMA)
    .from('cafe_ventas')
    .select('*')
    .eq('company_id', companyId)
    .order('fecha_fijacion', { ascending: true });
  if (error) throw new Error(`Failed to fetch cafe_ventas: ${error.message}`);
  return (data ?? []) as CafeVentaRow[];
}

export async function insertCafeVenta(
  row: Omit<CafeVentaRow, 'id' | 'created_at' | 'updated_at'>,
): Promise<CafeVentaRow> {
  const { data, error } = await supabase
    .schema(SCHEMA)
    .from('cafe_ventas')
    .insert(row)
    .select()
    .single();
  if (error) throw new Error(`Failed to insert cafe_venta: ${error.message}`);
  return data as CafeVentaRow;
}

export async function updateCafeVenta(
  id: string,
  updates: Partial<Omit<CafeVentaRow, 'id' | 'company_id' | 'created_at' | 'updated_at'>>,
): Promise<void> {
  const { error } = await supabase
    .schema(SCHEMA)
    .from('cafe_ventas')
    .update(updates)
    .eq('id', id);
  if (error) throw new Error(`Failed to update cafe_venta: ${error.message}`);
}

/**
 * Busca el TRM BanRep (serie 25) mas reciente al fecha dada (YYYY-MM-DD).
 * Null si no encuentra dato historico.
 */
export async function fetchTrmAtDate(fecha: string): Promise<number | null> {
  const { data, error } = await supabase
    .schema(SCHEMA)
    .from('banrep_series_value_v2')
    .select('valor,fecha')
    .eq('id_serie', 25)
    .lte('fecha', fecha)
    .order('fecha', { ascending: false })
    .limit(1);
  if (error) {
    // eslint-disable-next-line no-console
    console.warn('fetchTrmAtDate error:', error.message);
    return null;
  }
  const v = (data ?? [])[0]?.valor;
  return v != null ? Number(v) : null;
}

/**
 * Busca el precio KC (CAFE front contract) mas reciente al fecha dada.
 * Retorna en ¢/lb (asi se almacena en risk_prices).
 */
export async function fetchKcPriceAtDate(fecha: string): Promise<number | null> {
  const { data, error } = await supabase
    .schema(SCHEMA)
    .from('risk_prices')
    .select('price,date')
    .eq('asset', 'CAFE')
    .lte('date', fecha)
    .order('date', { ascending: false })
    .limit(1);
  if (error) {
    // eslint-disable-next-line no-console
    console.warn('fetchKcPriceAtDate error:', error.message);
    return null;
  }
  const p = (data ?? [])[0]?.price;
  return p != null ? Number(p) : null;
}

export async function deleteCafeVenta(id: string): Promise<void> {
  const { error } = await supabase
    .schema(SCHEMA)
    .from('cafe_ventas')
    .delete()
    .eq('id', id);
  if (error) throw new Error(`Failed to delete cafe_venta: ${error.message}`);
}

// Factor de conversion (vive en risk_company_config.cafe_factor_conversion)

export async function fetchCafeFactorConversion(companyId: string): Promise<number> {
  const { data, error } = await supabase
    .schema(SCHEMA)
    .from('risk_company_config')
    .select('cafe_factor_conversion')
    .eq('company_id', companyId)
    .maybeSingle();
  if (error) throw new Error(`Failed to fetch cafe_factor_conversion: ${error.message}`);
  return Number(data?.cafe_factor_conversion ?? 1.5432);
}

export async function updateCafeFactorConversion(
  companyId: string,
  factor: number,
): Promise<void> {
  const { error } = await supabase
    .schema(SCHEMA)
    .from('risk_company_config')
    .update({ cafe_factor_conversion: factor })
    .eq('company_id', companyId);
  if (error) throw new Error(`Failed to update cafe_factor_conversion: ${error.message}`);
}

// ── Cafe Compras (blotter de compra) ──

export interface CafeCompraRow {
  id: string;
  company_id: string;
  lote_id: string;               // FK a cafe_lotes — NOT NULL desde mayo 2026
  fecha_compra: string;          // YYYY-MM-DD
  total_kg: number;              // kg de cafe humedo comprado
  valor_compra_at: number;       // COP por @
  factor_humedo: number;         // conversion humedo -> verde (default 0.1431, editable per fila)
  // estado/finca/calidad existen en la DB con defaults pero la UI no
  // las muestra (decision de jun-2026: blotter consolidado por semana).
  estado?: string;
  finca?: string;
  calidad?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Lee compras de cafe.
 * - Si se pasa `loteId`: filtra solo las de ese lote.
 * - Si no: retorna TODAS las de la empresa (util para Resumen Empresa).
 */
export async function fetchCafeCompras(
  companyId: string,
  loteId?: string,
): Promise<CafeCompraRow[]> {
  let query = supabase
    .schema(SCHEMA)
    .from('cafe_compras')
    .select('*')
    .eq('company_id', companyId);
  if (loteId) query = query.eq('lote_id', loteId);
  const { data, error } = await query.order('fecha_compra', { ascending: true });
  if (error) throw new Error(`Failed to fetch cafe_compras: ${error.message}`);
  return (data ?? []) as CafeCompraRow[];
}

export async function insertCafeCompra(
  row: Omit<CafeCompraRow, 'id' | 'created_at' | 'updated_at'>,
): Promise<CafeCompraRow> {
  const { data, error } = await supabase
    .schema(SCHEMA)
    .from('cafe_compras')
    .insert(row)
    .select()
    .single();
  if (error) throw new Error(`Failed to insert cafe_compra: ${error.message}`);
  return data as CafeCompraRow;
}

export async function updateCafeCompra(
  id: string,
  updates: Partial<Omit<CafeCompraRow, 'id' | 'company_id' | 'created_at' | 'updated_at'>>,
): Promise<void> {
  const { error } = await supabase
    .schema(SCHEMA)
    .from('cafe_compras')
    .update(updates)
    .eq('id', id);
  if (error) throw new Error(`Failed to update cafe_compra: ${error.message}`);
}

export async function deleteCafeCompra(id: string): Promise<void> {
  const { error } = await supabase
    .schema(SCHEMA)
    .from('cafe_compras')
    .delete()
    .eq('id', id);
  if (error) throw new Error(`Failed to delete cafe_compra: ${error.message}`);
}

// Globals de compra (kg_per_at + lbs_por_contrato_kc)
// Nota: factor_humedo ya NO es global. Vive per-fila en cafe_compras
// porque el rendimiento puede mejorar con el tiempo y se ajusta manualmente.

export interface CafeCompraGlobals {
  kg_per_at: number;            // default 60
  lbs_per_contrato_kc: number;  // default 37500
}

export async function fetchCafeCompraGlobals(companyId: string): Promise<CafeCompraGlobals> {
  const { data, error } = await supabase
    .schema(SCHEMA)
    .from('risk_company_config')
    .select('cafe_kg_per_at_compra, cafe_lbs_per_contrato_kc')
    .eq('company_id', companyId)
    .maybeSingle();
  if (error) throw new Error(`Failed to fetch cafe compra globals: ${error.message}`);
  return {
    kg_per_at: Number(data?.cafe_kg_per_at_compra ?? 60),
    lbs_per_contrato_kc: Number(data?.cafe_lbs_per_contrato_kc ?? 37500),
  };
}

export async function updateCafeCompraGlobals(
  companyId: string,
  globals: Partial<CafeCompraGlobals>,
): Promise<void> {
  const payload: Record<string, number> = {};
  if (globals.kg_per_at != null) payload.cafe_kg_per_at_compra = globals.kg_per_at;
  if (globals.lbs_per_contrato_kc != null) payload.cafe_lbs_per_contrato_kc = globals.lbs_per_contrato_kc;
  const { error } = await supabase
    .schema(SCHEMA)
    .from('risk_company_config')
    .update(payload)
    .eq('company_id', companyId);
  if (error) throw new Error(`Failed to update cafe compra globals: ${error.message}`);
}

// Precio actual KC desde risk_prices (front contract de CAFE)
export async function fetchLatestCafePriceCents(): Promise<{ price: number; date: string } | null> {
  const { data, error } = await supabase
    .schema(SCHEMA)
    .from('risk_prices')
    .select('date, price')
    .eq('asset', 'CAFE')
    .order('date', { ascending: false })
    .limit(1);
  if (error) {
    // eslint-disable-next-line no-console
    console.error('fetchLatestCafePriceCents error:', error);
    throw new Error(`Failed to fetch latest CAFE price: ${error.message}`);
  }
  const row = data?.[0];
  if (!row) return null;
  return { price: Number(row.price), date: String(row.date) };
}

// ── Cafe Lotes (agrupador de compras + fijaciones) ──

export interface CafeLoteRow {
  id: string;
  company_id: string;
  nombre: string;
  descripcion: string | null;
  origen: string | null;
  fecha_apertura: string;   // YYYY-MM-DD
  created_at?: string;
  updated_at?: string;
}

export async function fetchCafeLotes(companyId: string): Promise<CafeLoteRow[]> {
  const { data, error } = await supabase
    .schema(SCHEMA)
    .from('cafe_lotes')
    .select('*')
    .eq('company_id', companyId)
    .order('fecha_apertura', { ascending: true });
  if (error) throw new Error(`Failed to fetch cafe_lotes: ${error.message}`);
  return (data ?? []) as CafeLoteRow[];
}

export async function insertCafeLote(
  row: Omit<CafeLoteRow, 'id' | 'created_at' | 'updated_at'>,
): Promise<CafeLoteRow> {
  const { data, error } = await supabase
    .schema(SCHEMA)
    .from('cafe_lotes')
    .insert(row)
    .select()
    .single();
  if (error) throw new Error(`Failed to insert cafe_lote: ${error.message}`);
  return data as CafeLoteRow;
}

export async function updateCafeLote(
  id: string,
  updates: Partial<Omit<CafeLoteRow, 'id' | 'company_id' | 'created_at' | 'updated_at'>>,
): Promise<void> {
  const { error } = await supabase
    .schema(SCHEMA)
    .from('cafe_lotes')
    .update(updates)
    .eq('id', id);
  if (error) throw new Error(`Failed to update cafe_lote: ${error.message}`);
}

export async function deleteCafeLote(id: string): Promise<void> {
  // El FK ON DELETE RESTRICT impide borrar lotes con compras/fijaciones.
  // El error de Supabase se propaga al caller que debe mostrar mensaje claro.
  const { error } = await supabase
    .schema(SCHEMA)
    .from('cafe_lotes')
    .delete()
    .eq('id', id);
  if (error) throw new Error(`Failed to delete cafe_lote: ${error.message}`);
}
