export interface RiskRow {
  weight: number | null;
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
}

export interface BenchmarkAssetFactors {
  factor_var_diario: number | null;
  daily_variance: number | null;
  price_start: number | null;
  price_end: number | null;
  factor_unit: string;
}

export interface BenchmarkFactorsResponse {
  factors: Record<string, BenchmarkAssetFactors>;
  covariance_matrix: Record<string, Record<string, number | null>>;
  correlation_matrix: Record<string, Record<string, number | null>>;
  assets: string[];
  period: { start: string; end: string };
}
