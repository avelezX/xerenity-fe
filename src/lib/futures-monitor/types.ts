/**
 * TypeScript types para el endpoint /futures_monitor/sugar.
 *
 * Espejo de las dataclasses en
 * pysdk/gestion_de_riesgos/futures_monitor/schemas.py
 * Si cambian alla, actualizar aqui (no hay codegen).
 */

export interface LiquidityThresholdsDTO {
  min_oi: number;
  min_adv_20d: number;
  max_bid_ask_ticks: number;
  max_bid_ask_pct_of_spread: number;
  max_stale_business_days: number;
  min_calendar_days_to_expiry: number;
  fail_on_missing: boolean;
}

export interface TimePoint {
  date: string;            // ISO YYYY-MM-DD
  value: number | null;
}

export interface KPIs {
  front_month_price: number | null;
  front_month_change_1d_pct: number | null;
  front_month_last_date: string | null;
  front_month_age_str: string;          // "hoy" | "ayer" | "hace 3d"
  n_contratos: number;
  estructura: string;                    // Contango | Backwardation | Flat | N/A
  vol_20d_pct: number | null;
  vol_60d_pct: number | null;
  range_52w_min: number | null;
  range_52w_max: number | null;
  ytd_change_pct: number | null;
  n_signals_operable: number;
  n_signals_iliquid: number;
}

export interface CurveRow {
  label: string;
  ticker: string;
  price: number;
  days_to_exp: number;
  spread_vs_front: number;
  expiry: string;       // ISO
  obs: number;
}

export interface SpreadMeta {
  name: string;
  actual: number;
  ma_20d: number | null;
  std_20d: number | null;
  z_score: number | null;
  pctile: number | null;
  min_hist: number;
  max_hist: number;
}

export interface FlyMeta extends SpreadMeta {
  senal: string;
}

export interface SlopeMeta {
  tramo: string;
  actual: number;
  d_5d: number;
  d_20d: number;
  mean_hist: number;
  z_score: number;
  tendencia: string;            // STEEPENING | FLATTENING | ESTABLE
}

export interface SignalRow {
  tipo: string;                 // Calendar | Butterfly | Pendiente
  instrumento: string;
  valor: number;
  z_score: number;
  pctile: number;
  senal: string;
  score: number;
  conviccion: string;           // ALTA | MEDIA | BAJA
  ma_20d: number;
  sigma: number;
  liquidez: string;             // LIQUIDA | MARGINAL | ILIQUIDA
  bottleneck: string;
  motivo_bottleneck: string;
  oi_min: number | null;
  adv_min: number | null;
  ba_max_ticks: number | null;
  ba_max_pct: number | null;
  edad_ult_trade: number | null;
  dte_min: number | null;
  score_ajustado: number;
  playbook_md: string;
  legs: string[];
}

export interface SpreadSeries {
  name: string;
  history: TimePoint[];
}

export interface SugarSnapshot {
  asset: string;                // SUGAR
  ticker: string;               // SB=F
  as_of: string;
  kpis: KPIs;
  curve: CurveRow[];
  front_history: TimePoint[];
  calendar_spreads: SpreadMeta[];
  calendar_spread_series: SpreadSeries[];
  butterflies: FlyMeta[];
  butterfly_series: SpreadSeries[];
  slopes: SlopeMeta[];
  slope_series: SpreadSeries[];
  signals_operable: SignalRow[];
  signals_iliquid: SignalRow[];
}
