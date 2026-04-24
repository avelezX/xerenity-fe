import type {
  XccyPosition,
  NdfPosition,
  IbrSwapPosition,
  PricedXccy,
  PricedNdf,
  PricedIbrSwap,
  PortfolioRepriceResponse,
} from 'src/types/trading';
import { telemetry } from 'src/lib/telemetry';

const BASE_URL =
  process.env.NEXT_PUBLIC_PYSDK_URL || 'https://pysdk.fly.dev';

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
  return telemetry.time(
    'reprice',
    'portfolio/reprice',
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    async () => repriceImpl(url, xccyPositions, ndfPositions, ibrSwapPositions, options),
    {
      valuationDate: options?.valuation_date ?? 'today',
      xccyCount: xccyPositions.length,
      ndfCount: ndfPositions.length,
      ibrCount: ibrSwapPositions.length,
    },
  );
};

async function repriceImpl(
  url: string,
  xccyPositions: XccyPosition[],
  ndfPositions: NdfPosition[],
  ibrSwapPositions: IbrSwapPosition[],
  options?: { valuation_date?: string },
): Promise<PortfolioRepriceResponse> {
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
        ...(p.trade_date ? { trade_date: p.trade_date } : {}),
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

  // Fase 0: warn when backend returns null/undefined for a numeric field.
  // Today these are silently coerced to 0, making "sin precio" indistinguishable
  // from "precio cero" in the UI. Sub-issue #296 removes the coercion; here we
  // just surface the problem in logs so we can quantify how often it happens.
  const n = (v: unknown, field: string, posId: string, fallback = 0): number => {
    if (!telemetry.assertNumeric('reprice', field, v, { posId })) {
      return fallback;
    }
    return v as number;
  };

  // Helper: bind posId so each n() call warns with enough context to find the
  // offending position in the logs without repeating `posId` at every call site.
  const bind = (r: Record<string, unknown>, posId: string) =>
    (field: string, fallback = 0): number => n(r[field], field, posId, fallback);

  const xccyResults: PricedXccy[] = (raw.xccy_results ?? []).map((r) => {
    const pos = xccyById[r.id as string];
    const g = bind(r, (r.id as string) ?? 'unknown');
    return {
      ...pos,
      npv_cop: g('npv_cop'), npv_usd: g('npv_usd'),
      pnl_rate_cop: g('pnl_rate_cop'), pnl_rate_usd: g('pnl_rate_usd'),
      pnl_fx_cop: g('pnl_fx_cop'), pnl_fx_usd: g('pnl_fx_usd'),
      usd_leg_pv: g('usd_leg_pv'), cop_leg_pv: g('cop_leg_pv'),
      usd_principal_pv: g('usd_principal_pv'), cop_principal_pv: g('cop_principal_pv'),
      carry_cop: g('carry_cop'), carry_usd: g('carry_usd'),
      carry_rate_cop_pct: g('carry_rate_cop_pct'), carry_rate_usd_pct: g('carry_rate_usd_pct'),
      carry_differential_bps: g('carry_differential_bps'),
      carry_accrued_cop: g('carry_accrued_cop'),
      days_open: g('days_open'),
      dv01_ibr: g('dv01_ibr'), dv01_sofr: g('dv01_sofr'), dv01_total: g('dv01_total'),
      fx_delta: g('fx_delta'), fx_exposure_usd: g('fx_exposure_usd'),
      par_basis_bps: r.par_basis_bps != null ? g('par_basis_bps') : null,
      notional_cop: g('notional_cop'), fx_spot: g('fx_spot'), n_periods: g('n_periods'),
      cashflows: (r.cashflows as PricedXccy['cashflows']) ?? [],
      error: r.error as string | undefined,
    };
  });

  const ndfResults: PricedNdf[] = (raw.ndf_results ?? []).map((r) => {
    const pos = ndfById[r.id as string];
    const g = bind(r, (r.id as string) ?? 'unknown');
    return {
      ...pos,
      npv_usd: g('npv_usd'), npv_cop: g('npv_cop'),
      forward: g('forward'), forward_points: g('forward_points'),
      carry_cop_daily: g('carry_cop_daily'), carry_usd_daily: g('carry_usd_daily'),
      days_to_maturity: g('days_to_maturity'),
      df_usd: g('df_usd'), df_cop: g('df_cop'),
      delta_cop: g('delta_cop'),
      dv01_cop: g('dv01_cop'), dv01_usd: g('dv01_usd'), dv01_total: g('dv01_total'),
      fx_delta: g('fx_delta'), fx_exposure_usd: g('fx_exposure_usd'),
      spot: g('spot'),
      days_open: g('days_open'),
      accrued_cop: g('accrued_cop'),
      error: r.error as string | undefined,
    };
  });

  const ibrSwapResults: PricedIbrSwap[] = (raw.ibr_swap_results ?? []).map((r) => {
    const pos = ibrById[r.id as string];
    const g = bind(r, (r.id as string) ?? 'unknown');
    return {
      ...pos,
      npv: g('npv'), fair_rate: g('fair_rate'), dv01: g('dv01'),
      fixed_leg_npv: g('fixed_leg_npv'), floating_leg_npv: g('floating_leg_npv'),
      ibr_overnight_pct: g('ibr_overnight_pct'),
      carry_daily_cop: g('carry_daily_cop'),
      carry_daily_diff_bps: g('carry_daily_diff_bps'),
      days_open: g('days_open'),
      accrued_carry_cop: g('accrued_carry_cop'),
      ibr_fwd_period_pct: g('ibr_fwd_period_pct'),
      carry_period_cop: g('carry_period_cop'),
      carry_period_diff_bps: g('carry_period_diff_bps'),
      error: r.error as string | undefined,
    };
  });

  return {
    xccy_results: xccyResults,
    ndf_results: ndfResults,
    ibr_swap_results: ibrSwapResults,
    summary: raw.summary ?? {
      total_npv_cop: 0, total_npv_usd: 0,
      total_carry_cop: 0, total_carry_usd: 0,
      total_pnl_rate_cop: 0, total_pnl_fx_cop: 0,
    },
  };
}
