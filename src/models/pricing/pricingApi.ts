/**
 * Pricing API client — calls the pysdk Django server directly.
 */
import type {
  BuildResult,
  CurveStatus,
  NdfPricingResult,
  NdfImpliedCurvePoint,
  IbrSwapPricingResult,
  ParCurvePoint,
  TesBondResult,
  TesCatalogItem,
  TesYieldCurvePoint,
  XccySwapResult,
  XccyCashflowResponse,
  ParBasisPoint,
} from 'src/types/pricing';
import {
  telemetry,
  combineAbortSignals,
  DEFAULT_FETCH_TIMEOUT_MS,
} from 'src/lib/telemetry';

const BASE_URL = process.env.NEXT_PUBLIC_PYSDK_URL || 'https://pysdk.fly.dev';

/** Extra options accepted by all pricing endpoints. `signal` lets callers
 *  cancel in-flight requests when their inputs change (sub-issue #292). */
export interface PricingFetchOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

async function pricingFetch<T>(
  path: string,
  options?: RequestInit & PricingFetchOptions,
): Promise<T> {
  const url = `${BASE_URL}/${path}`;
  const {
    signal: externalSignal,
    timeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
    ...fetchOptions
  } = options ?? {};
  const signal = combineAbortSignals(externalSignal, timeoutMs);
  return telemetry.time(
    'pricing',
    path,
    async () => {
      const res = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
        ...fetchOptions,
        signal,
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Request failed: ${res.status}`);
      }
      const json = await res.json();
      return (json.body ?? json) as T;
    },
    { method: options?.method ?? 'GET' },
  );
}

// ── Curves ──

export const buildCurves = (opts?: PricingFetchOptions) =>
  pricingFetch<BuildResult>('pricing/curves/build', { method: 'POST', ...opts });

export const getCurveStatus = (opts?: PricingFetchOptions) =>
  pricingFetch<CurveStatus>('pricing/curves/status', opts);

export const bumpCurve = (curve: string, bps: number, opts?: PricingFetchOptions) =>
  pricingFetch<unknown>('pricing/curves/bump', {
    method: 'POST',
    body: JSON.stringify({ curve, bps }),
    ...opts,
  });

export const setCurveNode = (
  curve: string,
  node: string | number,
  rate_pct: number,
  opts?: PricingFetchOptions,
) =>
  pricingFetch<unknown>('pricing/curves/bump', {
    method: 'POST',
    body: JSON.stringify({ curve, node, rate_pct }),
    ...opts,
  });

export const resetCurves = (opts?: PricingFetchOptions) =>
  pricingFetch<unknown>('pricing/curves/reset', { method: 'POST', ...opts });

// ── NDF ──

export interface NdfRequest {
  notional_usd: number;
  strike: number;
  maturity_date: string;
  direction?: 'buy' | 'sell';
  spot?: number;
  use_market_forward?: boolean;
  market_forward?: number;
}

export const priceNdf = (params: NdfRequest, opts?: PricingFetchOptions) =>
  pricingFetch<NdfPricingResult>('pricing/ndf', {
    method: 'POST',
    body: JSON.stringify(params),
    ...opts,
  });

export const getNdfImpliedCurve = (opts?: PricingFetchOptions) =>
  pricingFetch<NdfImpliedCurvePoint[]>('pricing/ndf/implied-curve', opts);

// ── IBR Swap ──

export interface IbrSwapRequest {
  notional: number;
  fixed_rate: number;
  pay_fixed?: boolean;
  spread?: number;
  tenor_years?: number;
  maturity_date?: string;
  start_date?: string;
  payment_frequency?: string;
}

export const priceIbrSwap = (params: IbrSwapRequest, opts?: PricingFetchOptions) =>
  pricingFetch<IbrSwapPricingResult>('pricing/ibr-swap', {
    method: 'POST',
    body: JSON.stringify(params),
    ...opts,
  });

export const getIbrParCurve = (opts?: PricingFetchOptions) =>
  pricingFetch<ParCurvePoint[]>('pricing/ibr/par-curve', opts);

// ── TES Bond ──

export interface TesBondRequest {
  issue_date: string;
  maturity_date: string;
  coupon_rate: number;
  market_clean_price?: number;
  market_ytm?: number;
  face_value?: number;
  include_cashflows?: boolean; // pysdk: include full coupon schedule in response
  bond_name?: string;          // pysdk: catalog lookup by name
  valuation_date?: string;     // pysdk: use historical TES curve for this date
}

export const priceTesBond = (params: TesBondRequest, opts?: PricingFetchOptions) =>
  pricingFetch<TesBondResult>('pricing/tes-bond', {
    method: 'POST',
    body: JSON.stringify({ include_cashflows: true, ...params }),
    ...opts,
  });

// Backend returns { count, bonds[] } — unwrap to TesCatalogItem[]
export const getTesCatalog = (opts?: PricingFetchOptions) =>
  pricingFetch<{ count: number; bonds: TesCatalogItem[] }>('pricing/tes/catalog', opts)
    .then((res) => res.bonds);

// No backend endpoint yet — caller should catch and use mock data
export const getTesYieldCurve = (opts?: PricingFetchOptions) =>
  pricingFetch<TesYieldCurvePoint[]>('pricing/tes/yield-curve', opts);

// ── Xccy Swap ──

export interface XccySwapRequest {
  notional_usd: number;
  start_date: string;
  maturity_date: string;
  usd_spread_bps?: number;
  cop_spread_bps?: number;
  xccy_basis_bps?: number;
  pay_usd?: boolean;
  fx_initial?: number;
  /** Payment frequency in months: 1 = monthly, 3 = quarterly, 6 = semi-annual, 12 = annual */
  payment_frequency_months?: number;
  amortization_type?: string;
  amortization_schedule?: number[];
}

export const priceXccySwap = (params: XccySwapRequest, opts?: PricingFetchOptions) =>
  pricingFetch<XccySwapResult>('pricing/xccy-swap', {
    method: 'POST',
    body: JSON.stringify(params),
    ...opts,
  });

export const getXccyCashflows = (params: XccySwapRequest, opts?: PricingFetchOptions) =>
  pricingFetch<XccyCashflowResponse>('pricing/xccy-swap/cashflows', {
    method: 'POST',
    body: JSON.stringify(params),
    ...opts,
  });

export interface ParBasisCurveRequest {
  notional_usd?: number;
  fx_initial?: number;
  payment_frequency?: string;
  amortization_type?: string;
  tenors_years?: number[];
}

export const getXccyParBasisCurve = (
  params?: ParBasisCurveRequest,
  opts?: PricingFetchOptions,
) =>
  pricingFetch<ParBasisPoint[]>('pricing/xccy/par-basis-curve', {
    method: 'POST',
    body: JSON.stringify(params || {}),
    ...opts,
  });

// ── Market Marks ──

export const getMarksDates = (opts?: PricingFetchOptions) =>
  pricingFetch<{ dates: string[] }>('pricing/marks/dates', opts);

export interface MarketMarkRow {
  fecha: string;
  status: 'complete' | 'partial' | 'missing';
  fx_spot: number | null;
  sofr_on: number | null;
  ibr: Record<string, number | null> | null;
  sofr: Record<string, number | null> | null;
  ndf: Record<string, { F_market?: number; fwd_pts_cop?: number; deval_ea?: number } | null> | null;
}

export const getMarks = (opts?: PricingFetchOptions) =>
  pricingFetch<{ marks: MarketMarkRow[]; count: number }>('pricing/marks', opts);

export const getMarkByDate = (fecha: string, opts?: PricingFetchOptions) =>
  pricingFetch<{ mark: MarketMarkRow | null }>(`pricing/marks?fecha=${fecha}`, opts);

// ── NDF Settlement ──

export interface NdfSettlementRequest {
  notional_usd: number;
  strike: number;
  maturity_date: string;
  direction?: 'buy' | 'sell';
}

export interface NdfSettlementResult {
  trm_fixing: number;
  trm_date: string;
  pyl_cop: number;
  pyl_usd: number;
  strike: number;
  notional_usd: number;
  direction: string;
  maturity_date: string;
}

export const getNdfSettlement = (
  params: NdfSettlementRequest,
  opts?: PricingFetchOptions,
) =>
  pricingFetch<NdfSettlementResult>('pricing/ndf/settlement', {
    method: 'POST',
    body: JSON.stringify(params),
    ...opts,
  });
