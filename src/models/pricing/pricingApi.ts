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

const BASE_URL = process.env.NEXT_PUBLIC_PYSDK_URL || 'https://xerenity-pysdk.fly.dev';

async function pricingFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${BASE_URL}/${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed: ${res.status}`);
  }
  const json = await res.json();
  return json.body ?? json;
}

// ── Curves ──

export const buildCurves = () =>
  pricingFetch<BuildResult>('pricing/curves/build', { method: 'POST' });

export const getCurveStatus = () =>
  pricingFetch<CurveStatus>('pricing/curves/status');

export const bumpCurve = (curve: string, bps: number) =>
  pricingFetch<unknown>('pricing/curves/bump', {
    method: 'POST',
    body: JSON.stringify({ curve, bps }),
  });

export const setCurveNode = (curve: string, node: string | number, rate_pct: number) =>
  pricingFetch<unknown>('pricing/curves/bump', {
    method: 'POST',
    body: JSON.stringify({ curve, node, rate_pct }),
  });

export const resetCurves = () =>
  pricingFetch<unknown>('pricing/curves/reset', { method: 'POST' });

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

export const priceNdf = (params: NdfRequest) =>
  pricingFetch<NdfPricingResult>('pricing/ndf', {
    method: 'POST',
    body: JSON.stringify(params),
  });

export const getNdfImpliedCurve = () =>
  pricingFetch<NdfImpliedCurvePoint[]>('pricing/ndf/implied-curve');

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

export const priceIbrSwap = (params: IbrSwapRequest) =>
  pricingFetch<IbrSwapPricingResult>('pricing/ibr-swap', {
    method: 'POST',
    body: JSON.stringify(params),
  });

export const getIbrParCurve = () =>
  pricingFetch<ParCurvePoint[]>('pricing/ibr/par-curve');

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

export const priceTesBond = (params: TesBondRequest) =>
  pricingFetch<TesBondResult>('pricing/tes-bond', {
    method: 'POST',
    body: JSON.stringify({ include_cashflows: true, ...params }),
  });

// Backend returns { count, bonds[] } — unwrap to TesCatalogItem[]
export const getTesCatalog = () =>
  pricingFetch<{ count: number; bonds: TesCatalogItem[] }>('pricing/tes/catalog')
    .then((res) => res.bonds);

// No backend endpoint yet — caller should catch and use mock data
export const getTesYieldCurve = () =>
  pricingFetch<TesYieldCurvePoint[]>('pricing/tes/yield-curve');

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

export const priceXccySwap = (params: XccySwapRequest) =>
  pricingFetch<XccySwapResult>('pricing/xccy-swap', {
    method: 'POST',
    body: JSON.stringify(params),
  });

export const getXccyCashflows = (params: XccySwapRequest) =>
  pricingFetch<XccyCashflowResponse>('pricing/xccy-swap/cashflows', {
    method: 'POST',
    body: JSON.stringify(params),
  });

export interface ParBasisCurveRequest {
  notional_usd?: number;
  fx_initial?: number;
  payment_frequency?: string;
  amortization_type?: string;
  tenors_years?: number[];
}

export const getXccyParBasisCurve = (params?: ParBasisCurveRequest) =>
  pricingFetch<ParBasisPoint[]>('pricing/xccy/par-basis-curve', {
    method: 'POST',
    body: JSON.stringify(params || {}),
  });

// ── Market Marks ──

export const getMarksDates = () =>
  pricingFetch<{ dates: string[] }>('pricing/marks/dates');

export interface MarketMarkRow {
  fecha: string;
  status: 'complete' | 'partial' | 'missing';
  fx_spot: number | null;
  sofr_on: number | null;
  ibr: Record<string, number | null> | null;
  sofr: Record<string, number | null> | null;
  ndf: Record<string, { F_market?: number; fwd_pts_cop?: number; deval_ea?: number } | null> | null;
}

export const getMarks = () =>
  pricingFetch<{ marks: MarketMarkRow[]; count: number }>('pricing/marks');

export const getMarkByDate = (fecha: string) =>
  pricingFetch<{ mark: MarketMarkRow | null }>(`pricing/marks?fecha=${fecha}`);
