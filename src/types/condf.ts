export interface CopNdf {
  days_diff_effective_expiration: number;
  trade_count: number;
  total_sum_notional_leg_2: number;
  average_exchange_rate: number;
  min_exchange_rate: number;
  median_exchange_rate: number;
  max_exchange_rate: number;
  last_trade_time: string;
  last_exchange_rate: number;
  last_volume: number;
}

export interface NDFCurvePoint {
  days: number;
  tenorLabel: string;
  medianRate: number;
  fwdFwdDeval: number;    // forward-forward devaluation between this node and the previous
  segment: string;        // e.g. "1M→3M"
  tradeCount: number;
  volumeUSD: number;
}

export interface CopFwdPoint {
  fecha: string;
  tenor: string;          // SN, 1M, 2M, 3M, 6M, 9M, 1Y
  tenor_months: number;   // 0, 1, 2, 3, 6, 9, 12
  bid: number | null;
  ask: number | null;
  mid: number | null;
  fwd_points: number | null;
}
