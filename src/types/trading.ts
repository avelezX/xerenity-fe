// ── Company / Role ──

export interface UserTradingRole {
  role: 'admin' | 'manager' | 'auditor' | null;
  company_id: string | null;
  company_name: string | null;
}

// ── Common operational fields (shared across all instrument types) ──

export interface OperationalFields {
  id_operacion?: string;       // ID Operación Interno (e.g. "FW-BOCS-05.02.2026")
  trade_date?: string;         // Fecha Celebración Operación
  sociedad?: string;           // Sociedad / entidad (e.g. "BP01")
  id_banco?: string;           // ID Operación Banco
  modalidad?: string;          // Non Delivery, Delivery, etc.
  settlement_date?: string;    // Fecha de Cumplimiento
  tipo_divisa?: string;        // Par de divisas (e.g. "USD/COP")
  estado?: string;             // Activo, Vencido, etc.
  doc_sap?: string;            // Doc. Contabilización SAP
}

// ── Position types (what's stored in Supabase) ──

export interface XccyPosition extends OperationalFields {
  id: string;
  owner: string;
  company_id?: string;
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

export interface NdfPosition extends OperationalFields {
  id: string;
  owner: string;
  company_id?: string;
  label: string;
  counterparty: string;
  notional_usd: number;
  strike: number;
  maturity_date: string;
  direction: string;
  created_at: string;
}

export interface IbrSwapPosition extends OperationalFields {
  id: string;
  owner: string;
  company_id?: string;
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

export interface XccyCashflow {
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

export interface PricedXccy extends XccyPosition {
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
  carry_cop: number;
  carry_usd: number;
  carry_rate_cop_pct: number;
  carry_rate_usd_pct: number;
  carry_differential_bps: number;
  dv01_ibr: number;
  dv01_sofr: number;
  dv01_total: number;
  fx_delta: number;
  fx_exposure_usd: number;
  par_basis_bps: number | null;
  notional_cop: number;
  fx_spot: number;
  n_periods: number;
  cashflows: XccyCashflow[];
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
  df_usd: number;
  df_cop: number;
  delta_cop: number;
  dv01_cop: number;
  dv01_usd: number;
  dv01_total: number;
  fx_delta: number;
  fx_exposure_usd: number;
  spot: number;
  error?: string;
}

export interface PricedIbrSwap extends IbrSwapPosition {
  npv: number;
  fair_rate: number;
  dv01: number;
  fixed_leg_npv: number;
  floating_leg_npv: number;
  ibr_overnight_pct: number;
  carry_daily_cop: number;
  carry_daily_diff_bps: number;
  ibr_fwd_period_pct: number;
  carry_period_cop: number;
  carry_period_diff_bps: number;
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

export type NewXccyPosition = Omit<XccyPosition, 'id' | 'owner' | 'company_id' | 'created_at'>;
export type NewNdfPosition = Omit<NdfPosition, 'id' | 'owner' | 'company_id' | 'created_at'>;
export type NewIbrSwapPosition = Omit<IbrSwapPosition, 'id' | 'owner' | 'company_id' | 'created_at'>;
