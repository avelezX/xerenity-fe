// ── Curve Status ──

export interface CurveNodeMap {
  [key: string]: number;
}

export interface CurveInfo {
  built: boolean;
  timestamp?: string;
  nodes?: CurveNodeMap;
}

export interface CurveStatus {
  valuation_date: string;
  fx_spot: number | null;
  ibr: CurveInfo;
  sofr: CurveInfo;
  ndf: CurveInfo;
  tes: { built: boolean; timestamp?: string };
}

export interface BuildResult {
  status: string;
  curves: { [key: string]: string };
  full_status: CurveStatus;
}

// ── NDF ──

export interface NdfPricingResult {
  npv_usd: number;
  npv_cop: number;
  forward: number;
  forward_points: number;
  strike: number;
  df_usd: number;
  df_cop: number;
  delta_cop?: number;
  notional_usd: number;
  direction: string;
  spot: number;
  maturity: string;
}

export interface NdfImpliedCurvePoint {
  tenor: string;
  tenor_months: number;
  forward_market: number;
  forward_irt_parity: number;
  basis: number;
}

// ── IBR Swap ──

export interface IbrSwapPricingResult {
  npv: number;
  fair_rate: number;
  fixed_rate: number;
  fixed_leg_npv: number;
  floating_leg_npv: number;
  fixed_leg_bps: number;
  dv01: number;
  notional: number;
  pay_fixed: boolean;
  spread: number;
}

export interface ParCurvePoint {
  tenor: string;
  tenor_years: number;
  par_rate: number;
  error?: string;
}

// ── TES Bond ──

export interface TesBondResult {
  clean_price: number;
  dirty_price: number;
  accrued_interest: number;
  npv: number;
  ytm: number;
  macaulay_duration: number;
  modified_duration: number;
  convexity: number;
  dv01: number;
  bpv: number;
  coupon_rate: number;
  face_value: number;
  maturity: string;
}

// ── Xccy Swap ──

export interface CurrentPeriodInfo {
  start: string;
  end: string;
  days_elapsed: number;
  notional_usd: number;
  notional_cop: number;
  ibr_fwd_pct: number;
  sofr_fwd_pct: number;
  differential_bps: number;
}

export interface XccySwapResult {
  // Valuation
  npv_cop: number;
  npv_usd: number;
  // Leg PVs
  usd_leg_pv: number;
  cop_leg_pv: number;
  usd_notional_exchange_pv: number;
  cop_notional_exchange_pv: number;
  usd_total: number;
  cop_total: number;
  // Notionals & FX
  notional_usd: number;
  notional_cop: number;
  fx_initial: number;
  fx_spot: number;
  // Risk
  fx_delta_cop: number;
  // Carry
  carry_daily_cop: number;
  carry_accrued_cop: number;
  // Period metadata
  days_open: number;
  periods_remaining: number;
  current_period: CurrentPeriodInfo | null;
  // Trade inputs
  xccy_basis_bps: number;
  amortization_type: string;
  start_date: string;
  maturity_date: string;
}

/** One row in the cashflow schedule (from /xccy-swap/cashflows). */
export interface PeriodCashflow {
  period_num: number;
  date_start: string;
  date_end: string;
  notional_usd: number;
  notional_cop: number;
  usd_coupon: number | null;
  cop_coupon: number | null;
  usd_principal: number;
  cop_principal: number;
  usd_net: number;
  cop_net: number;
  ibr_fwd_pct: number | null;
  sofr_fwd_pct: number | null;
  status: 'settled' | 'current' | 'future';
}

export interface XccyCashflowResponse {
  notional_usd: number;
  notional_cop: number;
  fx_initial: number;
  fx_spot: number;
  start_date: string;
  maturity_date: string;
  amortization_type: string;
  pay_usd: boolean;
  n_periods: number;
  periods: PeriodCashflow[];
}

export interface ParBasisPoint {
  tenor: string;
  tenor_years: number;
  par_basis_bps: number | null;
  error?: string;
}
