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
  ibrSwapPositions: IbrSwapPosition[]
): Promise<PortfolioRepriceResponse> => {
  const url = `${BASE_URL}/pricing/portfolio/reprice`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
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

  const xccyResults: PricedXccy[] = raw.xccy_results.map((r) => {
    const posId = r.position_id as string;
    const pos = xccyById[posId];
    return {
      ...pos,
      npv_cop: (r.npv_cop as number) ?? 0,
      npv_usd: (r.npv_usd as number) ?? 0,
      pnl_rate_cop: (r.pnl_rate_cop as number) ?? 0,
      pnl_fx_cop: (r.pnl_fx_cop as number) ?? 0,
      carry_cop: (r.carry_cop as number) ?? 0,
      carry_differential_bps: (r.carry_differential_bps as number) ?? 0,
      par_basis_bps: (r.par_basis_bps as number) ?? null,
      error: r.error as string | undefined,
    };
  });

  const ndfResults: PricedNdf[] = raw.ndf_results.map((r) => {
    const posId = r.position_id as string;
    const pos = ndfById[posId];
    return {
      ...pos,
      npv_usd: (r.npv_usd as number) ?? 0,
      npv_cop: (r.npv_cop as number) ?? 0,
      forward: (r.forward as number) ?? 0,
      forward_points: (r.forward_points as number) ?? 0,
      carry_cop_daily: (r.carry_cop_daily as number) ?? 0,
      carry_usd_daily: (r.carry_usd_daily as number) ?? 0,
      days_to_maturity: (r.days_to_maturity as number) ?? 0,
      error: r.error as string | undefined,
    };
  });

  const ibrSwapResults: PricedIbrSwap[] = raw.ibr_swap_results.map((r) => {
    const posId = r.position_id as string;
    const pos = ibrById[posId];
    return {
      ...pos,
      npv: (r.npv as number) ?? 0,
      fair_rate: (r.fair_rate as number) ?? 0,
      dv01: (r.dv01 as number) ?? 0,
      carry_cop: (r.carry_cop as number) ?? 0,
      carry_differential_bps: (r.carry_differential_bps as number) ?? 0,
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
