export interface RiskRow {
  asset: string;
  position_super: number | null;
  position_gr: number | null;
  position_total: number | null;
  var_super: number | null;
  var_gr: number | null;
  var_total: number | null;
  factor_var_diario: number | null;
  factor_unit: string | null;
  var_portfolio: number | null;
  price_start: number | null;
  price_end: number | null;
  pnl_super: number | null;
  pnl_gr: number | null;
  pnl_total: number | null;
  information_ratio: number | null;
}

export interface RiskConfig {
  filter_date: string;
  price_date_start: string;
  price_date_end: string;
  rolling_window: number;
  confidence_level: number;
}

export interface RiskManagementResponse {
  risk_table: RiskRow[];
  config: RiskConfig;
}

export interface RollingVarResponse {
  dates: string[];
  prices: Record<string, (number | null)[]>;
  rolling_var: Record<string, (number | null)[]>;
  contracts?: Record<string, string>;
}

export interface BenchmarkAssetFactors {
  factor_var_diario: number | null;
  daily_variance: number | null;
  price_start: number | null;
  price_end: number | null;
  factor_unit: string;
  contract?: string;
}

export interface BenchmarkFactorsResponse {
  factors: Record<string, BenchmarkAssetFactors>;
  covariance_matrix: Record<string, Record<string, number | null>>;
  correlation_matrix: Record<string, Record<string, number | null>>;
  assets: string[];
  contracts?: Record<string, string>;
  period: { start: string; end: string };
  covariance_period?: { start: string | null; end: string | null; observations: Record<string, number> };
  confidence_level?: number;
  z_score?: number;
}

export interface ExposureParams {
  proyeccion_azucar: number[];
  precio_azucar_cent_lb: number;
  factor_crudo_refinado?: number;
  proyeccion_glucosa: number[];
  precio_maiz_cent_bu: number;
  base_maiz_cent_bu: number;
  flete_usd_ton: number;
  processing_fee_usd: number;
  proc_fee_cop_kg: number;
  trm: number;
  factor_maiz_glucosa?: number;
  proyeccion_cocoa_polvo: number[];
  factor_cocoa_polvo?: number;
  proyeccion_manteca: number[];
  factor_manteca?: number;
  proyeccion_licor: number[];
  factor_licor?: number;
  precio_cocoa_usd_ton: number;
  proyeccion_bolsa: number[];
  proyeccion_envoltura: number[];
  precio_empaque_fijo: number;
  ventas_intl_usd?: number;
  ventas_co_usd?: number;
  ventas_pe_usd?: number;
}

export interface CommodityExposure {
  nombre: string;
  exchange: string;
  unidad_cotizacion: string;
  exposicion_usd: number;
  ton_total?: number;
  precio_por_ton?: number;
  precio_futuro?: number;
  [key: string]: unknown;
}

export interface MarketPrice {
  value: number;
  date: string;
  source: string;
  contract?: string;
}

export interface ExposureResponse {
  commodities: CommodityExposure[];
  total_commodities_usd: number;
  exposicion_ventas_intl: number;
  exposicion_real_usd: number;
  exposicion_pen: number;
  market_prices?: Record<string, MarketPrice>;
}

// ── Futures Portfolio ──

export interface FuturesPosition {
  id: string | null;
  asset: string;
  contract: string | null;
  direction: string | null;
  nominal: number | null;
  multiplier: number | null;
  entry_price: number | null;
  entry_date: string | null;
  current_price: number | null;
  current_price_date: string | null;
  precio_previo: number | null;
  precio_previo_date: string | null;
  valor_t: number | null;
  valor_t1: number | null;
  pnl_inception: number | null;
  pnl_month: number | null;
  price_unit: string | null;
  active?: boolean | null;
  closed_date?: string | null;
  closed_price?: number | null;
  rolled_to?: string | null;
}

export interface FuturesPortfolioResponse {
  portfolio: FuturesPosition[];
}

export interface NewFuturesPosition {
  asset: string;
  contract: string;
  direction: 'LONG' | 'SHORT';
  nominal: number;
  entry_price: number;
  entry_date: string;
}

export interface FuturesRollParams {
  position_id: string;
  new_contract: string;
  roll_price: number;
  new_entry_price?: number;
  roll_date?: string;
}

export interface FuturesCloseParams {
  position_id: string;
  closed_price: number;
  closed_date?: string;
}

export interface FuturesEditParams {
  position_id: string;
  updates: Partial<Pick<NewFuturesPosition, 'asset' | 'contract' | 'direction' | 'nominal' | 'entry_price' | 'entry_date'>>;
}
