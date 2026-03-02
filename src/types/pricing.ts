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

export interface IbrSwapCashflow {
  period: number;
  start: string;
  end: string;
  payment_date: string;
  days: number;
  fixed_rate: number;      // decimal
  floating_rate: number;   // decimal (IBR forward rate for the period)
  fixed_amount: number;    // COP
  floating_amount: number; // COP
  net_amount: number;      // COP (positive = net receipt)
  df: number;              // discount factor
  pv: number;              // present value COP
}

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
  // Optional carry fields (returned by backend when available)
  carry_daily_cop?: number;
  carry_daily_diff_bps?: number;
  ibr_overnight_pct?: number;
  ibr_fwd_period_pct?: number;
  carry_period_cop?: number;
  carry_period_diff_bps?: number;
  cashflows?: IbrSwapCashflow[];
}

export interface ParCurvePoint {
  tenor: string;
  tenor_years: number;
  par_rate: number;
  error?: string;
}

// ── TES Bond ──

// Matches pysdk TesBondPricer.cashflow_schedule() response exactly
export interface TesBondCashflow {
  date: string;
  date_str: string;
  period: number;
  coupon: number;
  principal: number;
  cashflow: number;        // total = coupon + principal
  discount_factor: number; // from TES yield curve
  pv: number;
  accrual_start: string;
  accrual_end: string;
  accrual_days: number;
  year_fraction: number;
}

// Carry/roll-down analytics returned by pysdk
export interface TesBondCarry {
  horizon_days: number;
  horizon_date: string;
  current_dirty: number;
  horizon_dirty: number;
  coupon_carry: number;
  rolldown: number;
  total_carry: number;
  total_carry_bps_annualized: number;
}

// Matches pysdk TesBondPricer.analytics() response
export interface TesBondResult {
  clean_price: number;
  dirty_price: number;
  accrued_interest: number;
  npv: number;
  ytm: number;              // decimal (e.g. 0.095 = 9.5%)
  macaulay_duration: number;
  modified_duration: number;
  convexity: number;
  dv01: number;
  bpv: number;
  coupon_rate: number;
  face_value: number;
  maturity: string;
  cashflows?: TesBondCashflow[];
  carry?: TesBondCarry;
  z_spread_bps?: number | null;
}

export interface TesCatalogItem {
  name: string;
  issue_date: string;
  maturity_date: string;
  coupon_rate: number;
  currency?: string;
}

export interface TesYieldCurvePoint {
  tenor: string;
  tenor_years: number;
  ytm: number;
  maturity_date?: string;
  name?: string;
}

// ── Xccy Swap ──

export interface XccySwapCashflow {
  period: number;
  start: string;
  end: string;
  payment_date: string;
  notional_usd: number;
  notional_cop: number;
  remaining_pct: number;
  usd_rate: number;
  cop_rate: number;
  usd_interest: number;
  cop_interest: number;
  usd_principal: number;
  cop_principal: number;
  usd_df: number;
  cop_df: number;
  net_cop: number;
}

export interface XccySwapResult {
  npv_cop: number;
  npv_usd: number;
  pnl_rate_cop: number;
  pnl_rate_usd: number;
  pnl_fx_cop: number;
  pnl_fx_usd: number;
  usd_leg_pv: number;
  cop_leg_pv: number;
  usd_principal_pv: number;
  cop_principal_pv: number;
  par_basis_bps: number | null;
  notional_usd: number;
  notional_cop: number;
  fx_initial: number;
  fx_spot: number;
  usd_spread_bps: number;
  cop_spread_bps: number;
  amortization_type: string;
  payment_frequency: string;
  start_date: string;
  maturity_date: string;
  n_periods: number;
  cashflows: XccySwapCashflow[];
}

export interface ParBasisPoint {
  tenor: string;
  tenor_years: number;
  par_basis_bps: number | null;
  error?: string;
}
