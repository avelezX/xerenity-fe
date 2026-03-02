import type {
  XccyPosition,
  NdfPosition,
  IbrSwapPosition,
  PricedXccy,
  PricedNdf,
  PricedIbrSwap,
  PortfolioRepriceResponse,
} from 'src/types/trading';

const BASE_URL =
  process.env.NEXT_PUBLIC_PYSDK_URL || 'https://xerenity-pysdk.fly.dev';

interface RawRepriceResponse {
  xccy_results: Record<string, unknown>[];
  ndf_results: Record<string, unknown>[];
  ibr_swap_results: Record<string, unknown>[];
  summary: PortfolioRepriceResponse['summary'];
}

// eslint-disable-next-line import/prefer-default-export
export const repricePortfolio = async (
  xccyPositions: XccyPosition[],
  ndfPositions: NdfPosition[],
  ibrSwapPositions: IbrSwapPosition[],
  options?: { valuation_date?: string }
): Promise<PortfolioRepriceResponse> => {
  const url = `${BASE_URL}/pricing/portfolio/reprice`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...(options?.valuation_date ? { valuation_date: options.valuation_date } : {}),
      xccy_positions: xccyPositions.map((p) => ({
        id: p.id,
        label: p.label,
        notional_usd: p.notional_usd,
        start_date: p.start_date,
        maturity_date: p.maturity_date,
        usd_spread_bps: p.usd_spread_bps,
        cop_spread_bps: p.cop_spread_bps,
        pay_usd: p.pay_usd,
        fx_initial: p.fx_initial,
        payment_frequency: p.payment_frequency,
        amortization_type: p.amortization_type,
        amortization_schedule: p.amortization_schedule,
      })),
      ndf_positions: ndfPositions.map((p) => ({
        id: p.id,
        label: p.label,
        notional_usd: p.notional_usd,
        strike: p.strike,
        maturity_date: p.maturity_date,
        direction: p.direction,
      })),
      ibr_swap_positions: ibrSwapPositions.map((p) => ({
        id: p.id,
        label: p.label,
        notional: p.notional,
        start_date: p.start_date,
        maturity_date: p.maturity_date,
        fixed_rate: p.fixed_rate,
        pay_fixed: p.pay_fixed,
        spread_bps: p.spread_bps,
        payment_frequency: p.payment_frequency,
      })),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Reprice failed: ${res.status}`);
  }

  const json = await res.json();
  const raw: RawRepriceResponse = json.body ?? json;

  // Merge original position data with pricing results (backend returns position_id)
  const xccyById = Object.fromEntries(xccyPositions.map((p) => [p.id, p]));
  const ndfById = Object.fromEntries(ndfPositions.map((p) => [p.id, p]));
  const ibrById = Object.fromEntries(ibrSwapPositions.map((p) => [p.id, p]));

  const n = (v: unknown, fallback = 0) => (v as number) ?? fallback;

  const xccyResults: PricedXccy[] = raw.xccy_results.map((r) => {
    const pos = xccyById[r.position_id as string];
    return {
      ...pos,
      npv_cop: n(r.npv_cop), npv_usd: n(r.npv_usd),
      pnl_rate_cop: n(r.pnl_rate_cop), pnl_rate_usd: n(r.pnl_rate_usd),
      pnl_fx_cop: n(r.pnl_fx_cop), pnl_fx_usd: n(r.pnl_fx_usd),
      usd_leg_pv: n(r.usd_leg_pv), cop_leg_pv: n(r.cop_leg_pv),
      usd_principal_pv: n(r.usd_principal_pv), cop_principal_pv: n(r.cop_principal_pv),
      carry_cop: n(r.carry_cop), carry_usd: n(r.carry_usd),
      carry_rate_cop_pct: n(r.carry_rate_cop_pct), carry_rate_usd_pct: n(r.carry_rate_usd_pct),
      carry_differential_bps: n(r.carry_differential_bps),
      dv01_ibr: n(r.dv01_ibr), dv01_sofr: n(r.dv01_sofr), dv01_total: n(r.dv01_total),
      fx_delta: n(r.fx_delta), fx_exposure_usd: n(r.fx_exposure_usd),
      par_basis_bps: r.par_basis_bps != null ? n(r.par_basis_bps) : null,
      notional_cop: n(r.notional_cop), fx_spot: n(r.fx_spot), n_periods: n(r.n_periods),
      cashflows: (r.cashflows as PricedXccy['cashflows']) ?? [],
      error: r.error as string | undefined,
    };
  });

  const ndfResults: PricedNdf[] = raw.ndf_results.map((r) => {
    const pos = ndfById[r.position_id as string];
    return {
      ...pos,
      npv_usd: n(r.npv_usd), npv_cop: n(r.npv_cop),
      forward: n(r.forward), forward_points: n(r.forward_points),
      carry_cop_daily: n(r.carry_cop_daily), carry_usd_daily: n(r.carry_usd_daily),
      days_to_maturity: n(r.days_to_maturity),
      df_usd: n(r.df_usd), df_cop: n(r.df_cop),
      delta_cop: n(r.delta_cop),
      dv01_cop: n(r.dv01_cop), dv01_usd: n(r.dv01_usd), dv01_total: n(r.dv01_total),
      fx_delta: n(r.fx_delta), fx_exposure_usd: n(r.fx_exposure_usd),
      spot: n(r.spot),
      error: r.error as string | undefined,
    };
  });

  const ibrSwapResults: PricedIbrSwap[] = raw.ibr_swap_results.map((r) => {
    const pos = ibrById[r.position_id as string];
    return {
      ...pos,
      npv: n(r.npv), fair_rate: n(r.fair_rate), dv01: n(r.dv01),
      fixed_leg_npv: n(r.fixed_leg_npv), floating_leg_npv: n(r.floating_leg_npv),
      ibr_overnight_pct: n(r.ibr_overnight_pct),
      carry_daily_cop: n(r.carry_daily_cop),
      carry_daily_diff_bps: n(r.carry_daily_diff_bps),
      ibr_fwd_period_pct: n(r.ibr_fwd_period_pct),
      carry_period_cop: n(r.carry_period_cop),
      carry_period_diff_bps: n(r.carry_period_diff_bps),
      error: r.error as string | undefined,
    };
  });

  return {
    xccy_results: xccyResults,
    ndf_results: ndfResults,
    ibr_swap_results: ibrSwapResults,
    summary: raw.summary,
  };
};
