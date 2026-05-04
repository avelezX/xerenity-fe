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

  // ── AKOMEL COP (aceite de palma crudo Malasia → productos terminados) ──
  // Solo se usa en Super de Alimentos. Port fiel del instructivo Python.
  akomel_fob_malasya?: number;              // USD/TON — FEP mensual (celda D8)
  akomel_international_freight?: number;    // USD/TON — FEP mensual (D9)
  akomel_risk_futures_fee?: number;         // USD/TON — 40/70 segun plazo (D11)
  akomel_trm?: number;                      // USD/COP — FEP mensual (D12)
  akomel_prima_abastecimiento?: number;     // COP/KG (D18)
  akomel_flete_extractora_fabrica?: number; // COP/KG (D19)
  akomel_tariff_aak_my_pct?: number;        // % arancel (C10, default 0.0004)
  akomel_bonificacion_calidad_pct?: number; // % bonif (C17, default 0.025)
  // AKOMEL Granel
  akomel_rend_impurezas_humedad_granel?: number;  // C27 (default 0.99)
  akomel_rend_acidez_aak_granel?: number;         // C28 (default 0.96)
  akomel_costos_transf_granel?: number;           // COP/KG (D29)
  // AKOMEL Sin Lecitina Caja 15Kg
  akomel_rend_impurezas_humedad_sl?: number;      // C33 (default 0.99)
  akomel_rend_acidez_aak_sl?: number;             // C34 (default 0.96)
  akomel_costos_transf_sl?: number;               // COP/KG (D35)
  akomel_material_empaque_sl?: number;            // COP/KG (D36)
  // AKOMEL Saborizado Caja 15Kg
  akomel_rend_impurezas_humedad_sab?: number;     // C40 (default 0.99)
  akomel_rend_acidez_aak_sab?: number;            // C41 (default 0.96)
  akomel_costos_transf_sab?: number;              // COP/KG (D42)
  akomel_material_empaque_sab?: number;           // COP/KG (D43)

  // ── CEBES MC 35 (Palmiste) ──
  cebes_precio_palmiste_cif?: number;         // USD/TON (D50)
  cebes_flete_malasia_colombia?: number;      // USD/TON (D51)
  cebes_flete_malasia_europa?: number;        // USD/TON (D52, puede ser negativo)
  cebes_trm?: number;                         // USD/COP (D56)
  cebes_arancel_pct?: number;                 // % (D53, default 0.001)
  // Informativos en la hoja (NO entran en la formula vigente D58)
  cebes_risk_futures_fee_palmiste?: number;   // USD/TON (D55)
  cebes_prima_rspo_mb?: number;               // USD/TON (D57)
  // Operativos
  cebes_prima_abastecimiento?: number;        // COP (D61)
  cebes_flete_extractora_fabrica?: number;    // COP/KG (D62)
  cebes_rend_impurezas_humedad?: number;      // C67 (default 0.994)
  cebes_rend_acidez_aak?: number;             // C68 (default 0.94)
  cebes_costos_transformacion?: number;       // COP/KG (D69)
  cebes_material_empaque?: number;            // COP/KG (D70)
  cebes_financiamiento?: number;              // COP/KG — 60 dias

  // ── ALMIDON (Maiz → almidon) ──
  almidon_flete_maritimo?: number;            // USD/TON (H13) — flete maritimo adicional
  almidon_factor_conversion_bush_ton?: number; // H11 (default 0.3936825)
  almidon_credito_subproductos_pct?: number;  // G15 (default 0.26)
  almidon_factor_conversion_maiz_almidon?: number; // G17 (default 1.6)

  // ── KG anual (input manual) para Exposicion Natural USD ──
  // AKOMEL tiene 3 productos derivados; CEBES y ALMIDON uno cada uno.
  kg_akomel_granel_anual?: number;     // Granel
  kg_akomel_sl_anual?: number;         // Sin Lecitina Caja 15Kg
  kg_akomel_sab_anual?: number;        // Saborizado Caja 15Kg
  kg_cebes_anual?: number;             // CEBES MC 35
  kg_almidon_anual?: number;           // Almidon

  // ── CAFE — Cobertura (empresas con CAFE en commodities) ──
  // Calculadora de cobertura basada en el modelo de El Embrujo:
  // P_compra = (KC + Prima_FNC) × 0.01 × TRM_compra × LB_CARGA × FR
  // P_venta  = (KC_venta + Prima_exp) × 0.01 × TRM_venta × LB_CARGA
  // Margen   = P_venta − P_compra
  precio_cafe_cent_lb?: number;        // KC front contract (¢/lb), desde risk_prices
  kc_venta_cafe_cent_lb?: number;      // KC al momento de venta (¢/lb), editable
  prima_fnc_cent_lb?: number;          // Prima FNC sobre KC para precio interno
  prima_exp_cent_lb?: number;          // Prima de exportacion sobre KC
  factor_rendimiento_cafe?: number;    // FR: 0.94 estandar, 0.92 premium, 0.88 especial
  trm_compra_cafe?: number;            // TRM al momento de compra (override editable, fallback a params.trm)
  trm_venta_cafe?: number;             // TRM al momento de cobro (puede diferir de params.trm)
  cargas_cafe_anual?: number;          // Volumen anual en cargas de 125 kg
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
  portfolio_id?: string | null;
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

// ── Resumen (Dashboard) ──

export interface CommodityRow {
  asset: string;
  contract: string | null;
  exposicion_natural: number | null;
  portafolio_gr: number | null;
  total: number | null;
  pnl_super: number | null;
  pnl_gr: number | null;
  pnl_total: number | null;
}

export interface CommoditiesResumen {
  rows: CommodityRow[];
  totals: CommodityRow;
}

export interface OTCResumen {
  posiciones: number;
  npv_cop: number | null;
  npv_usd: number | null;
  fx_delta: number | null;
  pnl_mtd_cop: number | null;
  pnl_mtd_usd: number | null;
}

export interface CreditosResumen {
  total_creditos: number;
  deuda_total: number | null;
  creditos_ibr: number;
  creditos_tasa_fija: number;
  creditos_uvr: number;
  tasa_promedio: number | null;
}

export interface ResumenData {
  fecha: string;
  commodities: CommoditiesResumen;
  otc: OTCResumen;
  creditos: CreditosResumen;
}

// ── Futures Edit ──

export interface FuturesEditParams {
  position_id: string;
  updates: Partial<Pick<NewFuturesPosition, 'asset' | 'contract' | 'direction' | 'nominal' | 'entry_price' | 'entry_date'>>;
}
