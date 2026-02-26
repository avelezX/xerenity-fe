// ── Position types (what's stored in Supabase) ──

export interface XccyPosition {
  id: string;
  owner: string;
  label: string;
  counterparty: string;
  notional_usd: number;
  start_date: string;
  maturity_date: string;
  usd_spread_bps: number;
  cop_spread_bps: number;
  pay_usd: boolean;
  fx_initial: number;
  payment_frequency: string;
  amortization_type: string;
  amortization_schedule?: number[];
  created_at: string;
}

export interface NdfPosition {
  id: string;
  owner: string;
  label: string;
  counterparty: string;
  notional_usd: number;
  strike: number;
  maturity_date: string;
  direction: string;
  created_at: string;
}

export interface IbrSwapPosition {
  id: string;
  owner: string;
  label: string;
  counterparty: string;
  notional: number;
  start_date: string;
  maturity_date: string;
  fixed_rate: number;
  pay_fixed: boolean;
  spread_bps: number;
  payment_frequency: string;
  created_at: string;
}

// ── Priced positions (position + live pricing results) ──

export interface PricedXccy extends XccyPosition {
  npv_cop: number;
  npv_usd: number;
  pnl_rate_cop: number;
  pnl_fx_cop: number;
  carry_cop: number;
  carry_differential_bps: number;
  par_basis_bps: number | null;
  error?: string;
}

export interface PricedNdf extends NdfPosition {
  npv_usd: number;
  npv_cop: number;
  forward: number;
  forward_points: number;
  carry_cop_daily: number;
  carry_usd_daily: number;
  days_to_maturity: number;
  error?: string;
}

export interface PricedIbrSwap extends IbrSwapPosition {
  npv: number;
  fair_rate: number;
  dv01: number;
  carry_cop: number;
  carry_differential_bps: number;
  error?: string;
}

// ── Portfolio summary ──

export interface PortfolioSummary {
  total_npv_cop: number;
  total_npv_usd: number;
  total_carry_cop: number;
  total_carry_usd: number;
  total_pnl_rate_cop: number;
  total_pnl_fx_cop: number;
}

// ── Portfolio reprice response ──

export interface PortfolioRepriceResponse {
  xccy_results: PricedXccy[];
  ndf_results: PricedNdf[];
  ibr_swap_results: PricedIbrSwap[];
  summary: PortfolioSummary;
}

// ── Create position params (omit server-generated fields) ──

export type NewXccyPosition = Omit<XccyPosition, 'id' | 'owner' | 'created_at'>;
export type NewNdfPosition = Omit<NdfPosition, 'id' | 'owner' | 'created_at'>;
export type NewIbrSwapPosition = Omit<IbrSwapPosition, 'id' | 'owner' | 'created_at'>;
